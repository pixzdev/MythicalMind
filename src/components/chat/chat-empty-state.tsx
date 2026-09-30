// Empty conversation state: Aurora atmosphere + a small set of REAL starter
// prompts (clicking one pre-fills the composer — no fake suggestions).

"use client";

import { Sparkle, Lightbulb, CalendarRange, Wand2, MessageSquareText } from "lucide-react";
import { useWorkspace } from "@/store/workspace-store";
import { ModelPicker } from "./model-picker";
import { useConversation, useUpdateConversation } from "@/hooks/mythicalmind/queries";

const STARTERS: { icon: React.ElementType; text: string }[] = [
  {
    icon: CalendarRange,
    text: "Bantu kerangka acara seminar setengah hari untuk 100 peserta.",
  },
  {
    icon: Lightbulb,
    text: "Brainstorm 10 tema webinar untuk audiens pemula.",
  },
  {
    icon: Wand2,
    text: "Susun rencana produktif mingguan dengan blok waktu deep work.",
  },
  {
    icon: MessageSquareText,
    text: "Tulis draft MC script pembukaan talkshow 5 menit.",
  },
];

export function ChatEmptyState({ conversationId }: { conversationId: string }) {
  const setDraft = useWorkspace((s) => s.setDraft);
  const setView = useWorkspace((s) => s.setView);
  const { data } = useConversation(conversationId);
  const updateConversation = useUpdateConversation();
  const conversation = data?.conversation;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto flex items-center justify-center px-6 pb-6">
        <div className="max-w-lg w-full text-center rise-in py-8">
          <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--aurora-accent)]/25 to-[var(--aurora-accent-2)]/20 border border-white/10 shadow-[0_0_40px_-12px_var(--aurora-accent)]">
            <Sparkle className="size-6 text-[var(--aurora-accent-2)]" />
          </div>
          <h2 className="text-[26px] font-semibold tracking-tight text-aurora-gradient leading-tight">
            Mau brainstorming apa hari ini?
          </h2>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
            Asisten siap membantu memikirkan konsep acara, menyusun kerangka, atau
            melengkapi rundown-mu. Pilih model di bawah, atau langsung tulis —
            generasi tetap mengalir di latar belakang saat kamu berpindah halaman.
          </p>

          <div className="mt-7 grid gap-2 text-left">
            {STARTERS.map((s) => (
              <button
                key={s.text}
                onClick={() => setDraft(conversationId, s.text)}
                className="group flex items-center gap-3 rounded-xl border border-white/7 bg-white/[0.022] px-4 py-3 text-left hover:border-white/14 hover:bg-white/[0.045] transition-all"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--aurora-accent)]/12 border border-[var(--aurora-accent)]/20 flex-none group-hover:scale-105 transition-transform">
                  <s.icon className="size-4 text-[var(--aurora-accent-2)]" />
                </span>
                <span className="text-[13px] text-muted-foreground group-hover:text-foreground/90 leading-snug transition-colors">
                  {s.text}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <ModelPicker
              providerId={conversation?.providerId ?? null}
              modelKey={conversation?.modelKey ?? null}
              onPick={(sel) =>
                updateConversation.mutate({
                  id: conversationId,
                  providerId: sel.providerId,
                  modelKey: sel.modelKey,
                })
              }
            />
            {conversation && !conversation.providerId && (
              <button
                onClick={() => setView("providers")}
                className="text-[12.5px] text-[var(--aurora-accent-2)] hover:underline px-1"
              >
                Sambungkan penyedia AI dulu →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
