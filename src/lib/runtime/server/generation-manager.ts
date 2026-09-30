// MythicalMind — Generation Runtime (server).
//
// The GenerationManager owns every active generation. It lives ABOVE any
// HTTP request and any React component: a generation keeps streaming while
// the user navigates, refreshes, or closes the conversation view. The UI is
// only a subscriber (via /api/generations/[id]/events SSE).
//
//   POST /api/conversations/:id/messages  ──create──▶  manager.start()
//                                                        │ (background async loop)
//              SSE subscribers ◀──event bus── manager.run() ──▶ provider stream
//                                                        │
//                                          throttled batched persistence ──▶ SQLite

import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { registry } from "@/lib/providers/server/registry";
import type { ProviderConfig } from "@/lib/providers/server/registry";
import { toFriendlyError, ProviderError } from "@/lib/providers/server/errors";
import type {
  ChatMessage,
  FriendlyError,
  GenerationStatus,
  PublicGenerationState,
  RuntimeEvent,
  Usage,
} from "@/lib/types";
import { isTerminal } from "@/lib/types";

export interface StartGenerationInput {
  generationId: string;
  conversationId: string;
  messageId: string;
  providerId: string;
  providerName: string;
  modelKey: string;
  messages: ChatMessage[];
  temperature?: number | null;
  maxTokens?: number | null;
  initialText?: string;
  initialReasoning?: string;
}

const PERSIST_INTERVAL_MS = 750; // batched DB writes — never one write per token
const RECENT_KEEP = 80; // finished runs kept in memory for instant reconnect
const RECENT_TTL_MS = 10 * 60 * 1000;
const MAX_CONCURRENT = 6; // beyond this, generations are queued
const RECOVERY_CUTOFF_MS = 60_000; // rows older than this are orphaned

interface Run {
  state: PublicGenerationState;
  controller: AbortController;
  abortReason: "user" | "timeout" | null;
  listeners: Set<(ev: RuntimeEvent) => void>;
  persistTimer: ReturnType<typeof setTimeout> | null;
  timeoutTimer: ReturnType<typeof setTimeout> | null;
  dirty: boolean;
  messageCount0: number;
  input: StartGenerationInput;
}

class GenerationManager {
  private runs = new Map<string, Run>();
  private recent = new Map<string, Run>();
  private queue: string[] = [];
  private recoveryPromise: Promise<void> | null = null;
  private seq = 0;

  // ------------------------------------------------------------------
  // Boot recovery — a restart must not leave rows stuck in "streaming"
  // ------------------------------------------------------------------

  private ensureRecovered(): Promise<void> {
    if (!this.recoveryPromise) {
      this.recoveryPromise = this.recover().catch(() => undefined);
    }
    return this.recoveryPromise;
  }

  private async recover(): Promise<void> {
    const cutoff = new Date(Date.now() - RECOVERY_CUTOFF_MS);
    try {
      const orphaned = await db.generation.findMany({
        where: {
          status: { in: ["queued", "streaming"] },
          startedAt: { lt: cutoff },
        },
        select: { id: true, messageId: true },
      });
      if (orphaned.length > 0) {
        await db.generation.updateMany({
          where: { id: { in: orphaned.map((g) => g.id) } },
          data: {
            status: "failed",
            endedAt: new Date(),
            error: JSON.stringify({
              code: "interrupted",
              message: "Generation was interrupted (runtime restarted).",
              hint: "The response was kept up to the interruption point. Retry to continue.",
            }),
          },
        });
      }
      const orphanedMessages = await db.message.findMany({
        where: { status: "streaming", updatedAt: { lt: cutoff } },
        select: { id: true },
      });
      if (orphanedMessages.length > 0) {
        await db.message.updateMany({
          where: { id: { in: orphanedMessages.map((m) => m.id) } },
          data: {
            status: "failed",
            error: JSON.stringify({
              code: "interrupted",
              message: "Generation was interrupted (runtime restarted).",
            }),
          },
        });
      }
    } catch {
      /* recovery is best-effort */
    }
  }

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------

