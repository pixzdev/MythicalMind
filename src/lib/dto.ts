// MythicalMind — DTO mapping. The hard security boundary for API keys:
// rows never leave the server un-masked.

import type {
  ActivityDTO,
  AgentDTO,
  ConversationSummary,
  MessageDTO,
  ModelDTO,
  ProviderDTO,
  RundownDetail,
  RundownSummary,
  SegmentDTO,
} from "@/lib/types";
import type {
  ActivityEvent,
  Agent,
  Conversation,
  Message,
  Model,
  Provider,
  Rundown,
  Segment,
} from "@prisma/client";

type ProviderWithModels = Provider & { _count?: { models: number } };

export function toProviderDTO(p: ProviderWithModels): ProviderDTO {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    baseUrl: p.baseUrl,
    defaultModel: p.defaultModel,
    customHeaders: safeParse(p.customHeaders, {}) as Record<string, string>,
    status: (p.status as ProviderDTO["status"]) ?? "unverified",
    statusDetail: p.statusDetail,
    lastTestedAt: p.lastTestedAt?.toISOString() ?? null,
    modelCount: p._count?.models ?? 0,
    hasKey: Boolean(p.apiKey),
    // last 4 characters only — enough to recognize a key, never enough to use it
    keyHint: p.apiKey ? `•••• ${p.apiKey.slice(-4)}` : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toModelDTO(m: Model & { provider?: { name: string } }): ModelDTO {
  return {
    id: m.id,
    providerId: m.providerId,
    providerName: m.provider?.name ?? "",
    modelId: m.modelId,
    name: m.name,
    contextWindow: m.contextWindow,
    vision: m.vision,
    reasoning: m.reasoning,
    tools: m.tools,
    streaming: m.streaming,
  };
}

export function toMessageDTO(m: Message): MessageDTO {
  return {
    id: m.id,
    conversationId: m.conversationId,
    role: m.role as MessageDTO["role"],
    content: m.content,
    reasoning: m.reasoning,
    status: m.status as MessageDTO["status"],
    generationId: m.generationId,
    providerId: m.providerId,
    providerName: m.providerName,
    modelKey: m.modelKey,
    usage: safeParse(m.usage, null),
    error: safeParse(m.error, null),
    sortOrder: m.sortOrder,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

type ConversationWithExtras = Conversation & {
  _count?: { messages: number };
  messages?: { content: string }[];
  agent?: { name: string } | null;
  generations?: { id: string; status: string }[];
};

export function toConversationSummary(
  c: ConversationWithExtras
): ConversationSummary {
  const lastMessage = c.messages?.[0];
  const activeGen = c.generations?.find(
    (g) => g.status === "streaming" || g.status === "queued"
  );
  return {
    id: c.id,
    title: c.title,
    agentId: c.agentId,
    archived: c.archived,
    providerId: c.providerId,
    modelKey: c.modelKey,
    messageCount: c.messageCount,
    preview: lastMessage ? previewText(lastMessage) : null,
    activeGenerationId: activeGen?.id ?? null,
    activeGenerationStatus: (activeGen?.status as ConversationSummary["activeGenerationStatus"]) ?? null,
    updatedAt: c.updatedAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
  };
}

export function toConversationDetail(
  c: Conversation & {
    _count?: { messages: number };
    messages: Message[];
    agent?: { name: string } | null;
    generations?: { id: string; status: string }[];
  }
) {
  const summary = toConversationSummary(c);
  return {
    ...summary,
    systemPrompt: c.systemPrompt,
    agentName: c.agent?.name ?? null,
    messages: [...c.messages]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toMessageDTO),
  };
}

export function toActivityDTO(a: ActivityEvent): ActivityDTO {
  return {
    id: a.id,
    type: a.type,
    level: a.level as ActivityDTO["level"],
    title: a.title,
    detail: a.detail,
    conversationId: a.conversationId,
    conversationTitle: a.conversationTitle,
    generationId: a.generationId,
    providerId: a.providerId,
    createdAt: a.createdAt.toISOString(),
  };
}

export function toAgentDTO(a: Agent): AgentDTO {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    systemPrompt: a.systemPrompt,
    temperature: a.temperature,
    providerId: a.providerId,
    modelKey: a.modelKey,
    icon: a.icon,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

function previewText(m: { content: string }): string {
  const text = m.content.replace(/\s+/g, " ").trim();
  return text.length > 140 ? `${text.slice(0, 140)}…` : text || "(empty response)";
}

function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Rundown Studio
// ---------------------------------------------------------------------------

type RundownWithCount = Rundown & { _count?: { segments: number } };

export function toRundownSummary(
  r: RundownWithCount,
  computed?: { segmentCount: number; totalMinutes: number }
): RundownSummary {
  return {
    id: r.id,
    title: r.title,
    category: (r.category as RundownSummary["category"]) ?? "acara",
    eventType: r.eventType,
    description: r.description,
    eventDate: r.eventDate?.toISOString() ?? null,
    venue: r.venue,
    organizer: r.organizer,
    startTime: r.startTime,
    status: (r.status as RundownSummary["status"]) ?? "draft",
    source: (r.source as RundownSummary["source"]) ?? "manual",
    segmentCount: computed?.segmentCount ?? r._count?.segments ?? 0,
    totalMinutes: computed?.totalMinutes ?? r.totalMinutes ?? 0,
    updatedAt: r.updatedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  };
}

export function toSegmentDTO(s: Segment): SegmentDTO {
  return {
    id: s.id,
    rundownId: s.rundownId,
    sortOrder: s.sortOrder,
    durationMinutes: s.durationMinutes,
    title: s.title,
    description: s.description,
    pic: s.pic,
    notes: s.notes,
    materials: s.materials,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function toRundownDetail(r: Rundown, segments: Segment[]): RundownDetail {
  const sorted = [...segments].sort((a, b) => a.sortOrder - b.sortOrder);
  const totalMinutes = sorted.reduce((sum, s) => sum + s.durationMinutes, 0);
  return {
    ...toRundownSummary(r, { segmentCount: sorted.length, totalMinutes }),
    segments: sorted.map(toSegmentDTO),
  };
}
