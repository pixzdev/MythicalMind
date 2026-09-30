// MythicalMind — client runtime bridge.
//
// A module-level singleton that owns EventSource connections to the server's
// Generation Runtime. It is NOT tied to any React component: generations keep
// streaming into it while the user navigates anywhere in the workspace.
// Components subscribe (batched, ~90ms) and re-render only when their
// conversation's version changes.

import type { QueryClient } from "@tanstack/react-query";
import type {
  FriendlyError,
  GenerationStatus,
  PublicGenerationState,
  RuntimeEvent,
  Usage,
} from "@/lib/types";
import { isTerminal } from "@/lib/types";

export interface LiveRun {
  id: string;
  conversationId: string;
  state: PublicGenerationState;
  /** bumps on every delta — conversation subscribers re-render */
  version: number;
  es: EventSource | null;
  lastEventAt: number;
}

const FLUSH_INTERVAL_MS = 90;
const TERMINAL_KEEP_MS = 5 * 60 * 1000;

class RuntimeClient {
  private runs = new Map<string, LiveRun>();
  private convListeners = new Map<string, Set<() => void>>();
  private globalListeners = new Set<() => void>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private queryClient: QueryClient | null = null;
  private completionHandler: ((run: LiveRun) => void) | null = null;
  /** bumped only on structural changes (run added/removed/status) — not per token */
  private structureVersion = 0;

  setQueryClient(qc: QueryClient) {
    this.queryClient = qc;
  }

  setCompletionHandler(fn: ((run: LiveRun) => void) | null) {
    this.completionHandler = fn;
  }

  // ------------------------------------------------------------------
  // Connections
  // ------------------------------------------------------------------

  connect(gen: { id: string; conversationId: string }): LiveRun {
    const existing = this.runs.get(gen.id);
    if (existing) {
      if (isTerminal(existing.state.status) && existing.es) {
        existing.es.close();
        existing.es = null;
      }
      return existing;
    }

    const run: LiveRun = {
      id: gen.id,
      conversationId: gen.conversationId,
      state: {
        id: gen.id,
        conversationId: gen.conversationId,
        conversationTitle: null,
        messageId: null,
        providerId: "",
        providerName: "",
        modelKey: "",
        status: "queued",
        text: "",
        reasoning: "",
        outputChars: 0,
        usage: null,
        error: null,
        startedAt: new Date().toISOString(),
        endedAt: null,
        durationMs: null,
      },
      version: 0,
      es: null,
      lastEventAt: Date.now(),
    };
    this.runs.set(gen.id, run);
    this.structureVersion++;
    this.openSocket(run);
    this.flush();
    return run;
  }

  private openSocket(run: LiveRun) {
    if (typeof window === "undefined") return;
    try {
      const es = new EventSource(`/api/generations/${run.id}/events`);
      run.es = es;
      es.onmessage = (ev: MessageEvent) => {
        run.lastEventAt = Date.now();
        try {
          this.handleEvent(run, JSON.parse(ev.data as string) as RuntimeEvent);
        } catch {
          /* malformed frame — ignored */
        }
      };
      es.onerror = () => {
        // EventSource reconnects automatically and the server replays a
        // snapshot, which resynchronizes us. Terminal runs just close.
        if (isTerminal(run.state.status)) {
          es.close();
          run.es = null;
        }
      };
    } catch {
      /* SSE unavailable (e.g. very old browser) */
    }
  }

