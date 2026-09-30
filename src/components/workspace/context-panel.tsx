// Context panel (right rail / mobile sheet): runtime overview, live
// generation telemetry, conversation info, system prompt, model switch.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Cpu,
  Square,
  Sparkles,
  Save,
  Clock,
  Gauge,
  ArrowUpRight,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCount, formatDuration, relativeTime } from "@/lib/format";
import { useWorkspace } from "@/store/workspace-store";
import {
  useActiveRuns,
  useLiveGeneration,
  useRunMeter,
  useTicker,
} from "@/lib/runtime/client/hooks";
import {
  useConversation,
  useStopGeneration,
  useUpdateConversation,
} from "@/hooks/mythicalmind/queries";
import { ModelPicker } from "@/components/chat/model-picker";

function SystemPromptEditor({
  conversationId,
  initialPrompt,
}: {
  conversationId: string;
  initialPrompt: string;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const updateConversation = useUpdateConversation();
  const dirty = prompt !== initialPrompt;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground/70">
          System prompt
        </span>
        {dirty && (
          <Button
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() =>
              updateConversation.mutate({
                id: conversationId,
                systemPrompt: prompt.trim() || null,
              })
          }
          >
            <Save className="size-3" /> Simpan
          </Button>
        )}
      </div>
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Instruksi yang diterapkan pada setiap permintaan di percakapan ini…"
        className="min-h-[110px] text-[12.5px] bg-white/[0.03] border-white/8 resize-y font-normal"
        aria-label="System prompt"
      />
    </div>
  );
}

function LiveGenerationCard({
  conversationId,
}: {
  conversationId: string;
}) {
  const { run } = useLiveGeneration(conversationId);
  const stop = useStopGeneration();
  const now = useTicker(Boolean(run && run.state.status === "streaming"));
  const chars = useRunMeter(run);

  if (!run) return null;

  const s = run.state;
  const isRunning = s.status === "streaming" || s.status === "queued";
  const elapsed = now - new Date(s.startedAt).getTime();

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "size-2 rounded-full",
              s.status === "streaming" && "bg-[var(--aurora-accent-2)] status-dot-live",
              s.status === "queued" && "bg-amber-400/80",
              s.status === "failed" && "bg-destructive",
              s.status === "cancelled" && "bg-muted-foreground/60",
              s.status === "completed" && "bg-emerald-400/80"
            )}
          />
          <span className="text-[13px] font-medium truncate">
            {s.status === "streaming"
              ? "Sedang menulis"
              : s.status === "queued"
                ? "Antre"
                : s.status === "failed"
                  ? "Gagal"
                  : s.status === "cancelled"
                    ? "Dihentikan"
                    : "Selesai"}
          </span>
        </div>
        {isRunning && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-[12px] text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => stop.mutate(run.id)}
            aria-label="Hentikan generasi"
          >
            <Square className="size-3" /> Hentikan
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
        <span className="text-muted-foreground/70">Penyedia</span>
        <span className="text-right text-foreground/85 truncate">{s.providerName || "—"}</span>
        <span className="text-muted-foreground/70">Model</span>
        <span className="text-right font-mono text-[11px] text-foreground/85 truncate">
          {s.modelKey || "—"}
        </span>
        {isRunning && (
          <>
            <span className="text-muted-foreground/70">Berjalan</span>
            <span className="text-right tabular-nums text-foreground/85">
              {formatDuration(Math.max(0, elapsed))}
            </span>
            <span className="text-muted-foreground/70">Keluaran</span>
            <span className="text-right tabular-nums text-foreground/85">
              {formatCount(chars)} karakter
            </span>
          </>
        )}
        {!isRunning && s.durationMs != null && (
          <>
            <span className="text-muted-foreground/70">Durasi</span>
            <span className="text-right tabular-nums text-foreground/85">
              {formatDuration(s.durationMs)}
            </span>
          </>
        )}
        {s.usage?.totalTokens != null && (
          <>
            <span className="text-muted-foreground/70">Token</span>
            <span className="text-right tabular-nums text-foreground/85">
              {formatCount(s.usage.totalTokens)}
            </span>
          </>
        )}
      </div>

      {s.error && (
        <p className="text-[11.5px] leading-relaxed text-destructive/90">
          {s.error.message}
        </p>
      )}
    </div>
  );
}

