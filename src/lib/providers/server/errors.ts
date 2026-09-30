// MythicalMind — unified provider error catalog.
// Translates technical HTTP/network failures into readable, actionable errors.

import type { FriendlyError } from "@/lib/types";

export class ProviderError extends Error {
  code: string;
  status?: number;
  hint?: string;

  constructor(fe: FriendlyError) {
    super(fe.message);
    this.name = "ProviderError";
    this.code = fe.code;
    this.status = fe.status;
    this.hint = fe.hint;
  }

  toFriendly(): FriendlyError {
    return {
      code: this.code,
      message: this.message,
      hint: this.hint,
      status: this.status,
    };
  }
}

/** Extract a human-readable message from a provider error body, if any. */
function extractProviderMessage(body: string): string | null {
  if (!body) return null;
  try {
    const json = JSON.parse(body);
    const msg =
      json?.error?.message ??
      json?.error?.code ??
      json?.message ??
      json?.detail;
    if (typeof msg === "string" && msg.trim()) return msg.trim().slice(0, 240);
  } catch {
    // plain-text body
    const text = body.trim();
    if (text && text.length < 240) return text;
  }
  return null;
}

/** Map an HTTP status code from a provider to a friendly error. */
export function classifyHttpError(
  status: number,
  body: string,
  url?: string
): ProviderError {
  const providerMsg = extractProviderMessage(body);
  const hintFromProvider = providerMsg ? `Provider said: ${providerMsg}` : undefined;

  switch (status) {
    case 400:
      return new ProviderError({
        code: "bad_request",
        message: "The provider rejected the request.",
        hint:
          hintFromProvider ??
          "The model name or a request parameter may not be valid for this provider.",
        status: 400,
      });
    case 401:
      return new ProviderError({
        code: "authentication",
        message: "Authentication failed — the provider rejected this API key.",
        hint: "Check the API key saved for this provider.",
        status: 401,
      });
    case 403:
      return new ProviderError({
        code: "forbidden",
        message: "Access denied — the key cannot use this model or endpoint.",
        hint: "Verify the key's permissions, account tier or region.",
        status: 403,
      });
    case 404:
      return new ProviderError({
        code: "not_found",
        message: "Endpoint not found.",
        hint: `Check the Base URL — OpenAI-compatible endpoints usually end with /v1${
          url ? ` (tried ${truncate(url, 80)})` : ""
        }.`,
        status: 404,
      });
    case 408:
      return new ProviderError({
        code: "timeout",
        message: "The provider timed out before responding.",
        hint: "The provider may be overloaded. Retry in a moment.",
        status: 408,
      });
    case 429:
      return new ProviderError({
        code: "rate_limited",
        message: "Rate limit reached — the provider is throttling requests.",
        hint: "Wait a moment and retry, or slow down parallel generations.",
        status: 429,
      });
    case 500:
    case 502:
    case 503:
    case 504:
      return new ProviderError({
        code: "provider_unavailable",
        message: "Provider unavailable — the AI provider stopped responding.",
        hint: "Your conversation is safe. Retry to continue.",
        status,
      });
    default:
      return new ProviderError({
        code: "provider_error",
        message: `The provider responded with status ${status}.`,
        hint: hintFromProvider ?? undefined,
        status,
      });
  }
}

/** Wrap a network-level fetch failure. */
export function classifyNetworkError(err: unknown, context: string): ProviderError {
  if (err instanceof ProviderError) return err;
  const reason = err instanceof Error ? err.message : String(err);
  return new ProviderError({
    code: "network",
    message: `Could not reach the provider (${context}).`,
    hint: `Check the Base URL, the network, and that the server is running. ${truncate(
      reason,
      120
    )}`,
  });
}

/** Error emitted inside a provider stream (some providers mid-stream error JSON). */
export function classifyStreamError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;
  if (typeof err === "object" && err !== null) {
    const anyErr = err as {
      message?: string;
      code?: string | number;
      type?: string;
    };
    if (anyErr.message) {
      return new ProviderError({
        code: "provider_stream_error",
        message: "The provider interrupted the response stream.",
        hint: String(anyErr.message).slice(0, 240),
      });
    }
  }
  return new ProviderError({
    code: "stream_interrupted",
    message: "The provider interrupted the response stream.",
    hint: "Partial output was kept. You can retry or continue.",
  });
}

export function toFriendlyError(err: unknown): FriendlyError {
  if (err instanceof ProviderError) return err.toFriendly();
  if (err instanceof Error && err.name === "AbortError") {
    return {
      code: "aborted",
      message: "Generation was stopped.",
    };
  }
  if (err instanceof Error) {
    return {
      code: "internal",
      message: "Something went wrong while generating.",
      hint: err.message.slice(0, 200),
    };
  }
  return { code: "internal", message: "Something went wrong while generating." };
}

export function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
