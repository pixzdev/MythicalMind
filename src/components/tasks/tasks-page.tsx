// Tasks: the user-facing runtime overview — active generations (live, with
// stop controls) and the durable history of every run.

"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Square,
  ArrowUpRight,
  Zap,
  CheckCircle2,
  XCircle,
  CircleSlash,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCount, formatDuration, relativeTime } from "@/lib/format";
import { useWorkspace } from "@/store/workspace-store";
import {
  useActiveRuns,
  useTicker,
} from "@/lib/runtime/client/hooks";
import { useGenerations, useStopGeneration } from "@/hooks/mythicalmind/queries";
import type { GenerationStatus } from "@/lib/types";

const STATUS_META: Record<
  GenerationStatus,
  { label: string; className: string; icon: React.ElementType }
> = {
  queued: {
    label: "Queued",
    className: "text-amber-300/90 bg-amber-400/10 border-amber-400/20",
    icon: Clock,
  },
  streaming: {
    label: "Streaming",
    className: "text-[var(--aurora-accent-2)] bg-[var(--aurora-accent)]/12 border-[var(--aurora-accent)]/25",
    icon: Zap,
  },
  completed: {
    label: "Completed",
    className: "text-emerald-300/90 bg-emerald-400/10 border-emerald-400/20",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    className: "text-destructive/90 bg-destructive/10 border-destructive/25",
    icon: XCircle,
  },
  cancelled: {
    label: "Stopped",
    className: "text-muted-foreground bg-white/[0.04] border-white/10",
    icon: CircleSlash,
  },
};

export function TasksPage() {
  const active = useActiveRuns();
  const { data: history, isLoading } = useGenerations(120);
  const stop = useStopGeneration();
  const openConversation = useWorkspace((s) => s.openConversation);
  const now = useTicker(active.length > 0);

  const historical = (history ?? []).filter(
    (g) => !active.some((r) => r.id === g.id)
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-8 py-7 space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-[19px] font-semibold tracking-tight">Tasks</h1>
            {active.length > 0 && (
              <Badge className="bg-[var(--aurora-accent)]/15 text-[var(--aurora-accent-2)] border-[var(--aurora-accent)]/25 font-normal">
                {active.length} running
              </Badge>
            )}
          </div>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Every generation is an independent runtime job — streaming
            continues while you work elsewhere, and stopping one never touches
            the others.
          </p>
        </div>

        {/* Active */}
        <section aria-label="Active generations">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60 mb-2.5">
            Active
          </h2>
          {active.length === 0 ? (
            <div className="rounded-xl border border-white/7 bg-white/[0.018] px-4 py-5 text-[12.5px] text-muted-foreground/70">
              No generations running right now.
            </div>
          ) : (
            <div className="space-y-2">
              {active.map((run) => {
                const s = run.state;
                const elapsed = Math.max(0, now - new Date(s.startedAt).getTime());
                const meta = STATUS_META[s.status];
                return (
                  <div
                    key={run.id}
                    className="rounded-xl border border-[var(--aurora-accent)]/20 bg-[var(--aurora-accent)]/[0.05] p-3.5 flex items-center gap-3"
                  >
                    <meta.icon className="size-4 text-[var(--aurora-accent-2)] flex-none" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openConversation(s.conversationId)}
                          className="text-[13px] font-medium truncate hover:underline"
                        >
                          {s.conversationTitle ?? "Conversation"}
                        </button>
                        <Badge
                          variant="outline"
                          className={cn("h-5 px-1.5 text-[9.5px] border", meta.className)}
                        >
                          {s.status === "streaming" && (
                            <span className="size-1.5 rounded-full bg-current status-dot-live mr-1" />
                          )}
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground/70 mt-0.5 flex flex-wrap gap-x-3">
                        <span>{s.providerName}</span>
                        <span className="font-mono">{s.modelKey}</span>
                        <span className="tabular-nums">{formatDuration(elapsed)}</span>
                        <span className="tabular-nums">
                          {formatCount(s.outputChars)} chars
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-[11.5px] text-destructive hover:text-destructive hover:bg-destructive/10 flex-none"
                      onClick={() => stop.mutate(run.id)}
                      aria-label={`Stop ${s.conversationTitle}`}
                    >
                      <Square className="size-3 fill-current" /> Stop
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* History */}
        <section aria-label="Generation history">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60 mb-2.5">
            History
          </h2>
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : historical.length === 0 ? (
            <div className="rounded-xl border border-white/7 bg-white/[0.018] px-4 py-5 text-[12.5px] text-muted-foreground/70">
              Completed generations will be listed here.
            </div>
          ) : (
            <div className="rounded-xl border border-white/8 overflow-hidden divide-y divide-white/5">
              {historical.slice(0, 80).map((g) => {
                const meta = STATUS_META[g.status];
                return (
                  <button
                    key={g.id}
                    onClick={() => g.conversationId && openConversation(g.conversationId)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
                  >
                    <meta.icon
                      className={cn(
                        "size-3.5 flex-none",
                        g.status === "completed" && "text-emerald-400/80",
                        g.status === "failed" && "text-destructive/80",
                        g.status === "cancelled" && "text-muted-foreground/60"
                      )}
                    />
                    <span className="text-[12.5px] truncate flex-1 min-w-0">
                      {g.conversationTitle ?? "Conversation"}
                    </span>
                    <span className="hidden sm:block text-[11px] text-muted-foreground/60 font-mono truncate max-w-[130px]">
                      {g.modelKey}
                    </span>
                    {g.usage?.totalTokens != null ? (
                      <span className="text-[11px] text-muted-foreground/70 tabular-nums w-[74px] text-right hidden sm:block">
                        {formatCount(g.usage.totalTokens)} tok
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/50 tabular-nums w-[74px] text-right hidden sm:block">
                        {formatCount(g.outputChars)} ch
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground/70 tabular-nums w-[46px] text-right">
                      {g.durationMs ? `${(g.durationMs / 1000).toFixed(0)}s` : "—"}
                    </span>
                    <span className="hidden md:block text-[11px] text-muted-foreground/50 w-[70px] text-right tabular-nums">
                      {g.endedAt ? relativeTime(g.endedAt) : "—"}
                    </span>
                    <ArrowUpRight className="size-3 text-muted-foreground/35 flex-none" />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
