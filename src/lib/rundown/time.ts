// Rundown Studio — time math & Indonesian formatting.
//
// Wall-clock times are DERIVED: rundown.startTime + cumulative segment
// durations. Nothing time-related is stored per segment, so the timeline
// can never drift out of sync.

import type { RundownSummary, SegmentDTO, TimelineSlot } from "@/lib/types";

const HARI_INDO = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

const BULAN_INDO = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** "08:30" → minutes since midnight (510). Invalid input → 0. */
export function parseClockHHMM(value: string): number {
  const m = value?.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return 0;
  return h * 60 + min;
}

/** minutes since midnight → "08:30". Wraps naturally past 24h. */
export function minutesToClock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** 95 → "1j 35m" · 45 → "45m" · 0 → "0m" */
export function formatDurationIndo(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}j`;
  return `${h}j ${m}m`;
}

/** Date → "Kamis, 12 Juni 2026" (Indonesian long form). */
export function formatTanggalIndo(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return `${HARI_INDO[d.getDay()]}, ${d.getDate()} ${BULAN_INDO[d.getMonth()]} ${d.getFullYear()}`;
}

/** Date → "12 Jun 2026" (compact). */
export function formatTanggalSingkat(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const bulan = BULAN_INDO[d.getMonth()].slice(0, 3);
  return `${d.getDate()} ${bulan} ${d.getFullYear()}`;
}

/** Days until a date (negative = past). Today → 0. */
export function hariMenuju(date: Date | string): number {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

/** Countdown label: "hari ini" / "besok" / "3 hari lagi" / "2 hari lalu". */
export function labelHitungMundur(date: Date | string): string {
  const n = hariMenuju(date);
  if (n === 0) return "hari ini";
  if (n === 1) return "besok";
  if (n === 2) return "2 hari lagi";
  if (n > 0) return `${n} hari lagi`;
  if (n === -1) return "kemarin";
  return `${-n} hari lalu`;
}

export function isHariIni(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  return hariMenuju(date) === 0;
}

/** Greeting by local hour: "Selamat pagi" / "siang" / "sore" / "malam". */
export function sapaanIndo(date = new Date()): string {
  const h = date.getHours();
  if (h >= 4 && h < 11) return "Selamat pagi";
  if (h >= 11 && h < 15) return "Selamat siang";
  if (h >= 15 && h < 19) return "Selamat sore";
  return "Selamat malam";
}

/** Relative update label in Indonesian: "baru saja", "5 mnt lalu", "2 hr lalu". */
export function relativeTimeIndo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "baru saja";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} mnt lalu`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} hr lalu`;
  return formatTanggalSingkat(iso) ?? "";
}

/**
 * Build the derived timeline for a rundown.
 * Empty segments → []. Segments sorted by sortOrder.
 */
export function computeTimeline(
  rundown: Pick<RundownSummary, "startTime" | "totalMinutes">,
  segments: SegmentDTO[]
): TimelineSlot[] {
  const sorted = [...segments].sort((a, b) => a.sortOrder - b.sortOrder);
  let cursor = parseClockHHMM(rundown.startTime);
  return sorted.map((segment, index) => {
    const durationMinutes = Math.max(0, segment.durationMinutes);
    const startMinutes = cursor;
    cursor += durationMinutes;
    return {
      segment,
      index,
      startMinutes,
      endMinutes: cursor,
      durationMinutes,
      startTime: minutesToClock(startMinutes),
      endTime: minutesToClock(cursor),
    };
  });
}

/** End-of-day clock for a rundown (start + total minutes). */
export function endTimeOf(
  rundown: Pick<RundownSummary, "startTime" | "totalMinutes">
): string {
  return minutesToClock(parseClockHHMM(rundown.startTime) + rundown.totalMinutes);
}

/** Re-clamp "HH:mm" user input to a valid value; empty → fallback. */
export function sanitizeClockInput(raw: string, fallback = "08:00"): string {
  const m = raw?.trim().match(/^(\d{1,2}):?(\d{0,2})$/);
  if (!m) return fallback;
  let h = Number(m[1]);
  let min = Number(m[2] || 0);
  if (h > 23) h = 23;
  if (min > 59) min = 59;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** "123" → 123; clamped to [1, 1440]. NaN → fallback. */
export function sanitizeDurationInput(raw: string | number, fallback = 15): number {
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[^\d]/g, ""));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1440, Math.max(1, Math.round(n)));
}

export { HARI_INDO, BULAN_INDO };
