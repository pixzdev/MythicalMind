// Conversation view: header (title, model chip, actions), message list,
// composer. Generation lifecycle is owned by the runtime — this component
// only subscribes, so navigating away never interrupts streaming.
//
// Modern single-column chat: no persistent right rail here. Conversation
// context (model, system prompt, live telemetry) lives in the info drawer.

"use client";

import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  PanelRight,
  Archive,
  Trash2,
  Pencil,
  Sparkle,
} from "lucide-react";
import { useWorkspace } from "@/store/workspace-store";
import { runtime } from "@/lib/runtime/client/runtime-client";
import {
  useConversation,
  useDeleteMessage,
  useDeleteConversation,
  useEditMessage,
  useGenerate,
  useModels,
  useProviders,
  useSendMessage,
  useStopGeneration,
  useUpdateConversation,
} from "@/hooks/mythicalmind/queries";
import { isTerminal } from "@/lib/types";
import { MessageList } from "./message-list";
import { Composer } from "./composer";
import { ChatEmptyState } from "./chat-empty-state";

export function ConversationView({ conversationId }: { conversationId: string }) {
  const { data, isLoading } = useConversation(conversationId);
  const { setContextSheetOpen, setComposerModel } = useWorkspace();

  const sendMessage = useSendMessage();
  const generate = useGenerate();
  const editMessage = useEditMessage();
  const deleteMessage = useDeleteMessage();
  const updateConversation = useUpdateConversation();
  const deleteConversation = useDeleteConversation();
  const stopGeneration = useStopGeneration();

  // Reconnect to an active generation for this conversation (e.g. opened
  // from a list, or the runtime finished boot sync before this mounted).
  useEffect(() => {
    const liveGen = data?.liveGeneration;
    if (liveGen && !isTerminal(liveGen.status)) {
      if (!runtime.getRun(liveGen.id)) {
        runtime.connect({ id: liveGen.id, conversationId });
      }
    }
  }, [data?.liveGeneration, conversationId]);

  const conversation = data?.conversation;
  const messages = useMemo(() => conversation?.messages ?? [], [conversation]);
  const { data: models } = useModels();
  const { data: providers } = useProviders();

  // Auto-assign the best default model to provider-less conversations so
  // the golden path (new conversation → type → send) works immediately.
  // Prefers each connected provider's configured default model; explicit
  // user picks always win — this only fills the empty case.
  const autoAssignedRef = useRef<string | null>(null);
  const defaultModel = useMemo(() => {
    const list = models ?? [];
    if (list.length === 0) return null;
    const defaults = new Set(
      (providers ?? [])
        .filter((p) => p.status === "connected" && p.defaultModel)
        .map((p) => `${p.id}:${p.defaultModel}`)
    );
    return (
      list.find((m) => defaults.has(`${m.providerId}:${m.modelId}`)) ?? list[0]
    );
  }, [models, providers]);
  useEffect(() => {
    if (!conversation?.id || conversation.providerId) return;
    if (autoAssignedRef.current === conversation.id) return;
    if (!defaultModel) return;
    autoAssignedRef.current = conversation.id;
    updateConversation.mutate({
      id: conversation.id,
      providerId: defaultModel.providerId,
      modelKey: defaultModel.modelId,
    });
  }, [conversation?.id, conversation?.providerId, defaultModel, updateConversation]);

  // keep composer's model selection in sync with the conversation
  useEffect(() => {
    if (conversation?.providerId && conversation?.modelKey) {
      setComposerModel({
        providerId: conversation.providerId,
        modelKey: conversation.modelKey,
      });
    }
  }, [conversation?.providerId, conversation?.modelKey, setComposerModel]);

  const composerModel = useWorkspace((s) => s.composerModel);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="h-14 flex-none hairline-b flex items-center px-5 gap-3">
          <Skeleton className="size-6 rounded-lg" />
          <Skeleton className="h-4 w-52" />
        </div>
        <div className="flex-1 space-y-6 p-6 max-w-[48rem] mx-auto w-full">
          <Skeleton className="h-16 rounded-2xl ml-auto max-w-[70%]" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Percakapan tidak ditemukan.
      </div>
    );
  }

  const onSend = (content: string) => {
    sendMessage.mutate({
      conversationId,
      content,
      model: composerModel,
    });
  };

  const handleStop = () => {
    const run = runtime.getConversationRun(conversationId);
    if (run && !isTerminal(run.state.status)) {
      stopGeneration.mutate(run.id);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header — glass, single row, quiet */}
      <div className="h-14 flex-none hairline-b flex items-center gap-2 px-3 sm:px-5 bg-[rgba(4,6,13,0.55)] backdrop-blur-xl z-10">
        <div className="min-w-0 flex-1 flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--aurora-accent)]/22 to-[var(--aurora-accent-2)]/18 border border-white/8 flex-none">
            {conversation.agentName ? (
              <Sparkle className="size-3.5 text-[var(--aurora-accent-2)]" />
            ) : (
              <Sparkle className="size-3.5 text-[var(--aurora-accent-2)]/80" />
            )}
          </span>
          <div className="min-w-0">
            <h1 className="text-[14px] font-semibold truncate leading-tight">
              {conversation.title}
            </h1>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 leading-tight">
              {conversation.modelKey && (
                <span className="font-mono truncate hidden sm:inline">{conversation.modelKey}</span>
              )}
              {conversation.archived && (
                <span className="text-[10px] px-1.5 py-px rounded border border-white/10 text-muted-foreground/70">
                  diarsipkan
                </span>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setContextSheetOpen(true)}
          aria-label="Info percakapan"
          title="Info percakapan (model, system prompt)"
        >
          <PanelRight className="size-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              aria-label="Aksi percakapan"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              onClick={() => {
                const title = window.prompt("Ganti judul percakapan", conversation.title);
                if (title && title.trim()) {
                  updateConversation.mutate({ id: conversationId, title: title.trim() });
                }
              }}
            >
              <Pencil className="size-3.5" /> Ganti judul
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                updateConversation.mutate({
                  id: conversationId,
                  archived: !conversation.archived,
                })
              }
            >
              <Archive className="size-3.5" />
              {conversation.archived ? "Keluarkan dari arsip" : "Arsipkan"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                if (window.confirm(`Hapus “${conversation.title}” beserta semua pesannya?`)) {
                  deleteConversation.mutate(conversationId);
                }
              }}
            >
              <Trash2 className="size-3.5" /> Hapus percakapan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      {messages.filter((m) => m.role !== "system").length === 0 ? (
        <ChatEmptyState conversationId={conversationId} />
      ) : (
        <MessageList
          messages={messages}
          onRetry={(m) =>
            generate.mutate({ conversationId, mode: "retry", messageId: m.id })
          }
          actions={(m) => ({
            onRegenerate: () =>
              generate.mutate({ conversationId, mode: "regenerate", model: composerModel }),
            onRetry: () =>
              generate.mutate({ conversationId, mode: "retry", messageId: m.id }),
            onContinue: () =>
              generate.mutate({ conversationId, mode: "continue", messageId: m.id }),
            onEdit: (content) => {
              editMessage.mutate(
                { id: m.id, content },
                {
                  onSuccess: () => {
                    generate.mutate({ conversationId, mode: "regenerate", model: composerModel });
                  },
                }
              );
            },
            onDelete: () => deleteMessage.mutate(m.id),
          })}
        />
      )}

      {/* Composer */}
      <Composer
        conversationId={conversationId}
        providerId={conversation.providerId}
        modelKey={conversation.modelKey}
        onModelChange={(providerId, modelKey) => {
          setComposerModel(
            providerId ? { providerId, modelKey: modelKey ?? null } : null
          );
          updateConversation.mutate({ id: conversationId, providerId, modelKey });
        }}
        onSend={onSend}
        onStop={handleStop}
        busy={sendMessage.isPending}
      />
    </div>
  );
}
