// The LIVE message: subscribes to the runtime bridge for this conversation
// and renders streamed tokens (batched at ~90ms). If the bridge has no run
// (e.g. reconnecting after a refresh), it falls back to persisted content
// and shows a reconnecting state — never a blank message.

"use client";

import { useState } from "react";
import { useLiveGeneration, useTicker, useRunMeter } from "@/lib/runtime/client/hooks";
import { Markdown } from "./markdown";
import { ReasoningBlock } from "./message-item";
import { wallClock, formatCount, formatDuration } from "@/lib/format";
import type { MessageDTO } from "@/lib/types";
import { isTerminal } from "@/lib/types";
import { AlertTriangle, RefreshCw, Sparkle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StreamingMessage({
  message,
  isLast,
  onRetry,
}: {
  message: MessageDTO;
  isLast: boolean;
  onRetry: () => void;
}) {
  const { run } = useLiveGeneration(message.conversationId);
  const now = useTicker(Boolean(run && !isTerminal(run.state.status)));
  const chars = useRunMeter(run);
  const [showedError, setShowedError] = useState(false);

  const live = Boolean(run && (run.state.messageId === message.id || run.id === message.generationId));
  const text = live && run ? run.state.text : message.content;
  const reasoning = live && run ? run.state.reasoning : message.reasoning ?? "";
  const status = live && run ? run.state.status : message.status;
  const error = live && run ? run.state.error : message.error;
  const modelKey = live && run ? run.state.modelKey : message.modelKey;
  const providerName = live && run ? run.state.providerName : message.providerName;

  const isLive = Boolean(live && run && !isTerminal(status));
  const elapsed = live && run ? Math.max(0, now - new Date(run.state.startedAt).getTime()) : 0;

  // When the run just terminated with an error, surface it once.
  const justFailed = isLive === false && live && run && run.state.status === "failed" && run.state.error;
  if (justFailed && !showedError) setShowedError(true);

  return (
    <article className="message-in" aria-label="Pesan asisten (streaming)">
      <div className="flex items-center gap-2 mb-2">
        <span className="relative flex size-5.5 items-center justify-center rounded-md bg-gradient-to-br from-[var(--aurora-accent)]/25 to-[var(--aurora-accent-2)]/20 border border-white/8 flex-none">
          <Sparkle className="size-3 text-[var(--aurora-accent-2)]" />
          {isLive && (
            <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-[var(--aurora-accent-2)] status-dot-live" />
          )}
        </span>
        <span className="text-[12px] font-medium text-foreground/90">
          {providerName ?? "Asisten"}
        </span>
        <span className="text-[11px] font-mono text-muted-foreground/55 truncate hidden sm:inline">
          {modelKey ?? ""}
        </span>
        <span className="text-[10.5px] text-muted-foreground/45 tabular-nums">
          {wallClock(message.createdAt)}
        </span>
      </div>

      {reasoning && <ReasoningBlock reasoning={reasoning} />}

      {text ? (
        <>
          <Markdown text={text} streaming={isLive} />
          {isLive && <span className="streaming-caret" aria-hidden="true" />}
        </>
      ) : (
        isLive && (
          <div className="flex items-center gap-2 h-6 text-[12.5px] text-muted-foreground">
            {status === "queued" ? (
              <>Antre…</>
            ) : (
              <>
                <span className="size-1.5 rounded-full bg-[var(--aurora-accent-2)] status-dot-live" />
                Menyambung ke {providerName ?? "penyedia"}…
              </>
            )}
          </div>
        )
      )}

      {isLive && (
        <div className="mt-2.5 flex items-center gap-3 text-[11px] text-muted-foreground/60 rounded-lg border border-[var(--aurora-accent)]/15 bg-[var(--aurora-accent)]/[0.06] px-3 py-1.5 w-fit">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[var(--aurora-accent-2)] status-dot-live" />
            {status === "queued" ? "Antre" : "Menulis"}
          </span>
          <span className="tabular-nums">{formatDuration(elapsed)}</span>
          <span className="tabular-nums">{formatCount(chars)} karakter</span>
          {!live && <span className="text-amber-400/70">menyambung ulang…</span>}
        </div>
      )}

      {!isLive && justFailed && error && (
        <div className="mt-2.5 rounded-xl border border-destructive/25 bg-destructive/[0.06] px-4 py-3.5 space-y-2">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="size-4 text-destructive/90 mt-0.5 flex-none" />
            <div>
              <div className="text-[13px] font-medium text-foreground/90">
                Generasi gagal
              </div>
              <div className="text-[12.5px] text-muted-foreground leading-relaxed mt-0.5">
                {error.message}
              </div>
              {"hint" in error && error.hint && (
                <div className="text-[11.5px] text-muted-foreground/70 mt-1 leading-relaxed">
                  {error.hint}
                </div>
              )}
            </div>
          </div>
          {isLast && (
            <div className="pl-6.5">
              <Button size="sm" className="h-7 text-[12px]" onClick={onRetry}>
                <RefreshCw className="size-3" /> Coba lagi
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
