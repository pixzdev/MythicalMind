// Composer: a compact command console. Auto-growing multiline input,
// Enter to send, Shift+Enter for newline, provider·model selector,
// send ↔ stop while a generation is live. Drafts persist per conversation.

"use client";

import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/store/workspace-store";
import { useLiveGeneration } from "@/lib/runtime/client/hooks";
import { isTerminal } from "@/lib/types";

export function Composer({
  conversationId,
  providerId,
  modelKey,
  onModelChange,
  onSend,
  onStop,
  busy,
}: {
  conversationId: string;
  providerId: string | null;
  modelKey: string | null;
  onModelChange: (providerId: string | null, modelKey: string | null) => void;
  onSend: (content: string) => void;
  onStop: () => void;
  busy: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const drafts = useWorkspace((s) => s.drafts);
  const setDraft = useWorkspace((s) => s.setDraft);
  const { run } = useLiveGeneration(conversationId);
  const generating = Boolean(run && !isTerminal(run.state.status));

  const value = drafts[conversationId] ?? "";

  const autosize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, []);

  useEffect(() => {
    autosize();
  }, [value, autosize]);

  const send = useCallback(() => {
    const content = value.trim();
    if (!content || busy) return;
    setDraft(conversationId, "");
    onSend(content);
  }, [value, busy, setDraft, conversationId, onSend]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex-none pb-3 sm:pb-4 px-3 sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="max-w-[48rem] mx-auto w-full">
        <div
          className={cn(
            "rounded-2xl border transition-all duration-200 glass",
            generating
              ? "border-[var(--aurora-accent)]/40 shadow-[0_0_28px_-10px_var(--aurora-accent)]"
              : "border-white/10 focus-within:border-[var(--aurora-accent)]/45 focus-within:shadow-[0_0_32px_-12px_var(--aurora-accent)]"
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setDraft(conversationId, e.target.value);
            }}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={
              generating
                ? "Menulis di latar belakang — pesan berikutnya bisa langsung kamu susun…"
                : "Tulis pesan…"
            }
            aria-label="Kotak pesan"
            className="w-full bg-transparent px-4 pt-3.5 pb-1 text-[14.5px] leading-[1.65] outline-none resize-none placeholder:text-muted-foreground/45 max-h-[260px]"
          />
          <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-0.5">
            {onModelChange ? (
              <ModelSlot
                providerId={providerId}
                modelKey={modelKey}
                onChange={onModelChange}
              />
            ) : null}
            <div className="flex-1" />
            {generating ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    onClick={onStop}
                    className="rounded-xl h-8 w-8 bg-destructive/15 text-destructive hover:bg-destructive/25 border border-destructive/25"
                    aria-label="Stop generation"
                  >
                    <Square className="size-3.5 fill-current" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Hentikan generasi
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    onClick={send}
                    disabled={!value.trim() || busy}
                    className="rounded-xl h-8 w-8 bg-[var(--aurora-accent)] hover:bg-[var(--aurora-accent)]/85 text-white shadow-[0_0_20px_-6px_var(--aurora-accent)]"
                    aria-label="Send message"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Kirim (⏎)
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="mt-1.5 px-2 text-[10.5px] text-muted-foreground/40 flex items-center justify-between">
          <span className="hidden sm:inline">
            ⏎ kirim · ⇧⏎ baris baru · generasi tetap berjalan saat kamu berpindah halaman
          </span>
          <span className="sm:hidden">⏎ kirim · ⇧⏎ baris baru</span>
          <span>{value.length > 0 ? `${value.length} karakter` : ""}</span>
        </div>
      </div>
    </div>
  );
}

// Lazy-loaded model picker inside composer (avoids circular import weight)
import { ModelPicker } from "./model-picker";
import { useProviders, useModels } from "@/hooks/mythicalmind/queries";
import { useMemo } from "react";

function ModelSlot({
  providerId,
  modelKey,
  onChange,
}: {
  providerId: string | null;
  modelKey: string | null;
  onChange: (providerId: string | null, modelKey: string | null) => void;
}) {
  const { data: providers } = useProviders();
  const { data: models } = useModels();

  const hasModels = (models ?? []).length > 0;

  const effective = useMemo(() => {
    if (providerId && modelKey) return { providerId, modelKey };
    const first = models?.[0];
    if (first) return { providerId: first.providerId, modelKey: first.modelId };
    return { providerId, modelKey };
  }, [providerId, modelKey, models]);

  if (!hasModels && (providers ?? []).length === 0) {
    return (
      <button
        onClick={() => useWorkspace.getState().setView("providers")}
        className="h-7 px-2.5 rounded-lg border border-[var(--aurora-accent)]/30 bg-[var(--aurora-accent)]/10 text-[11.5px] text-[var(--aurora-accent-2)] hover:bg-[var(--aurora-accent)]/20 transition-colors"
      >
        + Sambungkan penyedia
      </button>
    );
  }

  return (
    <ModelPicker
      providerId={effective.providerId}
      modelKey={effective.modelKey}
      onPick={(sel) => onChange(sel.providerId, sel.modelKey)}
    />
  );
}
