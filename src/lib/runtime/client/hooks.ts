// React hooks over the RuntimeClient singleton.
// useSyncExternalStore with stable string keys keeps re-renders surgical:
// only the conversation view of the affected generation re-renders per batch.

"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { runtime, type LiveRun } from "./runtime-client";

/** Live generation state for one conversation (null when none). */
export function useLiveGeneration(conversationId: string | null): {
  run: LiveRun | null;
  key: string;
} {
  const subscribe = useCallback(
    (cb: () => void) =>
      conversationId
        ? runtime.subscribeConversation(conversationId, cb)
        : () => undefined,
    [conversationId]
  );
  const key = useSyncExternalStore(
    subscribe,
    () => (conversationId ? runtime.conversationKey(conversationId) : "none"),
    () => "none"
  );
  const run = conversationId ? runtime.getConversationRun(conversationId) : null;
  return { run, key };
}

/** Structural live-run list (topbar badge, tasks view). No per-token re-renders. */
export function useActiveRuns(): LiveRun[] {
  const key = useSyncExternalStore(
    (cb) => runtime.subscribeGlobal(cb),
    () => runtime.globalKey(),
    () => 0
  );
  return runtime.activeRuns();
}

/** All known runs (active + recently terminal) for the tasks view. */
export function useAllRuns(): LiveRun[] {
  useSyncExternalStore(
    (cb) => runtime.subscribeGlobal(cb),
    () => runtime.globalKey(),
    () => 0
  );
  return runtime.allRuns();
}

/** Ticking clock for elapsed-time displays (1s cadence, no runtime coupling). */
export function useTicker(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

/** Reads a value from a live run with a gentle refresh cadence (for chars/tokens). */
export function useRunMeter(run: LiveRun | null): number {
  const [version, setVersion] = useState(0);
  const lastRef = useRef(0);
  useEffect(() => {
    if (!run) return;
    const id = setInterval(() => {
      if (run.version !== lastRef.current) {
        lastRef.current = run.version;
        setVersion((v) => v + 1);
      }
    }, 500);
    return () => clearInterval(id);
  }, [run?.id]);
  void version;
  return run?.state.outputChars ?? 0;
}
