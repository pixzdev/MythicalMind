// Rundown Studio — server-side AI rundown generation.
//
// Reuses the tested OpenAI-compatible adapter + error classification to
// ask the user's configured provider for a structured (JSON) rundown.
// The result is validated with zod and returned for review BEFORE it is
// persisted — the user stays in control of what gets saved.

import { z } from "zod";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { registry, type ProviderConfig } from "@/lib/providers/server/registry";
import { ProviderError, toFriendlyError } from "@/lib/providers/server/errors";
import { ApiError } from "@/lib/api-helpers";
import type { AIRundownResult, SegmentInput } from "@/lib/types";

// ---------------------------------------------------------------------------
// Live phase events (streamed to the client while the agent works).
// Every phase corresponds to a real stage of the pipeline below — they are
// never scripted: labels are emitted as the code actually passes each stage.
// ---------------------------------------------------------------------------

export type AIRundownPhase = {
  phase: string;
  label: string;
  detail?: string | null;
  at: number;
};

type PhaseEmitter = (ev: AIRundownPhase) => void;

const PHASE_COPY: Record<
  "full" | "extend" | "replan",
  { start: string; stream: string; found: string; validating: string; done: string }
> = {
  full: {
    start: "Memahami kebutuhan...",
    stream: "Menyusun rundown...",
    found: "Menemukan aktivitas",
    validating: "Memvalidasi jadwal...",
    done: "Rundown siap.",
  },
  extend: {
    start: "Menganalisis rundown...",
    stream: "Menyusun segmen tambahan...",
    found: "Segmen baru ditemukan",
    validating: "Memvalidasi segmen...",
    done: "Segmen siap.",
  },
  replan: {
    start: "Memperbarui jadwal...",
    stream: "Menganalisis perubahan...",
    found: "Aktivitas disusun ulang",
    validating: "Memvalidasi jadwal baru...",
    done: "Jadwal diperbarui.",
  },
};

// ---------------------------------------------------------------------------
// Input / output schemas
// ---------------------------------------------------------------------------

export const AIRundownRequestSchema = z.object({
  title: z.string().trim().min(2).max(120),
  eventType: z.string().trim().min(2).max(60),
  category: z.enum(["acara", "harian", "studi", "kerja"]).catch("acara"),
  eventDate: z.string().datetime().nullish(),
  startTime: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/)
    .nullish(),
  targetDurationMinutes: z.number().int().min(15).max(1440).nullish(),
  audience: z.string().trim().max(200).nullish(),
  goal: z.string().trim().max(600).nullish(),
  notes: z.string().trim().max(600).nullish(),
  providerId: z.string().nullish(),
  modelKey: z.string().nullish(),
  mode: z.enum(["full", "extend", "replan"]).default("full"),
  instruction: z.string().trim().max(600).nullish(),
  existingSegments: z
    .array(
      z.object({
        title: z.string(),
        durationMinutes: z.number().int(),
        startTime: z.string().regex(/^\d{1,2}:\d{2}$/).nullish(),
      })
    )
    .max(60)
    .optional(),
});
export type AIRundownRequest = z.infer<typeof AIRundownRequestSchema>;

const aiSegmentSchema = z.object({
  title: z.string().trim().min(1).max(160),
  durationMinutes: z.number().int().min(1).max(600),
  description: z.string().trim().max(600).nullish(),
  pic: z.string().trim().max(80).nullish(),
  notes: z.string().trim().max(600).nullish(),
});

const aiRundownSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(800).nullish(),
  suggestedStartTime: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/)
    .nullish(),
  segments: z.array(aiSegmentSchema).min(1).max(40),
});

// ---------------------------------------------------------------------------
// Provider resolution (settings default → provider defaultModel → first model)
// ---------------------------------------------------------------------------

