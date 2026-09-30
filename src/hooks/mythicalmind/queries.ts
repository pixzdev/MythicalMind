// Typed data-access layer over the MythicalMind API (TanStack Query).

"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  ActivityDTO,
  AgentDTO,
  ConversationDetail,
  ConversationSummary,
  MessageDTO,
  ModelDTO,
  ProviderDTO,
  PublicGenerationState,
  WorkspaceSettings,
} from "@/lib/types";
import { runtime } from "@/lib/runtime/client/runtime-client";
import { useWorkspace, type ModelSelection } from "@/store/workspace-store";

// ---------------------------------------------------------------------------
// fetch helper
// ---------------------------------------------------------------------------

export class ApiRequestError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  if (!res.ok) {
    let code = "request_failed";
    let message = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (body?.error?.code) code = body.error.code;
      if (body?.error?.message) message = body.error.message;
    } catch {
      /* non-JSON error */
    }
    throw new ApiRequestError(code, message, res.status);
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export function useConversations(includeArchived = false) {
  return useQuery({
    queryKey: ["conversations", includeArchived],
    queryFn: () =>
      api<{ conversations: ConversationSummary[] }>(
        `/api/conversations${includeArchived ? "?archived=1" : ""}`
      ).then((r) => r.conversations),
    refetchOnWindowFocus: true,
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ["conversation", id],
    queryFn: () =>
      api<{ conversation: ConversationDetail; liveGeneration: PublicGenerationState | null }>(
        `/api/conversations/${id}`
      ),
    enabled: Boolean(id),
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title?: string;
      agentId?: string | null;
      systemPrompt?: string | null;
      providerId?: string | null;
      modelKey?: string | null;
    }) =>
      api<{ conversation: ConversationSummary }>("/api/conversations", {
        method: "POST",
        json: input,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err) => toast.error("Gagal membuat percakapan", { description: err.message }),
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...patch
    }: {
      id: string;
      title?: string;
      systemPrompt?: string | null;
      archived?: boolean;
      providerId?: string | null;
      modelKey?: string | null;
    }) =>
      api<{ conversation: ConversationDetail }>(`/api/conversations/${id}`, {
        method: "PATCH",
        json: patch,
      }),
    onSuccess: (data, vars) => {
      void qc.invalidateQueries({ queryKey: ["conversations"] });
      void qc.invalidateQueries({ queryKey: ["conversation", vars.id] });
    },
    onError: (err) => toast.error("Gagal menyimpan perubahan", { description: err.message }),
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  const store = useWorkspace.getState();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ deleted: boolean }>(`/api/conversations/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ["conversations"] });
      const state = useWorkspace.getState();
      if (state.conversationId === id) {
        state.closeConversation();
      }
      void store;
    },
    onError: (err) => toast.error("Gagal menghapus", { description: err.message }),
  });
}

// ---------------------------------------------------------------------------
// Messaging / generation
// ---------------------------------------------------------------------------

export interface SendMessageResult {
  userMessage: MessageDTO | null;
  assistantMessage: MessageDTO;
  generation: PublicGenerationState;
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      content,
      model,
    }: {
      conversationId: string;
      content: string;
      model?: ModelSelection | null;
    }) =>
      api<SendMessageResult>(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        json: {
          content,
          ...(model?.providerId ? { providerId: model.providerId } : {}),
          ...(model?.modelKey ? { modelKey: model.modelKey } : {}),
        },
      }),
    onSuccess: (result, vars) => {
      // connect the SSE bridge BEFORE cache updates so no delta is missed
      runtime.connect({
        id: result.generation.id,
        conversationId: vars.conversationId,
      });
      qc.setQueryData<{ conversation: ConversationDetail; liveGeneration: null }>(
        ["conversation", vars.conversationId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            conversation: {
              ...old.conversation,
              messages: [
                ...old.conversation.messages.filter((m) => m.status !== "streaming" || m.content),
                ...(result.userMessage ? [result.userMessage] : []),
                result.assistantMessage,
              ],
            },
          };
        }
      );
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err) =>
      toast.error("Gagal mengirim pesan", {
        description: err.message,
      }),
  });
}

export function useGenerate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      mode,
      messageId,
      model,
    }: {
      conversationId: string;
      mode: "regenerate" | "retry" | "continue";
      messageId?: string;
      model?: ModelSelection | null;
    }) =>
      api<SendMessageResult>(`/api/conversations/${conversationId}/generate`, {
        method: "POST",
        json: {
          mode,
          ...(messageId ? { messageId } : {}),
          ...(model?.providerId ? { providerId: model.providerId } : {}),
          ...(model?.modelKey ? { modelKey: model.modelKey } : {}),
        },
      }),
    onSuccess: (result, vars) => {
      runtime.connect({
        id: result.generation.id,
        conversationId: vars.conversationId,
      });
      if (vars.mode === "regenerate") {
        // replace trailing assistant messages with the new streaming one
        qc.setQueryData<{ conversation: ConversationDetail; liveGeneration: null }>(
          ["conversation", vars.conversationId],
          (old) => {
            if (!old) return old;
            const messages = [...old.conversation.messages];
            while (messages.length && messages[messages.length - 1].role === "assistant") {
              messages.pop();
            }
            return {
              ...old,
              conversation: {
                ...old.conversation,
                messages: [...messages, result.assistantMessage],
              },
            };
          }
        );
      } else if (vars.mode === "retry") {
        qc.setQueryData<{ conversation: ConversationDetail; liveGeneration: null }>(
          ["conversation", vars.conversationId],
          (old) => {
            if (!old) return old;
            return {
              ...old,
              conversation: {
                ...old.conversation,
                messages: old.conversation.messages.map((m) =>
                  m.id === result.assistantMessage.id ? result.assistantMessage : m
                ),
              },
            };
          }
        );
      }
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err) =>
      toast.error("Gagal memulai generasi", { description: err.message }),
  });
}

export function useStopGeneration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (generationId: string) =>
      api<{ stopped: boolean; status: string }>(
        `/api/generations/${generationId}/stop`,
        { method: "POST" }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err) => toast.error("Gagal menghentikan generasi", { description: err.message }),
  });
}

export function useEditMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api<{ message: MessageDTO; removed: number }>(`/api/messages/${id}`, {
        method: "PATCH",
        json: { content, truncateAfter: true },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err) => toast.error("Gagal mengedit pesan", { description: err.message }),
  });
}

export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ removed: number }>(`/api/messages/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err) => toast.error("Gagal menghapus pesan", { description: err.message }),
  });
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export function useProviders() {
  return useQuery({
    queryKey: ["providers"],
    queryFn: () =>
      api<{ providers: ProviderDTO[] }>("/api/providers").then((r) => r.providers),
  });
}

