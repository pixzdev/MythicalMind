// Rundown Studio — typed data-access layer (TanStack Query).

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AIRundownResult, RundownDetail, RundownSummary } from "@/lib/types";
import { api } from "@/hooks/mythicalmind/queries";
import { useWorkspace } from "@/store/workspace-store";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useRundowns(category?: string) {
  return useQuery({
    queryKey: ["rundowns", category ?? "all"],
    queryFn: () =>
      api<{ rundowns: RundownSummary[] }>(
        `/api/rundowns${category ? `?category=${category}` : ""}`
      ).then((r) => r.rundowns),
    refetchOnWindowFocus: true,
  });
}

export function useRundown(id: string | null) {
  return useQuery({
    queryKey: ["rundown", id],
    queryFn: () => api<{ rundown: RundownDetail }>(`/api/rundowns/${id}`),
    enabled: Boolean(id),
  });
}

// ---------------------------------------------------------------------------
// Mutations — rundown meta
// ---------------------------------------------------------------------------

export interface CreateRundownInput {
  title: string;
  category?: string;
  eventType?: string;
  description?: string | null;
  eventDate?: string | null;
  venue?: string | null;
  organizer?: string | null;
  startTime?: string;
  status?: string;
  source?: string;
  segments?: {
    title: string;
    durationMinutes: number;
    description?: string | null;
    pic?: string | null;
    notes?: string | null;
    materials?: string | null;
  }[];
  templateId?: string | null;
  duplicateOf?: string | null;
}

export function useCreateRundown() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRundownInput) =>
      api<{ rundown: RundownDetail }>("/api/rundowns", {
        method: "POST",
        json: input,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rundowns"] });
    },
    onError: (err) => toast.error("Gagal membuat rundown", { description: err.message }),
  });
}

export function useUpdateRundown() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Record<string, unknown>) =>
      api<{ rundown: RundownDetail }>(`/api/rundowns/${id}`, {
        method: "PATCH",
        json: patch,
      }),
    onSuccess: (data, vars) => {
      qc.setQueryData(["rundown", vars.id], data);
      void qc.invalidateQueries({ queryKey: ["rundowns"] });
    },
    onError: (err) => toast.error("Gagal menyimpan perubahan", { description: err.message }),
  });
}

export function useDeleteRundown() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ deleted: boolean }>(`/api/rundowns/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rundowns"] });
    },
    onError: (err) => toast.error("Gagal menghapus rundown", { description: err.message }),
  });
}

export function useDuplicateRundown() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ rundown: RundownDetail }>("/api/rundowns", {
        method: "POST",
        json: { title: "salinan", duplicateOf: id },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rundowns"] });
      toast.success("Rundown diduplikasi");
    },
    onError: (err) => toast.error("Gagal menduplikasi", { description: err.message }),
  });
}

// ---------------------------------------------------------------------------
// Mutations — segments
// ---------------------------------------------------------------------------

export function useAddSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      rundownId,
      ...input
    }: {
      rundownId: string;
      title: string;
      durationMinutes: number;
      description?: string | null;
      pic?: string | null;
      notes?: string | null;
    }) =>
      api<{ rundown: RundownDetail }>(`/api/rundowns/${rundownId}/segments`, {
        method: "POST",
        json: input,
      }),
    onSuccess: (data) => {
      qc.setQueryData(["rundown", data.rundown.id], data);
      void qc.invalidateQueries({ queryKey: ["rundowns"] });
    },
    onError: (err) => toast.error("Gagal menambah segmen", { description: err.message }),
  });
}

export function useUpdateSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Record<string, unknown>) =>
      api<{ rundown: RundownDetail }>(`/api/segments/${id}`, {
        method: "PATCH",
        json: patch,
      }),
    onSuccess: (data) => {
      qc.setQueryData(["rundown", data.rundown.id], data);
      void qc.invalidateQueries({ queryKey: ["rundowns"] });
    },
    onError: (err) => toast.error("Gagal menyimpan segmen", { description: err.message }),
  });
}

export function useDeleteSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ rundown: RundownDetail }>(`/api/segments/${id}`, { method: "DELETE" }),
    onSuccess: (data) => {
      qc.setQueryData(["rundown", data.rundown.id], data);
      void qc.invalidateQueries({ queryKey: ["rundowns"] });
    },
    onError: (err) => toast.error("Gagal menghapus segmen", { description: err.message }),
  });
}

export function useReorderSegments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rundownId, segmentIds }: { rundownId: string; segmentIds: string[] }) =>
      api<{ rundown: RundownDetail }>(`/api/rundowns/${rundownId}/reorder`, {
        method: "POST",
        json: { segmentIds },
      }),
    onSuccess: (data) => {
      qc.setQueryData(["rundown", data.rundown.id], data);
    },
    onError: (err) => toast.error("Gagal mengubah urutan", { description: err.message }),
  });
}

// ---------------------------------------------------------------------------
// AI generation
// ---------------------------------------------------------------------------

export interface GenerateRundownAIInput {
  title: string;
  eventType: string;
  category: string;
  eventDate?: string | null;
  startTime?: string | null;
  targetDurationMinutes?: number | null;
  audience?: string | null;
  goal?: string | null;
  notes?: string | null;
  mode?: "full" | "extend";
  existingSegments?: { title: string; durationMinutes: number }[];
}

export function useGenerateRundownAI() {
  return useMutation({
    mutationFn: (input: GenerateRundownAIInput) =>
      api<{ rundown: AIRundownResult }>("/api/ai/rundown", {
        method: "POST",
        json: input,
      }),
    onError: (err) =>
      toast.error("AI gagal menyusun rundown", { description: err.message }),
  });
}

// ---------------------------------------------------------------------------
// Navigation helper — open rundown in the editor after mutations
// ---------------------------------------------------------------------------

export function useOpenRundown() {
  return useWorkspace((s) => s.openRundown);
}
