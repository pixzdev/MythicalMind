// MythicalMind — universal OpenAI-compatible provider adapter.
//
// Talks to any endpoint that implements:
//   POST {baseURL}/chat/completions  (Authorization: Bearer, SSE streaming)
//   GET  {baseURL}/models            (optional model discovery)
//
// Normalizes provider quirks into the internal StreamEvent protocol:
//  - delta.content                          → text-delta
//  - delta.reasoning_content / .reasoning   → reasoning-delta (DeepSeek style)
//  - usage (final chunk / stream_options)   → usage
//  - mid-stream {"error": ...}              → error
//  - providers that reject stream_options   → automatic retry without it

import type { ChatMessage, StreamEvent, Usage } from "@/lib/types";
import {
  ProviderError,
  classifyHttpError,
  classifyNetworkError,
  classifyStreamError,
} from "./errors";

export interface ProviderConfig {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  apiKey: string;
  customHeaders: Record<string, string>;
}

export interface StreamRequest {
  config: ProviderConfig;
  model: string;
  messages: ChatMessage[];
  temperature?: number | null;
  maxTokens?: number | null;
  signal: AbortSignal;
}

export interface DiscoveredModel {
  modelId: string;
  name: string;
  contextWindow: number | null;
}

export interface PingResult {
  ok: boolean;
  detail: string;
  models?: number;
}

export interface ProviderAdapter {
  readonly type: string;
  stream(req: StreamRequest): AsyncGenerator<StreamEvent>;
  listModels(config: ProviderConfig, timeoutMs?: number): Promise<DiscoveredModel[]>;
  ping(config: ProviderConfig, probeModel?: string | null): Promise<PingResult>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize a user-entered base URL: add scheme, strip trailing slashes. */
export function normalizeBaseUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, "");
  if (!u) return u;
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  try {
    const parsed = new URL(u);
    // Host-only base (no path) → assume the standard /v1 prefix.
    if (parsed.pathname === "" || parsed.pathname === "/") {
      parsed.pathname = "/v1";
      u = parsed.toString().replace(/\/+$/, "");
    }
  } catch {
    // leave as-is; the request will surface a readable network error
  }
  return u;
}

function buildHeaders(
  config: ProviderConfig,
  opts: { json?: boolean } = {}
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (opts.json !== false) headers["Content-Type"] = "application/json";
  if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;
  headers["Accept"] = "text/event-stream";
  // custom headers last — they may intentionally override defaults
  for (const [k, v] of Object.entries(config.customHeaders ?? {})) {
    if (typeof v === "string") headers[k] = v;
  }
  return headers;
}

function jsonHeaders(config: ProviderConfig): Record<string, string> {
  const h = buildHeaders(config, { json: true });
  h["Accept"] = "application/json";
  return h;
}

const EVENT_SEPARATOR = /\r\n\r\n|\n\n|\r\r/;

/** Split the first complete SSE event off the buffer. Returns null if none. */
function splitEvent(buffer: string): [string, string] | null {
  const m = buffer.match(EVENT_SEPARATOR);
  if (!m || m.index === undefined) return null;
  return [buffer.slice(0, m.index), buffer.slice(m.index + m[0].length)];
}

/** Extract joined `data:` lines from one raw SSE event; null for keep-alives. */
function extractData(rawEvent: string): string | null {
  const dataLines: string[] = [];
  for (const line of rawEvent.split(/\r\n|\n|\r/)) {
    if (line.startsWith(":")) continue;
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  }
  if (dataLines.length === 0) return null;
  return dataLines.join("\n");
}

// ---------------------------------------------------------------------------
// The adapter
// ---------------------------------------------------------------------------

export class OpenAICompatibleAdapter implements ProviderAdapter {
  readonly type = "openai-compatible";