  private handleEvent(run: LiveRun, ev: RuntimeEvent) {
    const s = run.state;
    switch (ev.type) {
      case "snapshot": {
        const st = ev.state;
        s.text = st.text;
        s.reasoning = st.reasoning;
        s.status = st.status;
        s.usage = st.usage;
        s.error = st.error;
        s.outputChars = st.outputChars;
        s.providerId = st.providerId;
        s.providerName = st.providerName;
        s.modelKey = st.modelKey;
        s.conversationTitle = st.conversationTitle;
        s.messageId = st.messageId;
        s.startedAt = st.startedAt;
        run.version++;
        this.structureVersion++;
        this.flush();
        break;
      }
      case "text-delta":
        s.text += ev.text;
        s.outputChars = s.text.length;
        run.version++;
        this.scheduleFlush();
        break;
      case "reasoning-delta":
        s.reasoning += ev.text;
        run.version++;
        this.scheduleFlush();
        break;
      case "usage":
        s.usage = ev.usage;
        run.version++;
        this.scheduleFlush();
        break;
      case "status":
        s.status = ev.status;
        if (ev.error !== undefined) s.error = ev.error ?? null;
        run.version++;
        this.structureVersion++;
        this.flush();
        break;
      case "done": {
        const st = ev.state;
        s.text = st.text;
        s.reasoning = st.reasoning;
        s.status = st.status;
        s.usage = st.usage;
        s.error = st.error;
        s.durationMs = st.durationMs;
        s.endedAt = st.endedAt;
        s.outputChars = st.outputChars;
        run.version++;
        this.structureVersion++;
        if (run.es) {
          run.es.close();
          run.es = null;
        }
        this.flush();
        this.invalidate(st);
        try {
          this.completionHandler?.(run);
        } catch {
          /* handler detached */
        }
        // keep the terminal run around briefly so late subscribers can read
        // final state before the persisted refetch lands
        setTimeout(() => {
          if (this.runs.get(run.id) === run) {
            this.runs.delete(run.id);
            this.structureVersion++;
            this.flush();
          }
        }, TERMINAL_KEEP_MS);
        break;
      }
    }
  }

  // ------------------------------------------------------------------
  // Notification (batched)
  // ------------------------------------------------------------------

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  private flush() {
    for (const set of this.convListeners.values()) {
      for (const cb of set) cb();
    }
    for (const cb of this.globalListeners) cb();
  }

  private invalidate(state: PublicGenerationState) {
    const qc = this.queryClient;
    if (!qc) return;
    void qc.invalidateQueries({ queryKey: ["conversation", state.conversationId] });
    void qc.invalidateQueries({ queryKey: ["conversations"] });
    void qc.invalidateQueries({ queryKey: ["generations"] });
    void qc.invalidateQueries({ queryKey: ["activity"] });
  }

  // ------------------------------------------------------------------
  // Subscriptions & reads
  // ------------------------------------------------------------------

  subscribeConversation(conversationId: string, cb: () => void): () => void {
    let set = this.convListeners.get(conversationId);
    if (!set) {
      set = new Set();
      this.convListeners.set(conversationId, set);
    }
    set.add(cb);
    return () => {
      set?.delete(cb);
      if (set && set.size === 0) this.convListeners.delete(conversationId);
    };
  }

  subscribeGlobal(cb: () => void): () => void {
    this.globalListeners.add(cb);
    return () => {
      this.globalListeners.delete(cb);
    };
  }

  getConversationRun(conversationId: string): LiveRun | null {
    let terminal: LiveRun | null = null;
    for (const run of this.runs.values()) {
      if (run.conversationId !== conversationId) continue;
      if (!isTerminal(run.state.status)) return run;
      terminal = run;
    }
    return terminal;
  }

  getRun(id: string): LiveRun | null {
    return this.runs.get(id) ?? null;
  }

  activeRuns(): LiveRun[] {
    return [...this.runs.values()].filter((r) => !isTerminal(r.state.status));
  }

  allRuns(): LiveRun[] {
    return [...this.runs.values()];
  }

  /** Stable snapshot key for useSyncExternalStore (per conversation). */
  conversationKey(conversationId: string): string {
    const run = this.getConversationRun(conversationId);
    return run ? `${run.id}:${run.version}` : "none";
  }

  /** Stable key for global (structural) listeners. */
  globalKey(): number {
    return this.structureVersion;
  }

  // ------------------------------------------------------------------
  // Boot / resync
  // ------------------------------------------------------------------

  async syncActive(): Promise<number> {
    try {
      const res = await fetch("/api/generations?scope=active", {
        cache: "no-store",
      });
      if (!res.ok) return 0;
      const data = (await res.json()) as {
        generations: PublicGenerationState[];
      };
      for (const gen of data.generations) {
        this.connect({ id: gen.id, conversationId: gen.conversationId });
      }
      return data.generations.length;
    } catch {
      return 0;
    }
  }
}

export const runtime = new RuntimeClient();
