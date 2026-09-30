// MythicalMind — conversation service.
// Shared logic for sending messages, regenerating, retrying and continuing:
// builds request history, creates the assistant message + generation row,
// then hands the run to the GenerationManager (which streams in the
// background, independent of this request).

import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { generationManager } from "./generation-manager";
import { ApiError } from "@/lib/api-helpers";
import type { ChatMessage, MessageDTO, PublicGenerationState } from "@/lib/types";
import { toMessageDTO } from "@/lib/dto";
import type { Message } from "@prisma/client";

export interface ResolvedTarget {
  providerId: string;
  providerName: string;
  modelKey: string;
}

/** Resolve which provider/model a generation should use. */
export async function resolveTarget(
  conversationId: string,
  override?: {
    providerId?: string | null;
    modelKey?: string | null;
  }
): Promise<ResolvedTarget> {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { providerId: true, modelKey: true },
  });
  const settings = await getSettings();
  let providerId =
    override?.providerId ?? conversation?.providerId ?? settings.generation.defaultProviderId;
  let modelKey =
    override?.modelKey ?? conversation?.modelKey ?? settings.generation.defaultModelKey;

  if (!providerId) {
    throw new ApiError(
      400,
      "no_provider",
      "No AI provider selected. Add a provider in Infrastructure → Providers, then pick a model."
    );
  }
  const provider = await db.provider.findUnique({ where: { id: providerId } });
  if (!provider) {
    throw new ApiError(404, "provider_missing", "The selected provider no longer exists.");
  }
  if (!modelKey) {
    modelKey = provider.defaultModel ?? null;
    if (!modelKey) {
      const first = await db.model.findFirst({
        where: { providerId },
        orderBy: { createdAt: "asc" },
        select: { modelId: true },
      });
      modelKey = first?.modelId ?? null;
    }
  }
  if (!modelKey) {
    throw new ApiError(
      400,
      "no_model",
      `No model set for provider "${provider.name}". Add or discover models in Infrastructure → Models.`
    );
  }
  return { providerId: provider.id, providerName: provider.name, modelKey };
}

/** Full request history for the provider: system prompt + usable messages. */
export async function buildHistory(
  conversationId: string,
  opts: { includePartialAssistant?: boolean } = {}
): Promise<{ system: string | null; messages: ChatMessage[] }> {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { systemPrompt: true },
  });
  const rows = await db.message.findMany({
    where: { conversationId },
    orderBy: { sortOrder: "asc" },
  });

  const chat: ChatMessage[] = [];
  for (const m of rows) {
    if (m.role === "user" && m.content.trim()) {
      chat.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      const usable =
        m.status === "completed" ||
        (opts.includePartialAssistant && m.content.trim().length > 0);
      if (usable && m.content.trim()) {
        chat.push({ role: "assistant", content: m.content });
      }
    }
    // system rows are folded into the single system prompt below
  }
  const system = conversation?.systemPrompt?.trim() || null;
  return { system, messages: chat };
}

export function historyToRequestMessages(
  system: string | null,
  messages: ChatMessage[]
): ChatMessage[] {
  return system ? [{ role: "system", content: system }, ...messages] : messages;
}

async function nextSortOrder(conversationId: string): Promise<number> {
  const last = await db.message.findFirst({
    where: { conversationId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  return (last?.sortOrder ?? 0) + 1;
}

function deriveTitle(content: string): string {
  const firstLine = content
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0) ?? "New conversation";
  const cleaned = firstLine
    .replace(/^[#>*\-•\s]+/, "")
    .replace(/[*_`]/g, "")
    .trim();
  return cleaned.length > 48 ? `${cleaned.slice(0, 48).trimEnd()}…` : cleaned;
}

export interface StartResult {
  userMessage: MessageDTO | null;
  assistantMessage: MessageDTO;
  generation: PublicGenerationState;
}

interface StartOpts {
  conversationId: string;
  target: ResolvedTarget;
  requestMessages: ChatMessage[];
  /** create a fresh assistant message */
  newAssistant?: {
    initialText?: string;
    initialReasoning?: string;
    reuseMessage?: null;
  };
  /** stream into an existing message (continue / retry) */
  reuseMessage?: Message;
  userContent?: string;
  temperature?: number | null;
  maxTokens?: number | null;
}

export async function startGenerationRun(
  opts: StartOpts
): Promise<StartResult> {
  const { conversationId, target } = opts;

  let userMessage: Message | null = null;
  if (opts.userContent !== undefined && opts.userContent.trim()) {
    const sortOrder = await nextSortOrder(conversationId);
    userMessage = await db.message.create({
      data: {
        conversationId,
        role: "user",
        content: opts.userContent.trim(),
        status: "completed",
        sortOrder,
      },
    });
  }

  let assistantMessage: Message;
  if (opts.reuseMessage) {
    assistantMessage = await db.message.update({
      where: { id: opts.reuseMessage.id },
      data: {
        content: opts.newAssistant?.initialText ?? "",
        reasoning: opts.newAssistant?.initialReasoning ?? null,
        status: "streaming",
        usage: null,
        error: null,
        providerId: target.providerId,
        providerName: target.providerName,
        modelKey: target.modelKey,
        updatedAt: new Date(),
      },
    });
  } else {
    const sortOrder = await nextSortOrder(conversationId);
    assistantMessage = await db.message.create({
      data: {
        conversationId,
        role: "assistant",
        content: opts.newAssistant?.initialText ?? "",
        reasoning: opts.newAssistant?.initialReasoning ?? null,
        status: "streaming",
        providerId: target.providerId,
        providerName: target.providerName,
        modelKey: target.modelKey,
        sortOrder,
      },
    });
  }

  const generation = await db.generation.create({
    data: {
      conversationId,
      messageId: assistantMessage.id,
      providerId: target.providerId,
      providerName: target.providerName,
      modelKey: target.modelKey,
      status: "queued",
    },
  });

  // Auto-title from the first user message.
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { title: true, messageCount: true },
  });
  const patch: Record<string, unknown> = {
    providerId: target.providerId,
    modelKey: target.modelKey,
    updatedAt: new Date(),
    messageCount: (conversation?.messageCount ?? 0) + (userMessage ? 1 : 0) + 1,
  };
  if (
    userMessage &&
    conversation &&
    (conversation.title === "New conversation" || !conversation.title.trim())
  ) {
    patch.title = deriveTitle(userMessage.content);
  }
  await db.conversation.update({ where: { id: conversationId }, data: patch });

  const state = await generationManager.start({
    generationId: generation.id,
    conversationId,
    messageId: assistantMessage.id,
    providerId: target.providerId,
    providerName: target.providerName,
    modelKey: target.modelKey,
    messages: opts.requestMessages,
    temperature: opts.temperature ?? null,
    maxTokens: opts.maxTokens ?? null,
    initialText: opts.newAssistant?.initialText ?? "",
    initialReasoning: opts.newAssistant?.initialReasoning ?? "",
  });

  return {
    userMessage: userMessage ? toMessageDTO(userMessage) : null,
    assistantMessage: toMessageDTO(assistantMessage),
    generation: state,
  };
}
