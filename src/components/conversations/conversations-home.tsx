// Conversations home: assistant landing. Search, recent conversations with
// live-generation badges, archive access, and the designed empty state.

"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquarePlus,
  Sparkle,
  Archive,
  Search,
  ArrowUpRight,
  Plug,
  MessagesSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { relativeTimeIndo } from "@/lib/rundown/time";
import { useWorkspace } from "@/store/workspace-store";
import {
  useConversations,
  useCreateConversation,
  useProviders,
} from "@/hooks/mythicalmind/queries";
import { isTerminal } from "@/lib/types";

export function ConversationsHome() {
  const { openConversation, setView } = useWorkspace();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const { data: conversations, isLoading } = useConversations(showArchived);
  const { data: providers } = useProviders();
  const createConversation = useCreateConversation();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations ?? [];
    return (conversations ?? []).filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.preview ?? "").toLowerCase().includes(q)
    );
  }, [conversations, query]);

  const hasProviders = (providers ?? []).length > 0;

  if (isLoading) {
    return (
      <div className="flex-1 p-6 sm:p-8 space-y-4 max-w-4xl mx-auto w-full">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!hasProviders && (conversations ?? []).length === 0) {
    // First run — the designed empty state
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-md rise-in">
          <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--aurora-accent)]/25 to-[var(--aurora-accent-2)]/20 border border-white/10 shadow-[0_0_40px_-12px_var(--aurora-accent)]">
            <Sparkle className="size-6 text-[var(--aurora-accent-2)]" />
          </div>
          <h2 className="text-[26px] font-semibold tracking-tight text-aurora-gradient leading-tight">
            Mulai berpikir.
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
            Sambungkan penyedia AI — semua endpoint yang kompatibel dengan
            OpenAI bisa — lalu mulai percakapan pertamamu. Workspace-mu tetap
            menjalankan generasi di latar belakang sambil kamu menjelajah.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2.5">
            <Button
              size="lg"
              className="bg-[var(--aurora-accent)] hover:bg-[var(--aurora-accent)]/85 text-white shadow-[0_0_28px_-8px_var(--aurora-accent)]"
              onClick={() => setView("providers")}
            >
              <Plug className="size-4" /> Sambungkan penyedia
            </Button>
          </div>
          <p className="mt-5 text-[11.5px] text-muted-foreground/50">
            OpenAI · OpenRouter · Groq · Together · Fireworks · DeepSeek ·
            Ollama · vLLM · LM Studio · gateway privat
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-8 py-7">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <h1 className="text-[19px] font-semibold tracking-tight">
            Percakapan Asisten
          </h1>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari percakapan…"
              className="h-9 w-[220px] sm:w-[280px] pl-8 bg-white/[0.03] border-white/10 text-[13px]"
              aria-label="Cari percakapan"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-white/10"
            onClick={() => setShowArchived((v) => !v)}
          >
            <Archive className="size-3.5" />
            {showArchived ? "Aktif" : "Arsip"}
          </Button>
          <Button
            size="sm"
            className="h-9 bg-[var(--aurora-accent)] hover:bg-[var(--aurora-accent)]/85 text-white"
            onClick={() =>
              createConversation.mutate(
                {},
                { onSuccess: (d) => openConversation(d.conversation.id) }
              )
            }
            disabled={createConversation.isPending}
          >
            <MessageSquarePlus className="size-4" />
            Baru
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/7 bg-white/[0.02] px-6 py-12 text-center">
            <p className="text-[13.5px] text-muted-foreground">
              {query
                ? "Tidak ada percakapan yang cocok dengan pencarian ini."
                : showArchived
                  ? "Belum ada yang diarsipkan."
                  : "Belum ada percakapan — mulai sekarang."}
            </p>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {filtered.map((c) => {
              const live =
                c.activeGenerationId &&
                !isTerminal(c.activeGenerationStatus ?? "completed");
              return (
                <button
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                  className="group relative rounded-2xl border border-white/7 bg-white/[0.022] p-4 text-left hover:border-[var(--aurora-accent)]/25 hover:bg-white/[0.04] transition-all overflow-hidden"
                >
                  <div className="absolute inset-x-0 top-0 h-px aurora-strip opacity-0 group-hover:opacity-60 transition-opacity" aria-hidden="true" />
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="flex size-6 items-center justify-center rounded-md bg-white/[0.045] border border-white/6 flex-none">
                      <MessagesSquare className={cn("size-3", live ? "text-[var(--aurora-accent-2)]" : "text-muted-foreground/70")} />
                    </span>
                    <span
                      className={cn(
                        "text-[13.5px] font-medium truncate flex-1",
                        c.archived && "italic text-muted-foreground/80"
                      )}
                    >
                      {c.title}
                    </span>
                    <ArrowUpRight className="size-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex-none" />
                  </div>
                  <p className="text-[12px] text-muted-foreground/75 line-clamp-2 leading-relaxed min-h-[2.4em]">
                    {c.preview ?? "Percakapan kosong"}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2 text-[10.5px] text-muted-foreground/50">
                    {live ? (
                      <span className="flex items-center gap-1.5 text-[var(--aurora-accent-2)]/90">
                        <span className="size-1.5 rounded-full bg-[var(--aurora-accent-2)] status-dot-live" />
                        sedang menulis…
                      </span>
                    ) : (
                      <span>{relativeTimeIndo(c.updatedAt)}</span>
                    )}
                    <span>·</span>
                    <span>{c.messageCount} pesan</span>
                    {c.modelKey && (
                      <>
                        <span>·</span>
                        <span className="font-mono truncate">{c.modelKey}</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export { Sparkle };
