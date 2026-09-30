// Activity: real events emitted by the runtime — generation lifecycle,
// provider connections, workspace operations. Not a developer log.

"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  XCircle,
  Zap,
  CircleSlash,
  Server,
  PlusCircle,
  Trash2,
  Clock,
  TriangleAlert,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { relativeTime, wallClock } from "@/lib/format";
import { useActivity } from "@/hooks/mythicalmind/queries";
import { useWorkspace } from "@/store/workspace-store";
import type { ActivityDTO } from "@/lib/types";

const ICONS: Record<string, React.ElementType> = {
  "generation.completed": CheckCircle2,
  "generation.failed": XCircle,
  "generation.cancelled": CircleSlash,
  "generation.started": Zap,
  "provider.connected": Server,
  "provider.error": TriangleAlert,
  "provider.added": PlusCircle,
  "provider.removed": Trash2,
  "provider.models_discovered": Server,
  "workspace.cleared": Trash2,
};

export function ActivityPage() {
  const { data: events, isLoading } = useActivity(120);
  const openConversation = useWorkspace((s) => s.openConversation);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full px-4 sm:px-8 py-7">
        <h1 className="text-[19px] font-semibold tracking-tight mb-1.5">
          Activity
        </h1>
        <p className="text-[13px] text-muted-foreground mb-6 leading-relaxed">
          What the runtime has actually done — generations, provider
          connections, workspace changes. Refreshes live.
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : (events ?? []).length === 0 ? (
          <div className="rounded-xl border border-white/7 bg-white/[0.018] px-4 py-8 text-center text-[12.5px] text-muted-foreground/70">
            Nothing yet — run a generation or connect a provider.
          </div>
        ) : (
          <div className="relative pl-1">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-white/10 via-white/6 to-transparent" />
            <div className="space-y-1">
              {(events ?? []).map((event) => (
                <ActivityRow
                  key={event.id}
                  event={event}
                  onOpen={
                    event.conversationId
                      ? () => openConversation(event.conversationId!)
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityRow({
  event,
  onOpen,
}: {
  event: ActivityDTO;
  onOpen?: () => void;
}) {
  const Icon =
    ICONS[event.type] ??
    (event.level === "error" ? XCircle : event.level === "warn" ? TriangleAlert : Info);

  return (
    <button
      onClick={onOpen}
      disabled={!onOpen}
      className={cn(
        "group relative w-full flex items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors",
        onOpen && "hover:bg-white/[0.035]"
      )}
    >
      <span
        className={cn(
          "relative z-10 flex size-7 flex-none items-center justify-center rounded-lg border bg-[#070b14]",
          event.level === "success" && "border-emerald-400/25 text-emerald-300/90",
          event.level === "error" && "border-destructive/25 text-destructive",
          event.level === "warn" && "border-amber-400/25 text-amber-300/90",
          event.level === "info" && "border-white/10 text-muted-foreground"
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 pt-0.5">
        <span className="flex items-baseline gap-2">
          <span className="text-[13px] text-foreground/90 line-clamp-2 leading-snug break-words">
            {event.title}
          </span>
          <span className="text-[10.5px] text-muted-foreground/50 flex-none tabular-nums">
            {relativeTime(event.createdAt)}
          </span>
        </span>
        {event.detail && (
          <span className="block text-[11.5px] text-muted-foreground/70 leading-relaxed mt-0.5 line-clamp-2">
            {event.detail}
          </span>
        )}
      </span>
      <span className="text-[10px] text-muted-foreground/35 pt-1.5 flex-none hidden sm:block tabular-nums">
        {wallClock(event.createdAt)}
      </span>
    </button>
  );
}
