// Rundown Studio — typed data-access layer (TanStack Query).

"use client";

import { useCallback, useRef, useState } from "react";
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
// AI generation — SSE stream with live pipeline phases
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
  mode?: "full" | "extend" | "replan";
  instruction?: string | null;
  existingSegments?: {
    title: string;
    durationMinutes: number;
    startTime?: string | null;
  }[];
}

export type AIRundownPhaseState = {
  phase: string;
  label: string;
  detail: string | null;
  at: number;
};

/**
 * Streams /api/ai/rundown and surfaces the real pipeline phases as they
 * happen (understanding → provider → streaming → parse → validate → done).
 * Returns live phase history plus the final result or a friendly error.
 */
export function useAIRundownStream() {
  const [phases, setPhases] = useState<AIRundownPhaseState[]>([]);
  const [result, setResult] = useState<AIRundownResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const runIdRef = useRef(0);

  const run = useCallback(async (input: GenerateRundownAIInput): Promise<AIRundownResult | null> => {
    const runId = ++runIdRef.current;
    setPhases([]);
    setResult(null);
    setError(null);
    setIsPending(true);
    const isCurrent = () => runIdRef.current === runId;
    let outcome: AIRundownResult | null = null;
    try {
      const res = await fetch("/api/ai/rundown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok || !res.body) {
        // validation failures answer with the normal JSON error envelope
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(payload?.error?.message ?? "Permintaan ditolak server.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          let event: {
            type: string;
            phase?: string;
            label?: string;
            detail?: string | null;
            at?: number;
            rundown?: AIRundownResult;
            code?: string;
            message?: string;
          };
          try {
            event = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }
          if (!isCurrent()) return null;
          if (event.type === "phase" && event.label) {
            const phase: AIRundownPhaseState = {
              phase: event.phase ?? "-",
              label: event.label,
              detail: event.detail ?? null,
              at: event.at ?? 0,
            };
            setPhases((prev) => [...prev, phase]);
          } else if (event.type === "result" && event.rundown) {
            outcome = event.rundown;
            setResult(event.rundown);
          } else if (event.type === "error") {
            throw new Error(event.message ?? "AI gagal menyusun rundown.");
          }
        }
      }
    } catch (err) {
      if (!isCurrent()) return null;
      const message = err instanceof Error ? err.message : "AI gagal menyusun rundown.";
      setError(message);
      toast.error("AI gagal menyusun rundown", { description: message });
    } finally {
      if (isCurrent()) setIsPending(false);
    }
    return outcome;
  }, []);

  return { phases, result, error, isPending, run };
}

export function useReplaceSegments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      rundownId,
      segments,
    }: {
      rundownId: string;
      segments: {
        title: string;
        durationMinutes: number;
        description?: string | null;
        pic?: string | null;
        notes?: string | null;
      }[];
    }) =>
      api<{ rundown: RundownDetail }>(`/api/rundowns/${rundownId}/segments`, {
        method: "PUT",
        json: { segments },
      }),
    onSuccess: (data) => {
      qc.setQueryData(["rundown", data.rundown.id], data);
      void qc.invalidateQueries({ queryKey: ["rundowns"] });
    },
    onError: (err) => toast.error("Gagal menerapkan jadwal baru", { description: err.message }),
  });
}

// ---------------------------------------------------------------------------
// Navigation helper — open rundown in the editor after mutations
// ---------------------------------------------------------------------------

export function useOpenRundown() {
  return useWorkspace((s) => s.openRundown);
}