export function ContextPanel({ onDone }: { onDone?: () => void }) {
  const { conversationId, openConversation, setView } = useWorkspace();
  const { data: detail } = useConversation(conversationId);
  const activeRuns = useActiveRuns();
  const updateConversation = useUpdateConversation();

  const conversation = detail?.conversation;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-5">
      {/* Runtime — always visible */}
      <section aria-label="Runtime">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
            <Cpu className="size-3" /> Runtime
          </h2>
          {activeRuns.length > 0 && (
            <Badge
              variant="secondary"
              className="h-5 px-1.5 text-[10.5px] bg-[var(--aurora-accent)]/15 text-[var(--aurora-accent-2)] border-[var(--aurora-accent)]/25"
            >
              {activeRuns.length} aktif
            </Badge>
          )}
        </div>

        {conversationId && <LiveGenerationCard conversationId={conversationId} />}

        {activeRuns.filter((r) => r.conversationId !== conversationId).length > 0 && (
          <div className="mt-2 space-y-1.5">
            <div className="text-[10.5px] text-muted-foreground/60 pt-1">
              Percakapan lain
            </div>
            {activeRuns
              .filter((r) => r.conversationId !== conversationId)
              .map((r) => (
                <button
                  key={r.id}
                  onClick={() => openConversation(r.conversationId)}
                  className="w-full flex items-center gap-2 rounded-lg border border-white/6 bg-white/[0.02] px-2.5 py-2 text-left hover:bg-white/[0.05] transition-colors"
                >
                  <span className="size-1.5 rounded-full bg-[var(--aurora-accent-2)] status-dot-live" />
                  <span className="text-[12px] truncate flex-1">
                    {r.state.conversationTitle ?? "Percakapan"}
                  </span>
                  <span className="text-[10.5px] text-muted-foreground/60 font-mono truncate max-w-[90px]">
                    {r.state.modelKey}
                  </span>
                </button>
              ))}
          </div>
        )}

        {activeRuns.length === 0 && (
          <div className="rounded-xl border border-white/6 bg-white/[0.015] px-3 py-4 text-[12px] text-muted-foreground/70 leading-relaxed">
            Tidak ada generasi aktif. Runtime tetap mengalir walau kamu
            berpindah halaman atau memuat ulang.
          </div>
        )}
      </section>

      <Separator className="opacity-60" />

      {/* Conversation context */}
      {conversation ? (
        <section aria-label="Conversation context" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
              <Sparkles className="size-3" /> Percakapan
            </h2>
            <span className="text-[10.5px] text-muted-foreground/55">
              {relativeTime(conversation.updatedAt)}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] text-muted-foreground/70">Model aktif</div>
            <ModelPicker
              compact
              providerId={conversation.providerId}
              modelKey={conversation.modelKey}
              onPick={(sel) =>
                updateConversation.mutate({
                  id: conversation.id,
                  providerId: sel.providerId,
                  modelKey: sel.modelKey,
                })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
            <span className="text-muted-foreground/70">Pesan</span>
            <span className="text-right text-foreground/85 tabular-nums">
              {conversation.messages.length}
            </span>
            {conversation.agentName && (
              <>
                <span className="text-muted-foreground/70">Agent</span>
                <span className="text-right text-foreground/85 truncate">
                  {conversation.agentName}
                </span>
              </>
            )}
            <span className="text-muted-foreground/70">Dibuat</span>
            <span className="text-right text-foreground/85">
              {relativeTime(conversation.createdAt)}
            </span>
          </div>

          <SystemPromptEditor
            key={conversation.id}
            conversationId={conversation.id}
            initialPrompt={conversation.systemPrompt ?? ""}
          />
        </section>
      ) : (
        <section className="rounded-xl border border-white/6 bg-white/[0.015] p-3.5 flex gap-2.5 text-[12px] text-muted-foreground/75 leading-relaxed">
          <Info className="size-4 flex-none mt-0.5 text-[var(--aurora-accent-2)]/80" />
          <div>
            Pilih percakapan untuk melihat konteks, model, dan system prompt-nya.
            <button
              className="ml-1.5 inline-flex items-center gap-1 text-[var(--aurora-accent-2)] hover:underline"
              onClick={() => {
                setView("conversations");
                onDone?.();
              }}
            >
              Lihat semua percakapan <ArrowUpRight className="size-3" />
            </button>
          </div>
        </section>
      )}

      <div className="mt-auto pt-2 text-[10.5px] text-muted-foreground/40 flex items-center gap-2">
        <Clock className="size-3" />
        <Gauge className="size-3" />
        <span>MythicalMind runtime · provider-agnostic</span>
      </div>
    </div>
  );
}