  async start(input: StartGenerationInput): Promise<PublicGenerationState> {
    await this.ensureRecovered();

    const conversation = await db.conversation.findUnique({
      where: { id: input.conversationId },
      select: { title: true },
    });

    const run: Run = {
      state: {
        id: input.generationId,
        conversationId: input.conversationId,
        conversationTitle: conversation?.title ?? null,
        messageId: input.messageId,
        providerId: input.providerId,
        providerName: input.providerName,
        modelKey: input.modelKey,
        status: "queued",
        text: input.initialText ?? "",
        reasoning: input.initialReasoning ?? "",
        outputChars: (input.initialText ?? "").length,
        usage: null,
        error: null,
        startedAt: new Date().toISOString(),
        endedAt: null,
        durationMs: null,
      },
      controller: new AbortController(),
      abortReason: null,
      listeners: new Set(),
      persistTimer: null,
      timeoutTimer: null,
      dirty: false,
      messageCount0: 0,
      input,
    };

    this.runs.set(input.generationId, run);

    const activeCount = [...this.runs.values()].filter(
      (r) => !isTerminal(r.state.status)
    ).length;
    if (activeCount > MAX_CONCURRENT) {
      this.emit(run, { type: "status", status: "queued" });
      this.queue.push(input.generationId);
    } else {
      void this.launch(run);
    }

    return this.cloneState(run.state);
  }

  private launch(run: Run) {
    void this.run(run).catch(() => undefined);
  }

  private maybeStartNext() {
    while (this.queue.length > 0) {
      const nextId = this.queue[0];
      const run = this.runs.get(nextId);
      if (!run || isTerminal(run.state.status)) {
        this.queue.shift();
        continue;
      }
      const activeCount = [...this.runs.values()].filter(
        (r) => r.state.status === "streaming" || r.state.status === "queued"
      ).length;
      if (activeCount > MAX_CONCURRENT) break;
      this.queue.shift();
      this.launch(run);
      break;
    }
  }

  private async run(run: Run): Promise<void> {
    const { state } = run;
    const startedAt = Date.now();

    try {
      const provider = await db.provider.findUnique({
        where: { id: state.providerId },
      });
      if (!provider) {
        throw new ProviderError({
          code: "provider_missing",
          message: "The provider for this conversation no longer exists.",
          hint: "Add it again in Infrastructure → Providers.",
        });
      }
      const config: ProviderConfig = {
        id: provider.id,
        name: provider.name,
        type: provider.type,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        customHeaders: safeParseHeaders(provider.customHeaders),
      };
      const adapter = registry.get(provider.type);

      const settings = await getSettings();
      const temperature =
        run.input.temperature ?? settings.generation.temperature ?? undefined;
      const maxTokens = run.input.maxTokens ?? settings.generation.maxTokens ?? undefined;
      const timeoutMs = Math.max(30_000, settings.generation.timeoutMs || 600_000);

      run.timeoutTimer = setTimeout(() => {
        run.abortReason = "timeout";
        run.controller.abort();
      }, timeoutMs);

      state.status = "streaming";
      this.emit(run, { type: "status", status: "streaming" });
      await this.persist(run, { statusOnly: true });

      let sawContent = state.text.length > 0 || state.reasoning.length > 0;

      for await (const ev of adapter.stream({
        config,
        model: state.modelKey,
        messages: run.input.messages,
        temperature,
        maxTokens,
        signal: run.controller.signal,
      })) {
        switch (ev.type) {
          case "text-delta":
            state.text += ev.text;
            state.outputChars = state.text.length;
            sawContent = true;
            this.emit(run, ev);
            this.schedulePersist(run);
            break;
          case "reasoning-delta":
            state.reasoning += ev.text;
            sawContent = true;
            this.emit(run, ev);
            this.schedulePersist(run);
            break;
          case "usage":
            state.usage = ev.usage;
            this.emit(run, ev);
            this.schedulePersist(run);
            break;
          case "tool-call":
            // reserved for future tool-calling providers — normalized passthrough
            break;
          case "error":
            throw new ProviderError(ev.error);
          case "done":
            break;
        }
      }

      if (run.timeoutTimer) clearTimeout(run.timeoutTimer);

      if (!sawContent) {
        throw new ProviderError({
          code: "empty_response",
          message: "The provider returned an empty response.",
          hint: "Verify the model name in Infrastructure → Models.",
        });
      }

      state.status = "completed";
      state.endedAt = new Date().toISOString();
      state.durationMs = Date.now() - startedAt;
      await this.finalize(run, "completed");
    } catch (err) {
      if (run.timeoutTimer) clearTimeout(run.timeoutTimer);
      const aborted = run.controller.signal.aborted;

      if (aborted && run.abortReason === "user") {
        state.status = "cancelled";
        state.endedAt = new Date().toISOString();
        state.durationMs = Date.now() - startedAt;
        await this.finalize(run, "cancelled");
      } else if (aborted && run.abortReason === "timeout") {
        state.status = "failed";
        state.error = {
          code: "timeout",
          message: "Generation timed out.",
          hint: "Increase the timeout in Settings → Generation, or continue the response.",
        };
        state.endedAt = new Date().toISOString();
        state.durationMs = Date.now() - startedAt;
        await this.finalize(run, "failed");
      } else {
        state.status = "failed";
        state.error = toFriendlyError(err);
        state.endedAt = new Date().toISOString();
        state.durationMs = Date.now() - startedAt;
        await this.finalize(run, "failed");
      }
    }
  }

