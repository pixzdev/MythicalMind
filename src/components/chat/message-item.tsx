// A persisted (non-streaming) message row. Memoized — a token delta never
// re-renders completed messages, only the live StreamingMessage.
//
// Modern layout: user messages are right-aligned accent bubbles; assistant
// messages render clean full-width prose with a hover action toolbar.

"use client";

import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Copy,
  Check,
  Pencil,
  RefreshCw,
  Trash2,
  ArrowRightToLine,
  AlertTriangle,
  ChevronRight,
  Sparkle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { wallClock } from "@/lib/format";
import type { MessageDTO } from "@/lib/types";
import { Markdown } from "./markdown";

export interface MessageActions {
  onRegenerate: () => void;
  onRetry: () => void;
  onContinue: () => void;
  onEdit: (content: string) => void;
  onDelete: () => void;
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return { copied, copy };
}

function ActionButton({
  label,
  onClick,
  children,
  destructive,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex items-center justify-center size-7 rounded-lg text-muted-foreground hover:bg-white/[0.07] transition-colors",
        destructive ? "hover:text-destructive" : "hover:text-foreground/90"
      )}
    >
      {children}
    </button>
  );
}

export const MessageItem = memo(function MessageItem({
  message,
  isLast,
  actions,
}: {
  message: MessageDTO;
  isLast: boolean;
  actions: MessageActions;
}) {
  const { copied, copy } = useCopy();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  if (message.role === "system") return null;

  const isUser = message.role === "user";

  if (isUser) {
    return (
      <article className="group/msg message-in flex flex-col items-end" aria-label="Pesan Anda">
        {editing ? (
          <div className="w-full max-w-[42rem] rounded-2xl border border-[var(--aurora-accent)]/30 bg-white/[0.03] px-4 py-3 space-y-2.5">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[90px] bg-white/[0.03] border-white/10 text-[14.5px] resize-y"
              aria-label="Edit pesan"
              autoFocus
            />
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[12px]"
                onClick={() => setEditing(false)}
              >
                Batal
              </Button>
              <Button
                size="sm"
                className="h-7 text-[12px]"
                disabled={!draft.trim()}
                onClick={() => {
                  setEditing(false);
                  if (draft.trim() && draft.trim() !== message.content) {
                    actions.onEdit(draft.trim());
                  }
                }}
              >
                <RefreshCw className="size-3" /> Simpan & kirim ulang
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-md border border-[var(--aurora-accent)]/22 bg-[var(--aurora-accent)]/12 px-4 py-3 hover:border-[var(--aurora-accent)]/32 transition-colors">
              <div className="whitespace-pre-wrap text-[14.5px] leading-[1.68] text-[#eef1f9]">
                {message.content}
              </div>
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10.5px] text-muted-foreground/45">
              <span className="tabular-nums">{wallClock(message.createdAt)}</span>
              <span className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity pl-1">
                <ActionButton label="Salin pesan" onClick={() => copy(message.content)}>
                  {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                </ActionButton>
                <ActionButton
                  label="Edit & kirim ulang"
                  onClick={() => {
                    setDraft(message.content);
                    setEditing(true);
                  }}
                >
                  <Pencil className="size-3" />
                </ActionButton>
                <ActionButton label="Hapus pesan" onClick={actions.onDelete} destructive>
                  <Trash2 className="size-3" />
                </ActionButton>
              </span>
            </div>
          </>
        )}
      </article>
    );
  }

  // assistant (terminal: completed / failed / cancelled)
  const failed = message.status === "failed";
  const cancelled = message.status === "cancelled";
  const modelLabel = message.modelKey ?? "assistant";

  return (
    <article className="group/msg message-in" aria-label="Pesan asisten">
      <div className="flex items-center gap-2 mb-2">
        <span className="flex size-5.5 items-center justify-center rounded-md bg-gradient-to-br from-[var(--aurora-accent)]/25 to-[var(--aurora-accent-2)]/20 border border-white/8 flex-none">
          <Sparkle className="size-3 text-[var(--aurora-accent-2)]" />
        </span>
        <span className="text-[12px] font-medium text-foreground/90">
          {message.providerName ?? "Asisten"}
        </span>
        <span className="text-[11px] font-mono text-muted-foreground/55 truncate hidden sm:inline">
          {modelLabel}
        </span>
        <span className="text-[10.5px] text-muted-foreground/45 tabular-nums">
          {wallClock(message.createdAt)}
        </span>
      </div>

      {message.reasoning && (
        <ReasoningBlock reasoning={message.reasoning} />
      )}

      {message.content.trim() && <Markdown text={message.content} />}

      {/* hover action toolbar — modern pattern below the content */}
      <div className="mt-1.5 -ml-1.5 flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity">
        <ActionButton label="Salin respons" onClick={() => copy(message.content)}>
          {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
        </ActionButton>
        {isLast && !failed && message.content.trim() && (
          <ActionButton label="Lanjutkan respons" onClick={actions.onContinue}>
            <ArrowRightToLine className="size-3.5" />
          </ActionButton>
        )}
        {isLast && (
          <ActionButton label="Buat ulang respons" onClick={actions.onRegenerate}>
            <RefreshCw className="size-3.5" />
          </ActionButton>
        )}
        <ActionButton label="Hapus pesan" onClick={actions.onDelete} destructive>
          <Trash2 className="size-3.5" />
        </ActionButton>
        {message.usage?.totalTokens != null && (
          <span className="ml-1.5 text-[10.5px] text-muted-foreground/40 tabular-nums">
            {message.usage.totalTokens >= 1000
              ? `${(message.usage.totalTokens / 1000).toFixed(1)}k token`
              : `${message.usage.totalTokens} token`}
          </span>
        )}
      </div>

      {(failed || cancelled) && message.error && (
        <div className="mt-2.5 rounded-xl border border-destructive/25 bg-destructive/[0.06] px-4 py-3.5 space-y-2">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="size-4 text-destructive/90 mt-0.5 flex-none" />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-foreground/90">
                {failed ? "Generasi gagal" : "Generasi dihentikan"}
              </div>
              <div className="text-[12.5px] text-muted-foreground leading-relaxed mt-0.5">
                {message.error.message}
              </div>
              {message.error.hint && (
                <div className="text-[11.5px] text-muted-foreground/70 mt-1 leading-relaxed">
                  {message.error.hint}
                </div>
              )}
            </div>
          </div>
          {isLast && (
            <div className="flex gap-2 pl-6.5">
              <Button size="sm" className="h-7 text-[12px]" onClick={actions.onRetry}>
                <RefreshCw className="size-3" /> Coba lagi
              </Button>
            </div>
          )}
        </div>
      )}

      {cancelled && !message.error && message.content.trim() && isLast && (
        <div className="mt-2 text-[12px] text-muted-foreground/70 flex items-center gap-2">
          <span>Dihentikan — respons parsial disimpan.</span>
        </div>
      )}
    </article>
  );
});

export function ReasoningBlock({ reasoning }: { reasoning: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2.5 rounded-lg border border-white/7 bg-white/[0.018] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-3 h-8 text-[11.5px] text-muted-foreground hover:text-foreground/85 hover:bg-white/[0.02] transition-colors"
        aria-expanded={open}
        aria-label="Buka/tutup penalaran"
      >
        <ChevronRight
          className={cn("size-3 transition-transform", open && "rotate-90")}
        />
        <span className="font-medium">Penalaran</span>
        <span className="text-muted-foreground/50">
          {reasoning.length.toLocaleString("id-ID")} karakter
        </span>
      </button>
      {open && (
        <div className="reasoning-body px-3.5 pb-3 max-h-[280px] overflow-y-auto">
          {reasoning}
        </div>
      )}
    </div>
  );
}