  async *stream(req: StreamRequest): AsyncGenerator<StreamEvent> {
    const base = normalizeBaseUrl(req.config.baseUrl);
    const url = `${base}/chat/completions`;

    const body: Record<string, unknown> = {
      model: req.model,
      messages: req.messages,
      stream: true,
    };
    if (typeof req.temperature === "number") body.temperature = req.temperature;
    if (typeof req.maxTokens === "number" && req.maxTokens > 0) {
      body.max_tokens = req.maxTokens;
    }
    // Ask for token usage when streaming. Some strict gateways reject this
    // field — we detect that and retry once without it.
    body.stream_options = { include_usage: true };

    let res: Response;
    try {
      res = await this.fetchWithTimeout(url, body, req.config, req.signal);
    } catch (err) {
      if (req.signal.aborted) throw err;
      throw classifyNetworkError(err, "connection failed");
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (res.status === 400 && /stream_options|include_usage/i.test(errText)) {
        // Provider does not support stream_options — retry without it.
        delete body.stream_options;
        try {
          res = await this.fetchWithTimeout(url, body, req.config, req.signal);
        } catch (err) {
          if (req.signal.aborted) throw err;
          throw classifyNetworkError(err, "connection failed");
        }
      } else {
        throw classifyHttpError(res.status, errText, url);
      }
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw classifyHttpError(res.status, errText, url);
    }
    if (!res.body) {
      throw new ProviderError({
        code: "empty_response",
        message: "The provider returned an empty response body.",
      });
    }

    let usage: Usage | undefined;
    let gotData = false;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let event: [string, string] | null;
        while ((event = splitEvent(buffer)) !== null) {
          const [raw, rest] = event;
          buffer = rest;
          const data = extractData(raw);
          if (data == null) continue;
          if (data === "[DONE]") {
            if (usage) yield { type: "usage", usage };
            yield { type: "done" };
            return;
          }
          let json: any;
          try {
            json = JSON.parse(data);
          } catch {
            continue; // tolerate keep-alive / malformed fragments
          }
          if (json && typeof json === "object" && json.error) {
            throw classifyStreamError(json.error);
          }
          gotData = true;
          const choice = json?.choices?.[0];
          const delta = choice?.delta;
          if (delta && typeof delta === "object") {
            const reasoning =
              typeof delta.reasoning_content === "string"
                ? delta.reasoning_content
                : typeof delta.reasoning === "string"
                  ? delta.reasoning
                  : null;
            if (reasoning) {
              yield { type: "reasoning-delta", text: reasoning };
            }
            if (typeof delta.content === "string" && delta.content) {
              yield { type: "text-delta", text: delta.content };
            }
          }
          const u = json?.usage;
          if (
            u &&
            typeof u === "object" &&
            (typeof u.prompt_tokens === "number" ||
              typeof u.completion_tokens === "number" ||
              typeof u.total_tokens === "number")
          ) {
            usage = {
              inputTokens: u.prompt_tokens,
              outputTokens: u.completion_tokens,
              totalTokens: u.total_tokens,
            };
          }
        }
      }
    } catch (err) {
      if (req.signal.aborted) throw err;
      throw classifyStreamError(err);
    } finally {
      try {
        reader.releaseLock();
      } catch {
        /* noop */
      }
      try {
        await res.body?.cancel();
      } catch {
        /* noop */
      }
    }

    // Stream ended without [DONE] — some providers do this. Treat as done.
    if (!gotData) {
      throw new ProviderError({
        code: "empty_response",
        message: "The provider returned an empty response.",
        hint: "The endpoint answered but produced no completion data — verify the model name.",
      });
    }
    if (usage) yield { type: "usage", usage };
    yield { type: "done" };
  }

  private async fetchWithTimeout(
    url: string,
    body: Record<string, unknown>,
    config: ProviderConfig,
    signal: AbortSignal
  ): Promise<Response> {
    // merge caller signal with a headers-timeout so stalled connects fail fast
    const connectTimeout = AbortSignal.timeout(60_000);
    const composed = AbortSignal.any?.([signal, connectTimeout]) ?? signal;
    return fetch(url, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify(body),
      signal: composed,
      cache: "no-store",
    });
  }

  async listModels(
    config: ProviderConfig,
    timeoutMs = 15_000
  ): Promise<DiscoveredModel[]> {
    const base = normalizeBaseUrl(config.baseUrl);
    const url = `${base}/models`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: jsonHeaders(config),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch (err) {
      throw classifyNetworkError(err, "models request failed");
    }
    if (!res.ok) {
      throw classifyHttpError(res.status, await res.text().catch(() => ""), url);
    }
    let json: any;
    try {
      json = await res.json();
    } catch {
      throw new ProviderError({
        code: "malformed_response",
        message: "The /models endpoint returned malformed JSON.",
      });
    }
    const arr = Array.isArray(json)
      ? json
      : (json?.data ?? json?.models ?? []);
    if (!Array.isArray(arr)) {
      throw new ProviderError({
        code: "malformed_response",
        message: "The /models endpoint returned an unexpected format.",
      });
    }
    const models: DiscoveredModel[] = [];
    for (const m of arr) {
      const modelId = m?.id ?? m?.name ?? m?.model;
      if (typeof modelId !== "string" || !modelId) continue;
      models.push({
        modelId,
        name: typeof m?.name === "string" && m.name !== modelId ? m.name : modelId,
        contextWindow:
          typeof m?.context_length === "number"
            ? m.context_length
            : typeof m?.context_window === "number"
              ? m.context_window
              : typeof m?.max_model_len === "number"
                ? m.max_model_len
                : null,
      });
    }
    return models;
  }

  async ping(config: ProviderConfig, probeModel?: string | null): Promise<PingResult> {
    // 1) Try GET /models — cheap and standard.
    try {
      const models = await this.listModels(config, 12_000);
      return {
        ok: true,
        detail: `Connected — ${models.length} model${models.length === 1 ? "" : "s"} available.`,
        models: models.length,
      };
    } catch (err) {
      const status = err instanceof ProviderError ? err.status : undefined;
      if (status !== 404 && status !== 405) {
        return { ok: false, detail: friendlyMessage(err) };
      }
    }
    // 2) /models not exposed — fall back to a minimal chat completion.
    const model = probeModel?.trim();
    if (!model) {
      return {
        ok: false,
        detail:
          "Connected to the server, but /models is not exposed and no model is set to probe. Add a model manually.",
      };
    }
    const base = normalizeBaseUrl(config.baseUrl);
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: jsonHeaders(config),
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
          stream: false,
        }),
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      if (res.ok) {
        return { ok: true, detail: "Connected — chat endpoint responded." };
      }
      const text = await res.text().catch(() => "");
      const fe = classifyHttpError(res.status, text, `${base}/chat/completions`);
      return { ok: false, detail: fe.message };
    } catch (err) {
      return { ok: false, detail: friendlyMessage(err) };
    }
  }
}

function friendlyMessage(err: unknown): string {
  if (err instanceof ProviderError) {
    return err.hint ? `${err.message} ${err.hint}` : err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