  // ------------------------------------------------------------------
  // Persistence — throttled & batched
  // ------------------------------------------------------------------

  private schedulePersist(run: Run) {
    if (run.persistTimer) return;
    run.dirty = true;
    run.persistTimer = setTimeout(() => {
      run.persistTimer = null;
      if (run.dirty) {
        void this.persist(run).catch(() => undefined);
      }
    }, PERSIST_INTERVAL_MS);
  }

  private async persist(run: Run, opts: { statusOnly?: boolean } = {}) {
    const { state } = run;
    const terminal = isTerminal(state.status);
    if (!run.dirty && !opts.statusOnly && !terminal) return;
    run.dirty = false;

    const messageData: Record<string, unknown> = {
      content: state.text,
      reasoning: state.reasoning || null,
      updatedAt: new Date(),
    };
    if (opts.statusOnly || terminal) {
      messageData.status =
        state.status === "completed"
          ? "completed"
          : state.status === "streaming"
            ? "streaming"
            : state.status === "cancelled"
              ? "cancelled"
              : "failed";
      messageData.usage = state.usage ? JSON.stringify(state.usage) : null;
      messageData.error = state.error ? JSON.stringify(state.error) : null;
    }

    await Promise.allSettled([
      state.messageId
        ? db.message.update({ where: { id: state.messageId }, data: messageData })
        : Promise.resolve(null),
      db.generation.update({
        where: { id: state.id },
        data: {
          outputChars: state.outputChars,
          usage: state.usage ? JSON.stringify(state.usage) : undefined,
          status: state.status,
          // atomic with the terminal status — readers must never see
          // "failed" without its error, or "completed" without final stats
          ...(terminal
            ? {
                error: state.error ? JSON.stringify(state.error) : null,
                endedAt: state.endedAt ? new Date(state.endedAt) : new Date(),
                durationMs: state.durationMs,
              }
            : {}),
        },
      }),
      db.conversation.update({
        where: { id: state.conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);
  }

  private async finalize(run: Run, status: GenerationStatus) {
    if (run.persistTimer) {
      clearTimeout(run.persistTimer);
      run.persistTimer = null;
    }
    run.dirty = true;
    await this.persist(run).catch(() => undefined);

    // durable generation record
    await db.generation
      .update({
        where: { id: run.state.id },
        data: {
          status,
          endedAt: new Date(),
          durationMs: run.state.durationMs,
          outputChars: run.state.outputChars,
          usage: run.state.usage ? JSON.stringify(run.state.usage) : null,
          error: run.state.error ? JSON.stringify(run.state.error) : null,
        },
      })
      .catch(() => undefined);

    // message terminal status is written by persist(); make sure content is final
    if (run.state.messageId) {
      await db.message
        .update({
          where: { id: run.state.messageId },
          data: {
            content: run.state.text,
            reasoning: run.state.reasoning || null,
            status:
              status === "completed"
                ? "completed"
                : status === "cancelled"
                  ? "cancelled"
                  : "failed",
            usage: run.state.usage ? JSON.stringify(run.state.usage) : null,
            error: run.state.error ? JSON.stringify(run.state.error) : null,
            updatedAt: new Date(),
          },
        })
        .catch(() => undefined);
    }

    this.emit(run, { type: "status", status, error: run.state.error });
    this.emit(run, { type: "done", state: this.cloneState(run.state) });

    for (const cb of run.listeners) {
      try {
        cb({ type: "done", state: this.cloneState(run.state) });
      } catch {
        /* listener detached */
      }
    }
    run.listeners.clear();

    this.runs.delete(run.state.id);
    this.recent.set(run.state.id, run);
    this.pruneRecent();
    this.maybeStartNext();

    await this.logActivity(run, status).catch(() => undefined);
  }

  private pruneRecent() {
    const now = Date.now();
    for (const [id, run] of this.recent) {
      const ended = run.state.endedAt ? Date.parse(run.state.endedAt) : now;
      if (this.recent.size > RECENT_KEEP || now - ended > RECENT_TTL_MS) {
        this.recent.delete(id);
      }
    }
  }

  private async logActivity(run: Run, status: GenerationStatus) {
    const { state } = run;
    const level =
      status === "completed" ? "success" : status === "failed" ? "error" : "info";
    const detail =
      status === "completed"
        ? `${formatNumber(state.outputChars)} characters${
            state.usage?.totalTokens
              ? ` · ${formatNumber(state.usage.totalTokens)} tokens`
              : ""
          }${state.durationMs ? ` · ${(state.durationMs / 1000).toFixed(1)}s` : ""}`
        : status === "cancelled"
          ? `Stopped after ${formatNumber(state.outputChars)} characters`
          : state.error?.message ?? "Generation failed";
    await db.activityEvent.create({
      data: {
        type: `generation.${status}`,
        level,
        title:
          status === "completed"
            ? `Completed: ${state.conversationTitle ?? "Conversation"}`
            : status === "cancelled"
              ? `Stopped: ${state.conversationTitle ?? "Conversation"}`
              : status === "failed"
                ? `Failed: ${state.conversationTitle ?? "Conversation"}`
                : `Generation: ${state.conversationTitle ?? "Conversation"}`,
        detail,
        conversationId: state.conversationId,
        conversationTitle: state.conversationTitle,
        generationId: state.id,
        providerId: state.providerId,
      },
    });
  }

  // ------------------------------------------------------------------
  // Introspection / control
  // ------------------------------------------------------------------

  stop(id: string): { ok: boolean; status: string } {
    const run = this.runs.get(id);
    if (!run || isTerminal(run.state.status)) {
      return { ok: false, status: run?.state.status ?? "unknown" };
    }
    run.abortReason = "user";
    run.controller.abort();
    return { ok: true, status: "cancelling" };
  }

  stopAll(): number {
    let n = 0;
    for (const run of this.runs.values()) {
      if (!isTerminal(run.state.status)) {
        run.abortReason = "user";
        run.controller.abort();
        n++;
      }
    }
    return n;
  }

  subscribe(id: string, cb: (ev: RuntimeEvent) => void): (() => void) | null {
    const run = this.runs.get(id);
    if (!run || isTerminal(run.state.status)) return null;
    run.listeners.add(cb);
    return () => {
      run.listeners.delete(cb);
    };
  }

  /** Live state for a generation (active or recently finished in memory). */
  getLive(id: string): PublicGenerationState | null {
    const run = this.runs.get(id) ?? this.recent.get(id);
    return run ? this.cloneState(run.state) : null;
  }

  activeStates(): PublicGenerationState[] {
    return [...this.runs.values()]
      .filter((r) => !isTerminal(r.state.status))
      .map((r) => this.cloneState(r.state));
  }

  /** Snapshot from memory, falling back to the database (terminal runs). */
  async snapshot(id: string): Promise<PublicGenerationState | null> {
    await this.ensureRecovered();
    const live = this.getLive(id);
    if (live) return live;
    const row = await db.generation.findUnique({
      where: { id },
      include: { conversation: { select: { title: true } } },
    });
    if (!row) return null;
    const message = row.messageId
      ? await db.message.findUnique({ where: { id: row.messageId } })
      : null;
    return {
      id: row.id,
      conversationId: row.conversationId,
      conversationTitle: row.conversation?.title ?? null,
      messageId: row.messageId,
      providerId: row.providerId,
      providerName: row.providerName,
      modelKey: row.modelKey,
      status: row.status as GenerationStatus,
      text: message?.content ?? "",
      reasoning: message?.reasoning ?? "",
      outputChars: row.outputChars,
      usage: safeParseUsage(row.usage),
      error: safeParseError(row.error),
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt?.toISOString() ?? null,
      durationMs: row.durationMs,
    };
  }

  private emit(run: Run, ev: RuntimeEvent) {
    for (const cb of run.listeners) {
      try {
        cb(ev);
      } catch {
        /* listener detached */
      }
    }
  }

  private cloneState(s: PublicGenerationState): PublicGenerationState {
    return {
      ...s,
      usage: s.usage ? { ...s.usage } : null,
      error: s.error ? { ...s.error } : null,
    };
  }
}

// ---------------------------------------------------------------------------
// utils
// ---------------------------------------------------------------------------

function safeParseHeaders(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string") out[k] = v;
      }
      return out;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function safeParseUsage(raw: string | null | undefined): Usage | null {
  if (!raw) return null;
  try {
    const u = JSON.parse(raw);
    return {
      inputTokens: u.inputTokens ?? undefined,
      outputTokens: u.outputTokens ?? undefined,
      totalTokens: u.totalTokens ?? undefined,
    };
  } catch {
    return null;
  }
}

function safeParseError(raw: string | null | undefined): FriendlyError | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatNumber(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

// Singleton — survives Next.js dev hot reloads.
const globalForManager = globalThis as unknown as {
  __mythicalmind_manager?: GenerationManager;
};

export const generationManager: GenerationManager =
  globalForManager.__mythicalmind_manager ?? new GenerationManager();

if (process.env.NODE_ENV !== "production") {
  globalForManager.__mythicalmind_manager = generationManager;
}
