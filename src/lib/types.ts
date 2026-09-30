// MythicalMind — shared domain types (safe for client & server)

// ---------------------------------------------------------------------------
// Chat / provider wire types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

/** Readable, user-facing error (never a raw stack trace). */
export interface FriendlyError {
  code: string;
  message: string;
  hint?: string;
  status?: number;
}

// ---------------------------------------------------------------------------
// Normalized provider stream events — the ONLY shape the runtime/UI consume
// ---------------------------------------------------------------------------

export type StreamEvent =
  | { type: "text-delta"; text: string }
  | { type: "reasoning-delta"; text: string }
  | { type: "tool-call"; data: unknown }
  | { type: "usage"; usage: Usage }
  | { type: "error"; error: FriendlyError }
  | { type: "done" };

// ---------------------------------------------------------------------------
// Generation lifecycle
// ---------------------------------------------------------------------------

export type GenerationStatus =
  | "queued"
  | "streaming"
  | "completed"
  | "failed"
  | "cancelled";

export type MessageStatus = "streaming" | "completed" | "failed" | "cancelled";

export interface PublicGenerationState {
  id: string;
  conversationId: string;
  conversationTitle: string | null;
  messageId: string | null;
  providerId: string;
  providerName: string;
  modelKey: string;
  status: GenerationStatus;
  text: string;
  reasoning: string;
  outputChars: number;
  usage: Usage | null;
  error: FriendlyError | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
}

/** Events sent over the SSE wire from the generation runtime to the client. */
export type RuntimeEvent =
  | { type: "snapshot"; state: PublicGenerationState }
  | { type: "text-delta"; text: string }
  | { type: "reasoning-delta"; text: string }
  | { type: "usage"; usage: Usage }
  | {
      type: "status";
      status: GenerationStatus;
      error?: FriendlyError | null;
    }
  | { type: "done"; state: PublicGenerationState };

// ---------------------------------------------------------------------------
// DTOs returned by the API
// ---------------------------------------------------------------------------

export interface ProviderDTO {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  defaultModel: string | null;
  customHeaders: Record<string, string>;
  status: "unverified" | "connected" | "error";
  statusDetail: string | null;
  lastTestedAt: string | null;
  modelCount: number;
  hasKey: boolean;
  keyHint: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModelDTO {
  id: string;
  providerId: string;
  providerName: string;
  modelId: string;
  name: string;
  contextWindow: number | null;
  vision: boolean;
  reasoning: boolean;
  tools: boolean;
  streaming: boolean;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  reasoning: string | null;
  status: MessageStatus;
  generationId: string | null;
  providerId: string | null;
  providerName: string | null;
  modelKey: string | null;
  usage: Usage | null;
  error: FriendlyError | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  agentId: string | null;
  archived: boolean;
  providerId: string | null;
  modelKey: string | null;
  messageCount: number;
  preview: string | null;
  activeGenerationId: string | null;
  activeGenerationStatus: GenerationStatus | null;
  updatedAt: string;
  createdAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  systemPrompt: string | null;
  agentName: string | null;
  messages: MessageDTO[];
}

export interface ActivityDTO {
  id: string;
  type: string;
  level: "info" | "success" | "warn" | "error";
  title: string;
  detail: string | null;
  conversationId: string | null;
  conversationTitle: string | null;
  generationId: string | null;
  providerId: string | null;
  createdAt: string;
}

export interface AgentDTO {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  temperature: number | null;
  providerId: string | null;
  modelKey: string | null;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSettings {
  appearance: {
    accent: "violet" | "cyan" | "teal" | "magenta";
    atmosphere: "subtle" | "medium" | "off";
  };
  generation: {
    temperature: number | null;
    maxTokens: number | null;
    timeoutMs: number;
    defaultProviderId: string | null;
    defaultModelKey: string | null;
  };
}

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  appearance: { accent: "violet", atmosphere: "subtle" },
  generation: {
    temperature: 0.7,
    maxTokens: null,
    timeoutMs: 600_000,
    defaultProviderId: null,
    defaultModelKey: null,
  },
};

export const GENERATION_TERMINAL: GenerationStatus[] = [
  "completed",
  "failed",
  "cancelled",
];

export function isTerminal(status: GenerationStatus): boolean {
  return GENERATION_TERMINAL.includes(status);
}

// ---------------------------------------------------------------------------
// Rundown Studio — domain types (client & server safe)
// ---------------------------------------------------------------------------

export type RundownCategory = "acara" | "harian" | "studi" | "kerja";
export type RundownStatus = "draft" | "final";
export type RundownSource = "manual" | "template" | "ai";

export interface SegmentDTO {
  id: string;
  rundownId: string;
  sortOrder: number;
  durationMinutes: number;
  title: string;
  description: string | null;
  pic: string | null;
  notes: string | null;
  materials: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RundownSummary {
  id: string;
  title: string;
  category: RundownCategory;
  eventType: string;
  description: string | null;
  eventDate: string | null;
  venue: string | null;
  organizer: string | null;
  startTime: string;
  status: RundownStatus;
  source: RundownSource;
  segmentCount: number;
  totalMinutes: number;
  updatedAt: string;
  createdAt: string;
}

export interface RundownDetail extends RundownSummary {
  segments: SegmentDTO[];
}

/** A segment with derived wall-clock times — computed, never stored. */
export interface TimelineSlot {
  segment: SegmentDTO;
  index: number;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  startTime: string; // "08:00"
  endTime: string; // "09:30"
}

/** Segment payload used by create/patch/AI flows. */
export interface SegmentInput {
  title: string;
  durationMinutes: number;
  description?: string | null;
  pic?: string | null;
  notes?: string | null;
  materials?: string | null;
}

/** AI-generated rundown (reviewed before persisting). */
export interface AIRundownResult {
  title: string;
  description: string | null;
  category: RundownCategory;
  eventType: string;
  suggestedStartTime: string;
  segments: SegmentInput[];
  providerName: string;
  modelKey: string;
}

export const RUNDOWN_CATEGORY_LABELS: Record<RundownCategory, string> = {
  acara: "Acara",
  harian: "Rencana Harian",
  studi: "Belajar",
  kerja: "Kerja",
};
