// Message list: memoized rows + the live streaming row + smart auto-scroll
// (follows output, pauses when the user scrolls up, "jump to latest" pill).

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import type { ConversationDetail, MessageDTO } from "@/lib/types";
import { MessageItem, type MessageActions } from "./message-item";
import { StreamingMessage } from "./streaming-message";

export function MessageList({
  messages,
  actions,
  onRetry,
}: {
  messages: MessageDTO[];
  actions: (message: MessageDTO) => MessageActions;
  onRetry: (message: MessageDTO) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    followRef.current = distance < 140;
    setShowJump(distance > 400);
  };

  // follow output only while user is near the bottom
  useLayoutEffect(() => {
    if (followRef.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  });

  // jump to latest on conversation switch
  useEffect(() => {
    followRef.current = true;
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end" });
    });
  }, [messages.length === 0]);

  const lastAssistantIdx = findLastIndex(messages, (m) => m.role === "assistant");

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto"
        role="log"
        aria-label="Percakapan"
      >
        <div className="max-w-[48rem] mx-auto w-full px-4 sm:px-6 py-7 space-y-8">
          {messages.map((m, i) => {
            if (m.role === "system") return null;
            const isStreaming = m.status === "streaming";
            const isLast = i === lastAssistantIdx || i === messages.length - 1;
            return isStreaming ? (
              <StreamingMessage
                key={m.id}
                message={m}
                isLast={isLast}
                onRetry={() => onRetry(m)}
              />
            ) : (
              <MessageItem
                key={m.id}
                message={m}
                isLast={isLast}
                actions={actions(m)}
              />
            );
          })}
          <div ref={bottomRef} className="h-1" />
        </div>
      </div>

      {showJump && (
        <button
          onClick={() => {
            followRef.current = true;
            bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
          }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 h-8 px-3 rounded-full glass text-[12px] text-foreground/85 hover:bg-white/[0.08] transition-all rise-in shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)]"
          aria-label="Lompat ke keluaran terbaru"
        >
          <ArrowDown className="size-3.5" />
          Ke terbaru
        </button>
      )}
    </div>
  );
}

function findLastIndex<T>(arr: T[], pred: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i;
  }
  return -1;
}

export type { ConversationDetail };