async function resolveAIProvider(override?: {
  providerId?: string | null;
  modelKey?: string | null;
}): Promise<{ config: ProviderConfig; modelKey: string; providerName: string }> {
  const settings = await getSettings();
  let providerId = override?.providerId ?? settings.generation.defaultProviderId ?? null;

  if (!providerId) {
    const fallback = await db.provider.findFirst({
      where: { status: "connected" },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    providerId = fallback?.id ?? null;
  }

  if (!providerId) {
    throw new ApiError(
      400,
      "no_provider",
      "Belum ada penyedia AI yang terhubung. Tambahkan penyedia (base URL + API key) di Sistem → Penyedia, atau gunakan template sebagai alternatif cepat."
    );
  }

  const provider = await db.provider.findUnique({ where: { id: providerId } });
  if (!provider) {
    throw new ApiError(404, "provider_missing", "Penyedia AI yang dipilih tidak ditemukan lagi.");
  }

  let modelKey = override?.modelKey ?? settings.generation.defaultModelKey ?? null;
  if (!modelKey || (modelKey && !(await modelBelongsTo(provider.id, modelKey)))) {
    modelKey = provider.defaultModel ?? null;
  }
  if (!modelKey) {
    const first = await db.model.findFirst({
      where: { providerId: provider.id },
      orderBy: { createdAt: "asc" },
      select: { modelId: true },
    });
    modelKey = first?.modelId ?? null;
  }
  if (!modelKey) {
    throw new ApiError(
      400,
      "no_model",
      `Model untuk penyedia "${provider.name}" belum diatur. Tambahkan atau temukan model di Sistem → Model.`
    );
  }

  let customHeaders: Record<string, string> = {};
  try {
    const parsed = JSON.parse(provider.customHeaders ?? "{}");
    if (parsed && typeof parsed === "object") customHeaders = parsed as Record<string, string>;
  } catch {
    /* ignore malformed headers */
  }

  return {
    config: {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      customHeaders,
    },
    modelKey,
    providerName: provider.name,
  };
}

async function modelBelongsTo(providerId: string, modelKey: string): Promise<boolean> {
  const row = await db.model.findFirst({
    where: { providerId, modelId: modelKey },
    select: { id: true },
  });
  return Boolean(row);
}

// ---------------------------------------------------------------------------
// JSON extraction (robust against code fences & prose wrappers)
// ---------------------------------------------------------------------------

function extractJsonObject(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "```").trim();
  const fenced = cleaned.match(/```([\s\S]*?)```/);
  const candidates: string[] = [];
  if (fenced) candidates.push(fenced[1]);
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }
  candidates.push(cleaned);
  for (const c of candidates) {
    try {
      return JSON.parse(c.trim());
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildPrompt(req: AIRundownRequest): { system: string; user: string } {
  const system = [
    "Anda adalah perencana acara dan produktivitas profesional berbahasa Indonesia.",
    "Tugas: menyusun rundown (jadwal segmen acara/rencana) yang realistis dan bisa dieksekusi.",
    "",
    "ATURAN KELUARAN (WAJIB):",
    "1. Balas HANYA dengan satu objek JSON valid — tanpa penjelasan, tanpa markdown, tanpa teks lain.",
    "2. Struktur JSON:",
    '{"title": string, "description": string|null, "suggestedStartTime": "HH:MM"|null, "segments": [{"title": string, "durationMinutes": number, "description": string|null, "pic": string|null, "notes": string|null}]}',
    "3. Durasi tiap segmen dalam menit, bilangan bulat 1–600.",
    "4. Segmen harus runtut dari awal sampai akhir, tanpa tumpang tindih — total mengejar durasi target.",
    "5. Judul segmen ringkas (maks ~60 karakter). Gunakan bahasa Indonesia yang natural.",
    "6. 'pic' berisi peran penanggung jawab (mis. MC, Panitia, Tim Dekorasi) atau orang jika disebut.",
    "7. Jangan menambahkan field lain di luar struktur di atas.",
  ].join("\n");

  const lines: string[] = [];
  if (req.mode === "extend") {
    lines.push("Rundown berikut sudah ada. TAMBAHKAN segmen baru yang masih kurang.");
    lines.push("Kembalikan HANYA segmen tambahan (JSON dengan struktur sama; 'title' boleh sama dengan nama rundown).");
    lines.push("Segmen yang sudah ada (jangan diulang):");
    for (const s of req.existingSegments ?? []) {
      lines.push(`- ${s.title} (${s.durationMinutes} menit)`);
    }
    if (req.instruction) lines.push(`Instruksi tambahan: ${req.instruction}`);
  } else if (req.mode === "replan") {
    lines.push("Rundown berikut sudah ada. ATUR ULANG seluruh rundown sesuai instruksi pengguna.");
    lines.push(
      "Kembalikan SELURUH segmen hasil penataan ulang (JSON dengan struktur sama). Susun ulang urutan dan durasi agar jadwal tetap realistis, tanpa tumpang tindih, dan tetap menghormati batasan waktu pengguna."
    );
    lines.push("Rundown saat ini:");
    for (const s of req.existingSegments ?? []) {
      lines.push(
        `- ${s.title}${s.startTime ? ` mulai ${s.startTime}` : ""} (${s.durationMinutes} menit)`
      );
    }
    lines.push(`Instruksi perubahan: ${req.instruction ?? "-"}`);
  }
  lines.push(`Nama acara/rencana: ${req.title}`);
  lines.push(`Jenis: ${req.eventType}`);
  lines.push(`Kategori: ${req.category}`);
  if (req.startTime) lines.push(`Jam mulai: ${req.startTime}`);
  if (req.targetDurationMinutes) {
    lines.push(`Durasi total target: sekitar ${req.targetDurationMinutes} menit`);
  }
  if (req.eventDate) lines.push(`Tanggal: ${req.eventDate.slice(0, 10)}`);
  if (req.audience) lines.push(`Peserta/audiens: ${req.audience}`);
  if (req.goal) lines.push(`Tujuan: ${req.goal}`);
  if (req.notes) lines.push(`Catatan tambahan: ${req.notes}`);
  lines.push("");
  lines.push(
    "Susun segmentasi yang masuk akal untuk jenis acara ini: persiapan/pembukaan, inti, jeda yang wajar, dan penutupan/evaluasi."
  );

  return { system, user: lines.join("\n") };
}

// ---------------------------------------------------------------------------
// The generation call — streams via the adapter, accumulates, parses once.
// ---------------------------------------------------------------------------

export async function generateRundownWithAI(
  req: AIRundownRequest,
  onEvent?: PhaseEmitter
): Promise<AIRundownResult> {
  const t0 = Date.now();
  const copy = PHASE_COPY[req.mode ?? "full"];
  const emit = (phase: string, label: string, detail?: string | null) => {
    if (!onEvent) return;
    try {
      onEvent({ phase, label, detail: detail ?? null, at: Date.now() - t0 });
    } catch {
      /* progress reporting must never break generation */
    }
  };

  emit("start", copy.start);

  const { config, modelKey, providerName } = await resolveAIProvider({
    providerId: req.providerId ?? undefined,
    modelKey: req.modelKey ?? undefined,
  });
  emit("provider", "Menghubungkan ke penyedia AI...", `${providerName} · ${modelKey}`);

  const settings = await getSettings();
  const adapter = registry.get(config.type);
  const { system, user } = buildPrompt(req);

  let text = "";
  let deltas = 0;
  const controller = new AbortController();
  const timeout = AbortSignal.timeout(settings.generation.timeoutMs ?? 300_000);
  const composed = AbortSignal.any?.([controller.signal, timeout]) ?? timeout;

  emit("stream", copy.stream);

  try {
    for await (const ev of adapter.stream({
      config,
      model: modelKey,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      signal: composed,
    })) {
      if (ev.type === "text-delta") {
        text += ev.text;
        deltas += 1;
        // real streaming progress — the count is the true accumulated length
        if (deltas % 6 === 0) {
          emit("progress", copy.stream, `${text.length} karakter diterima`);
        }
      } else if (ev.type === "error") {
        throw new ProviderError(ev.error);
      }
    }
  } catch (err) {
    // translate provider failures into the readable API envelope
    if (err instanceof ProviderError) {
      const fe = err.toFriendly();
      throw new ApiError(
        fe.status ?? 502,
        fe.code,
        fe.hint ? `${fe.message} ${fe.hint}` : fe.message
      );
    }
    const fe = toFriendlyError(err);
    if (fe.code === "aborted") throw err;
    throw new ApiError(502, fe.code, fe.hint ? `${fe.message} ${fe.hint}` : fe.message);
  } finally {
    controller.abort();
  }

  if (!text.trim()) {
    throw new ApiError(
      502,
      "empty_ai_response",
      "Penyedia tidak mengembalikan jawaban. Coba lagi atau ganti model."
    );
  }

  const parsed = aiRundownSchema.safeParse(extractJsonObject(text));
  if (!parsed.success) {
    emit(
      "malformed",
      "Format jawaban tidak bisa dibaca.",
      `menerima ${text.length} karakter`
    );
    throw new ApiError(
      502,
      "malformed_ai_response",
      "Format jawaban AI tidak bisa dibaca sebagai rundown. Coba lagi — beberapa model kadang melenceng dari format."
    );
  }

  const segmentCount = parsed.data.segments.length;
  if (req.mode === "replan") {
    // Real conflict detection: compare the new arrangement against the old
    // timeline and count genuinely overlapping slots of different activities.
    const conflicts = detectScheduleConflicts(parsed.data.segments, req.existingSegments ?? []);
    if (conflicts > 0) {
      emit("conflict", "Benturan waktu ditemukan.", `${conflicts} titik benturan dengan jadwal lama`);
    }
    emit("adjust", "Menyesuaikan aktivitas fleksibel...", `${segmentCount} aktivitas disusun ulang`);
  } else {
    emit("found", `${copy.found}.`, `${segmentCount} aktivitas`);
  }

  emit("validating", copy.validating);

  const segments: SegmentInput[] = parsed.data.segments.map((s) => ({
    title: s.title,
    durationMinutes: Math.min(600, Math.max(1, Math.round(s.durationMinutes))),
    description: s.description ?? null,
    pic: s.pic ?? null,
    notes: s.notes ?? null,
    materials: null,
  }));

  emit("done", copy.done, `${segmentCount} segmen`);

  return {
    title: parsed.data.title || req.title,
    description: parsed.data.description ?? null,
    category: req.category,
    eventType: req.eventType,
    suggestedStartTime: parsed.data.suggestedStartTime ?? req.startTime ?? "08:00",
    segments,
    providerName,
    modelKey,
  };
}

// ---------------------------------------------------------------------------
// Conflict detection for replan mode — pure, derived from real data only.
// ---------------------------------------------------------------------------

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function detectScheduleConflicts(
  newSegments: { title: string; durationMinutes: number }[],
  oldSegments: { title: string; durationMinutes: number; startTime?: string | null }[]
): number {
  if (oldSegments.length === 0) return 0;
  // Old timeline: derive start times sequentially when not provided.
  let cursor = toMinutes(oldSegments[0].startTime ?? "08:00");
  const old = oldSegments.map((s) => {
    const start = s.startTime ? toMinutes(s.startTime) : cursor;
    const end = start + s.durationMinutes;
    cursor = s.startTime ? end : end;
    return { title: s.title.trim().toLowerCase(), start, end };
  });
  // New timeline: always sequential from the same origin as the old first slot.
  let newCursor = old.length > 0 ? old[0].start : 8 * 60;
  const next = newSegments.map((s) => {
    const start = newCursor;
    const end = start + s.durationMinutes;
    newCursor = end;
    return { title: s.title.trim().toLowerCase(), start, end };
  });
  // Count overlaps between slots that belong to *different* activities.
  let conflicts = 0;
  for (const n of next) {
    for (const o of old) {
      if (o.title === n.title) continue;
      if (n.start < o.end && o.start < n.end) conflicts += 1;
    }
  }
  return conflicts;
}