export function useCreateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      type: string;
      baseUrl: string;
      apiKey?: string;
      defaultModel?: string | null;
      customHeaders?: Record<string, string>;
    }) =>
      api<{ provider: ProviderDTO }>("/api/providers", {
        method: "POST",
        json: input,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (err) => toast.error("Gagal menambah penyedia", { description: err.message }),
  });
}

export function useUpdateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...patch
    }: {
      id: string;
      name?: string;
      baseUrl?: string;
      apiKey?: string;
      defaultModel?: string | null;
      customHeaders?: Record<string, string>;
    }) =>
      api<{ provider: ProviderDTO }>(`/api/providers/${id}`, {
        method: "PATCH",
        json: patch,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (err) => toast.error("Gagal memperbarui penyedia", { description: err.message }),
  });
}

export function useDeleteProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ deleted: boolean }>(`/api/providers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["providers"] });
      void qc.invalidateQueries({ queryKey: ["models"] });
    },
    onError: (err) => toast.error("Gagal menghapus penyedia", { description: err.message }),
  });
}

export function useTestProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ result: { ok: boolean; detail: string; models?: number } }>(
        `/api/providers/${id}/test`,
        { method: "POST" }
      ),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["providers"] });
      void qc.invalidateQueries({ queryKey: ["activity"] });
      if (data.result.ok) {
        toast.success("Penyedia terhubung", { description: data.result.detail });
      } else {
        toast.error("Koneksi gagal", { description: data.result.detail });
      }
    },
    onError: (err) => toast.error("Pengujian gagal", { description: err.message }),
  });
}

export function useDiscoverModels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (providerId: string) =>
      api<{
        discovered: boolean;
        added: number;
        message: string;
        models: ModelDTO[];
      }>(`/api/providers/${providerId}/discover`, { method: "POST" }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["providers"] });
      void qc.invalidateQueries({ queryKey: ["models"] });
      if (data.discovered) {
        toast.success("Penemuan model selesai", { description: data.message });
      } else {
        toast.info("Discovery unavailable", { description: data.message });
      }
    },
    onError: (err) => toast.error("Penemuan gagal", { description: err.message }),
  });
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export function useModels(providerId?: string) {
  return useQuery({
    queryKey: ["models", providerId ?? "all"],
    queryFn: () =>
      api<{ models: ModelDTO[] }>(
        `/api/models${providerId ? `?providerId=${providerId}` : ""}`
      ).then((r) => r.models),
  });
}

export function useAddModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      providerId: string;
      modelId: string;
      name?: string;
      contextWindow?: number | null;
      vision?: boolean;
      reasoning?: boolean;
      tools?: boolean;
    }) =>
      api<{ model: ModelDTO }>("/api/models", { method: "POST", json: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["models"] });
      void qc.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (err) => toast.error("Gagal menambah model", { description: err.message }),
  });
}

export function useUpdateModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...patch
    }: {
      id: string;
      name?: string;
      contextWindow?: number | null;
      vision?: boolean;
      reasoning?: boolean;
      tools?: boolean;
    }) =>
      api<{ model: ModelDTO }>(`/api/models/${id}`, { method: "PATCH", json: patch }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["models"] });
    },
    onError: (err) => toast.error("Gagal memperbarui model", { description: err.message }),
  });
}

export function useDeleteModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ deleted: boolean }>(`/api/models/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["models"] });
      void qc.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (err) => toast.error("Gagal menghapus model", { description: err.message }),
  });
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: () => api<{ agents: AgentDTO[] }>("/api/agents").then((r) => r.agents),
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      description?: string | null;
      systemPrompt: string;
      temperature?: number | null;
      providerId?: string | null;
      modelKey?: string | null;
      icon?: string;
    }) => api<{ agent: AgentDTO }>("/api/agents", { method: "POST", json: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["agents"] }),
    onError: (err) => toast.error("Gagal menyimpan agent", { description: err.message }),
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Record<string, unknown>) =>
      api<{ agent: AgentDTO }>(`/api/agents/${id}`, { method: "PATCH", json: patch }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["agents"] }),
    onError: (err) => toast.error("Gagal memperbarui agent", { description: err.message }),
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ deleted: boolean }>(`/api/agents/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["agents"] }),
    onError: (err) => toast.error("Gagal menghapus agent", { description: err.message }),
  });
}

// ---------------------------------------------------------------------------
// System views
// ---------------------------------------------------------------------------

export function useGenerations(limit = 100) {
  return useQuery({
    queryKey: ["generations", limit],
    queryFn: () =>
      api<{ generations: PublicGenerationState[] }>(
        `/api/generations?limit=${limit}`
      ).then((r) => r.generations),
    refetchInterval: 15_000,
  });
}

export function useActivity(limit = 100) {
  return useQuery({
    queryKey: ["activity", limit],
    queryFn: () =>
      api<{ events: ActivityDTO[] }>(`/api/activity?limit=${limit}`).then(
        (r) => r.events
      ),
    refetchInterval: 15_000,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () =>
      api<{ settings: WorkspaceSettings }>("/api/settings").then((r) => r.settings),
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      api<{ settings: WorkspaceSettings }>("/api/settings", {
        method: "PUT",
        json: patch,
      }),
    onSuccess: (data) => {
      qc.setQueryData(["settings"], data.settings);
    },
    onError: (err) => toast.error("Gagal menyimpan pengaturan", { description: err.message }),
  });
}

export function useSearch(query: string, enabled = true) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: () =>
      api<{
        results: { id: string; title: string; snippet: string | null; updatedAt: string }[];
      }>(`/api/search?q=${encodeURIComponent(query)}`).then((r) => r.results),
    enabled: enabled && query.trim().length > 0,
    staleTime: 30_000,
  });
}

// re-exports for convenience
export type { UseMutationResult };
