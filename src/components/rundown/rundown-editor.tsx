// Rundown editor — the core workspace: inline-editable meta, derived
// timeline strip, spreadsheet-style segment table, AI segment extension,
// and one-click professional PDF export.

"use client";

import { memo, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  FileDown,
  ListChecks,
  MapPin,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
  Flag,
  Loader2,
} from "lucide-react";
import {
  useRundown,
  useUpdateRundown,
  useUpdateSegment,
  useDeleteSegment,
  useAddSegment,
  useReorderSegments,
  useDuplicateRundown,
  useDeleteRundown,
  useGenerateRundownAI,
} from "@/hooks/mythicalmind/rundown-queries";
import { useWorkspace } from "@/store/workspace-store";
import {
  computeTimeline,
  endTimeOf,
  formatDurationIndo,
  sanitizeClockInput,
  sanitizeDurationInput,
} from "@/lib/rundown/time";
import { exportRundownPDF } from "@/lib/rundown/pdf";
import { RUNDOWN_CATEGORY_LABELS, type RundownDetail, type TimelineSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function EditableField({
  label,
  icon: Icon,
  value,
  placeholder,
  onCommit,
  type = "text",
  className,
  multiline,
}: {
  label: string;
  icon?: React.ElementType;
  value: string;
  placeholder: string;
  onCommit: (next: string) => void;
  type?: string;
  className?: string;
  multiline?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFocused(false);
    const next = e.target.value.trim();
    if (next !== value) onCommit(next);
  };
  const shared = cn(
    "w-full bg-transparent border-0 outline-none px-1.5 py-1 rounded-md text-[13px] hover:bg-white/[0.04] focus:bg-white/[0.06] transition-colors placeholder:text-muted-foreground/40",
    className
  );
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-1.5 min-w-0",
        focused ? "border-[var(--aurora-accent)]/45 bg-white/[0.03]" : "border-white/8 bg-white/[0.02]"
      )}
    >
      {Icon && <Icon className="size-3.5 text-muted-foreground/60 flex-none ml-1" />}
      <div className="flex-1 min-w-0">
        {multiline ? (
          <Textarea
            aria-label={label}
            defaultValue={value}
            placeholder={placeholder}
            onFocus={() => setFocused(true)}
            onBlur={handleBlur}
            rows={1}
            className={cn(shared, "resize-none min-h-0")}
          />
        ) : (
          <Input
            type={type}
            aria-label={label}
            defaultValue={value}
            placeholder={placeholder}
            onFocus={() => setFocused(true)}
            onBlur={handleBlur}
            className={shared}
          />
        )}
      </div>
    </div>
  );
}

/** Proportional visual timeline — segments as colored blocks. */
function TimelineStrip({ slots }: { slots: TimelineSlot[] }) {
  const total = slots.reduce((s, x) => s + x.durationMinutes, 0);
  if (total === 0) return null;
  const colors = [
    "var(--aurora-accent)",
    "var(--aurora-accent-2)",
    "#2dd4bf",
    "#e879f9",
    "#7dd3fc",
    "#c4b5fd",
  ];
  return (
    <div className="glass rounded-xl p-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <Clock3 className="size-3.5 text-[var(--aurora-accent-2)]" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
          Linimasa
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground/70 tabular-nums">
          {slots[0]?.startTime} – {slots[slots.length - 1]?.endTime} · {formatDurationIndo(total)}
        </span>
      </div>
      <div
        className="flex h-7 rounded-lg overflow-hidden gap-[2px] bg-white/[0.03]"
        role="img"
        aria-label={`Linimasa ${slots.length} segmen dengan total durasi ${formatDurationIndo(total)}`}
      >
        {slots.map((slot) => (
          <Tooltip key={slot.segment.id}>
            <TooltipTrigger asChild>
              <div
                className="h-full min-w-[10px] opacity-80 hover:opacity-100 transition-opacity cursor-default"
                style={{
                  width: `${(slot.durationMinutes / total) * 100}%`,
                  background: `linear-gradient(135deg, ${colors[slot.index % colors.length]}, ${
                    colors[(slot.index + 1) % colors.length]
                  })`,
                }}
              />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs max-w-[240px]">
              <div className="font-medium">
                {slot.startTime} – {slot.endTime} · {formatDurationIndo(slot.durationMinutes)}
              </div>
              <div className="text-muted-foreground">{slot.segment.title}</div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segment row — spreadsheet-style, commits on blur
// ---------------------------------------------------------------------------

const SegmentRow = memo(function SegmentRow({
  slot,
  isLast,
  onPatch,
  onDelete,
  onMove,
}: {
  slot: TimelineSlot;
  isLast: boolean;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const seg = slot.segment;

  return (
    <div className="group/seg rounded-xl border border-white/6 bg-white/[0.02] hover:border-white/12 transition-colors">
      <div className="flex items-center gap-2 px-2.5 py-2 md:py-0 md:h-[54px]">
        {/* No + time */}
        <div className="w-[92px] flex-none md:flex md:flex-col md:items-center md:justify-center md:gap-0.5">
          <div className="text-[11px] text-muted-foreground/55 tabular-nums hidden md:block">
            #{slot.index + 1}
          </div>
          <div className="text-[12px] font-semibold tabular-nums text-foreground/95 md:text-[12.5px]">
            {slot.startTime}
          </div>
          <div className="text-[10.5px] text-muted-foreground/55 tabular-nums hidden md:block">
            s.d. {slot.endTime}
          </div>
        </div>

        {/* Duration */}
        <div className="flex-none w-[74px] hidden md:flex items-center justify-center">
          <input
            aria-label={`Durasi segmen ${seg.title} dalam menit`}
            type="number"
            min={1}
            max={600}
            defaultValue={seg.durationMinutes}
            onBlur={(e) => {
              const next = sanitizeDurationInput(e.target.value, seg.durationMinutes);
              if (next !== seg.durationMinutes) {
                e.target.value = String(next);
                onPatch(seg.id, { durationMinutes: next });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-[58px] h-7 text-center text-[12px] tabular-nums bg-white/[0.04] border border-white/8 rounded-md outline-none focus:border-[var(--aurora-accent)]/50"
          />
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <input
            aria-label={`Judul segmen ${slot.index + 1}`}
            defaultValue={seg.title}
            placeholder="Nama aktivitas…"
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next && next !== seg.title) onPatch(seg.id, { title: next });
              else if (!next) e.target.value = seg.title;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-full bg-transparent outline-none px-1.5 py-1 rounded-md text-[13.5px] font-medium hover:bg-white/[0.05] focus:bg-white/[0.07] transition-colors placeholder:text-muted-foreground/40"
          />
        </div>

        {/* PIC */}
        <div className="flex-none w-[120px] hidden lg:block">
          <input
            aria-label={`PIC segmen ${seg.title}`}
            defaultValue={seg.pic ?? ""}
            placeholder="PIC…"
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next !== (seg.pic ?? "")) onPatch(seg.id, { pic: next });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-full bg-transparent outline-none px-1.5 py-1 rounded-md text-[12px] text-muted-foreground hover:bg-white/[0.05] focus:bg-white/[0.07] focus:text-foreground transition-colors placeholder:text-muted-foreground/35"
          />
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="size-7 rounded-lg flex items-center justify-center text-muted-foreground/70 hover:bg-white/10 hover:text-foreground transition-colors flex-none"
          aria-expanded={expanded}
          aria-label={`Detail segmen ${seg.title}`}
        >
          <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
        </button>

        {/* Row actions */}
        <div className="flex items-center gap-0.5 flex-none">
          <button
            onClick={() => onMove(seg.id, -1)}
            disabled={slot.index === 0}
            className="size-7 rounded-lg flex items-center justify-center text-muted-foreground/70 hover:bg-white/10 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
            aria-label="Naikkan segmen"
          >
            <ArrowUp className="size-3.5" />
          </button>
          <button
            onClick={() => onMove(seg.id, 1)}
            disabled={isLast}
            className="size-7 rounded-lg flex items-center justify-center text-muted-foreground/70 hover:bg-white/10 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
            aria-label="Turunkan segmen"
          >
            <ArrowDown className="size-3.5" />
          </button>
          <button
            onClick={() => onDelete(seg.id)}
            className="size-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:bg-destructive/15 hover:text-destructive transition-colors opacity-0 group-hover/seg:opacity-100 focus-visible:opacity-100"
            aria-label={`Hapus segmen ${seg.title}`}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded detail: description + notes */}
      {expanded && (
        <div className="px-3.5 pb-3 pt-0.5 grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/60 mb-1">
              Detail
            </div>
            <Textarea
              aria-label={`Detail segmen ${seg.title}`}
              defaultValue={seg.description ?? ""}
              placeholder="Deskripsi aktivitas…"
              rows={2}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next !== (seg.description ?? "")) onPatch(seg.id, { description: next });
              }}
              className="text-[12.5px] bg-white/[0.04] border-white/8 resize-none"
            />
          </div>
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/60 mb-1">
              Catatan
            </div>
            <Textarea
              aria-label={`Catatan segmen ${seg.title}`}
              defaultValue={seg.notes ?? ""}
              placeholder="Catatan persiapan, hal penting…"
              rows={2}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next !== (seg.notes ?? "")) onPatch(seg.id, { notes: next });
              }}
              className="text-[12.5px] bg-white/[0.04] border-white/8 resize-none"
            />
          </div>
        </div>
      )}

      {/* Mobile-only compact info */}
      <div className="md:hidden px-3 pb-2 flex items-center gap-3 text-[11px] text-muted-foreground/80">
        <span className="tabular-nums">{formatDurationIndo(slot.durationMinutes)}</span>
        <span>· s.d. {slot.endTime}</span>
        {seg.pic && (
          <span className="inline-flex items-center gap-1 truncate">
            <UserRound className="size-3" />
            {seg.pic}
          </span>
        )}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// AI extend dialog
// ---------------------------------------------------------------------------

function AIExtendDialog({
  open,
  onOpenChange,
  rundown,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rundown: RundownDetail;
}) {
  const generateAI = useGenerateRundownAI();
  const addSegment = useAddSegment();
  const [instruction, setInstruction] = useState("");

  const timeline = computeTimeline(rundown, rundown.segments);

  const run = () => {
    if (!instruction.trim()) return;
    generateAI.mutate(
      {
        title: rundown.title,
        eventType: rundown.eventType,
        category: rundown.category,
        startTime: rundown.startTime,
        mode: "extend",
        notes: instruction.trim(),
        existingSegments: rundown.segments.map((s) => ({
          title: s.title,
          durationMinutes: s.durationMinutes,
        })),
      },
      {
        onSuccess: (data) => {
          // append returned segments sequentially
          const segments = data.rundown.segments;
          const append = async () => {
            for (const s of segments) {
              await addSegment.mutateAsync({
                rundownId: rundown.id,
                title: s.title,
                durationMinutes: s.durationMinutes,
                description: s.description,
                pic: s.pic,
                notes: s.notes,
              });
            }
          };
          void append().then(() => {
            toast.success(`${segments.length} segmen AI ditambahkan`);
            setInstruction("");
            onOpenChange(false);
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass rounded-2xl border-white/10 max-w-[480px] p-0 top-[22%] translate-y-0">
        <div className="p-5 space-y-3.5">
          <DialogTitle className="text-[15.5px] font-semibold flex items-center gap-2.5">
            <span className="size-8 rounded-lg bg-[var(--aurora-accent)]/15 border border-[var(--aurora-accent)]/25 flex items-center justify-center">
              <Sparkles className="size-4 text-[var(--aurora-accent)]" />
            </span>
            Tambah segmen dengan AI
          </DialogTitle>
          <DialogDescription className="text-[12.5px] leading-relaxed">
            Ceritakan bagian apa yang masih kurang. AI mengetahui {rundown.segments.length} segmen
            yang sudah ada (total {formatDurationIndo(rundown.totalMinutes)}
            {timeline.length > 0 && `, berakhir ${endTimeOf(rundown)}`}) dan hanya menambahkan yang baru.
          </DialogDescription>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="mis. tambahkan sesi door prize setelah talkshow dan arak-arakan penutup"
            rows={3}
            className="text-[13px] bg-white/[0.04] border-white/10 resize-none"
            aria-label="Instruksi segmen tambahan"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="h-9 border-white/12" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button
              onClick={run}
              disabled={generateAI.isPending || !instruction.trim()}
              className="h-9 bg-[var(--aurora-accent)] hover:bg-[var(--aurora-accent)]/85 text-white"
            >
              {generateAI.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Susun segmen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------

export function RundownEditor({ rundownId }: { rundownId: string }) {
  const { closeRundown } = useWorkspace();
  const { data, isLoading, error } = useRundown(rundownId);
  const updateRundown = useUpdateRundown();
  const updateSegment = useUpdateSegment();
  const deleteSegment = useDeleteSegment();
  const addSegment = useAddSegment();
  const reorder = useReorderSegments();
  const duplicate = useDuplicateRundown();
  const del = useDeleteRundown();

  const [newTitle, setNewTitle] = useState("");
  const [newDuration, setNewDuration] = useState("15");
  const [exporting, setExporting] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const rundown = data?.rundown ?? null;
  const timeline = useMemo(
    () => (rundown ? computeTimeline(rundown, rundown.segments) : []),
    [rundown]
  );

  const patchRundown = (patch: Record<string, unknown>) => {
    updateRundown.mutate({ id: rundownId, ...patch });
  };

  const handleMove = (segmentId: string, direction: -1 | 1) => {
    if (!rundown) return;
    const ids = rundown.segments.map((s) => s.id);
    const index = ids.indexOf(segmentId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate({ rundownId, segmentIds: ids });
  };

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title || !rundown) return;
    const duration = sanitizeDurationInput(newDuration, 15);
    addSegment.mutate(
      { rundownId, title, durationMinutes: duration },
      {
        onSuccess: () => {
          setNewTitle("");
          setNewDuration("15");
        },
      }
    );
  };

  const handleExport = async () => {
    if (!rundown) return;
    setExporting(true);
    try {
      await exportRundownPDF(rundown);
      const slug =
        rundown.title
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .slice(0, 48) || "rundown";
      toast.success("PDF berhasil diekspor", {
        description: `rundown-${slug}.pdf`,
      });
    } catch (err) {
      toast.error("Ekspor PDF gagal", {
        description: err instanceof Error ? err.message : "Terjadi kesalahan tak terduga.",
      });
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-[920px] mx-auto px-4 sm:px-6 py-8 space-y-4">
          <Skeleton className="h-9 w-64 rounded-lg bg-white/[0.04]" />
          <Skeleton className="h-[72px] rounded-xl bg-white/[0.035]" />
          <Skeleton className="h-9 rounded-xl bg-white/[0.035]" />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[54px] rounded-xl bg-white/[0.03]" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !rundown) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-[360px] p-6">
          <div className="text-[15px] font-medium">Rundown tidak dapat dimuat</div>
          <p className="text-[12.5px] text-muted-foreground mt-1.5 leading-relaxed">
            {error?.message ?? "Rundown mungkin sudah dihapus."}
          </p>
          <Button variant="outline" className="mt-4 h-9 border-white/12" onClick={closeRundown}>
            <ArrowLeft className="size-4" />
            Kembali ke pustaka
          </Button>
        </div>
      </div>
    );
  }

  const isFinal = rundown.status === "final";

  return (
    <div className="h-full overflow-y-auto" key={rundown.updatedAt}>
      <div className="max-w-[920px] mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={closeRundown}
            className="text-muted-foreground flex-none -ml-2 mt-1"
            aria-label="Kembali ke pustaka rundown"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex-1 min-w-[220px]">
            <input
              aria-label="Judul rundown"
              defaultValue={rundown.title}
              key={`title-${rundown.updatedAt}`}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next && next !== rundown.title) patchRundown({ title: next });
                else if (!next) e.target.value = rundown.title;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="w-full bg-transparent outline-none text-[20px] sm:text-[23px] font-semibold tracking-tight rounded-lg px-1.5 py-0.5 -ml-1.5 hover:bg-white/[0.04] focus:bg-white/[0.06] transition-colors"
            />
            <div className="flex flex-wrap items-center gap-2 mt-2 px-1">
              <Badge variant="secondary" className="h-5.5 text-[10.5px] gap-1">
                <Flag className="size-2.5" />
                {RUNDOWN_CATEGORY_LABELS[rundown.category]}
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  "h-5.5 text-[10.5px]",
                  isFinal
                    ? "bg-emerald-400/12 text-emerald-300 border-emerald-400/25"
                    : "bg-white/[0.04] text-muted-foreground"
                )}
              >
                {isFinal ? "Final" : "Draf"}
              </Badge>
              {rundown.source === "ai" && (
                <Badge variant="secondary" className="h-5.5 text-[10.5px] gap-1 bg-[var(--aurora-accent)]/12 text-[var(--aurora-accent)] border-[var(--aurora-accent)]/25">
                  <Sparkles className="size-2.5" />
                  Disusun AI
                </Badge>
              )}
              <span className="text-[11.5px] text-muted-foreground/70">
                {rundown.segmentCount} segmen · total {formatDurationIndo(rundown.totalMinutes)} ·
                selesai {endTimeOf(rundown)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-none">
            <Button
              onClick={handleExport}
              disabled={exporting || rundown.segments.length === 0}
              className="h-9 bg-[var(--aurora-accent)] hover:bg-[var(--aurora-accent)]/85 text-white shadow-[0_0_24px_-8px_var(--aurora-accent)]"
            >
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
              Ekspor PDF
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 border-white/12" aria-label="Menu rundown">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() =>
                    patchRundown({ status: isFinal ? "draft" : "final" })
                  }
                >
                  <Check className="size-3.5" />
                  {isFinal ? "Kembalikan ke draf" : "Tandai final"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => duplicate.mutate(rundown.id)} disabled={duplicate.isPending}>
                  <Copy className="size-3.5" /> Duplikat rundown
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    if (window.confirm(`Hapus "${rundown.title}"?`)) {
                      del.mutate(rundown.id, { onSuccess: closeRundown });
                    }
                  }}
                >
                  <Trash2 className="size-3.5" /> Hapus rundown
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <div className="space-y-1">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/60 px-1">
              Tanggal
            </div>
            <EditableField
              label="Tanggal acara"
              icon={CalendarDays}
              type="date"
              value={rundown.eventDate ? rundown.eventDate.slice(0, 10) : ""}
              placeholder="—"
              onCommit={(next) => {
                if (next === (rundown.eventDate ? rundown.eventDate.slice(0, 10) : "")) return;
                patchRundown({
                  eventDate: next ? new Date(`${next}T00:00:00`).toISOString() : null,
                });
              }}
            />
          </div>
          <div className="space-y-1">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/60 px-1">
              Jam mulai
            </div>
            <EditableField
              label="Jam mulai"
              icon={Clock3}
              type="time"
              value={rundown.startTime}
              placeholder="08:00"
              onCommit={(next) => patchRundown({ startTime: sanitizeClockInput(next, rundown.startTime) })}
            />
          </div>
          <div className="space-y-1">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/60 px-1">
              Lokasi
            </div>
            <EditableField
              label="Lokasi"
              icon={MapPin}
              value={rundown.venue ?? ""}
              placeholder="Tambah lokasi…"
              onCommit={(next) => patchRundown({ venue: next })}
            />
          </div>
          <div className="space-y-1">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/60 px-1">
              Penyelenggara
            </div>
            <EditableField
              label="Penyelenggara"
              icon={UserRound}
              value={rundown.organizer ?? ""}
              placeholder="Nama panitia / org…"
              onCommit={(next) => patchRundown({ organizer: next })}
            />
          </div>
        </div>

        {/* Timeline */}
        {timeline.length > 0 && <TimelineStrip slots={timeline} />}

        {/* Segments */}
        <section aria-label="Segmen rundown">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[13px] font-semibold text-foreground/90 flex items-center gap-2">
              <ListChecks className="size-4 text-[var(--aurora-accent-2)]" />
              Segmen acara
            </h2>
            <Button
              variant="outline"
              size="sm"
              className="h-7.5 text-[12px] border-white/12 gap-1.5"
              onClick={() => setAiOpen(true)}
            >
              <Sparkles className="size-3.5 text-[var(--aurora-accent)]" />
              Tambah dengan AI
            </Button>
          </div>

          {/* column header (desktop) */}
          <div className="hidden md:grid grid-cols-[92px_74px_1fr_120px_28px_76px] gap-2 px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/50">
            <span>Waktu</span>
            <span className="text-center">Durasi</span>
            <span>Aktivitas</span>
            <span className="hidden lg:block">PIC</span>
            <span />
            <span className="text-right">Aksi</span>
          </div>

          <div className="space-y-1.5">
            {timeline.map((slot) => (
              <SegmentRow
                key={`${slot.segment.id}-${slot.segment.updatedAt}`}
                slot={slot}
                isLast={slot.index === timeline.length - 1}
                onPatch={(id, patch) => updateSegment.mutate({ id, ...patch })}
                onDelete={(id) => {
                  if (window.confirm(`Hapus segmen "${slot.segment.title}"?`)) {
                    deleteSegment.mutate(id);
                  }
                }}
                onMove={handleMove}
              />
            ))}

            {timeline.length === 0 && (
              <div className="glass rounded-xl p-8 text-center">
                <ListChecks className="size-7 mx-auto text-muted-foreground/40" />
                <div className="text-[13.5px] font-medium mt-3">Rundown masih kosong</div>
                <p className="text-[12px] text-muted-foreground/80 mt-1 max-w-[340px] mx-auto leading-relaxed">
                  Tambah segmen pertama di bawah, atau minta AI menyusun dari nol lewat
                  tombol "Tambah dengan AI".
                </p>
              </div>
            )}
          </div>

          {/* Add segment row */}
          <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-dashed border-white/12 bg-white/[0.015] px-2.5 py-2">
            <div className="w-[92px] flex-none text-[12px] text-muted-foreground/60 tabular-nums hidden md:block">
              {timeline.length > 0 ? `setelah ${timeline[timeline.length - 1].endTime}` : "segmen 1"}
            </div>
            <input
              aria-label="Durasi segmen baru dalam menit"
              type="number"
              min={1}
              max={600}
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTitle.trim()) handleAdd();
              }}
              className="w-[58px] h-7 flex-none text-center text-[12px] tabular-nums bg-white/[0.04] border border-white/8 rounded-md outline-none focus:border-[var(--aurora-accent)]/50"
            />
            <input
              aria-label="Judul segmen baru"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTitle.trim()) handleAdd();
              }}
              placeholder="Tambah aktivitas baru… (Enter untuk simpan)"
              className="flex-1 min-w-0 bg-transparent outline-none px-1.5 py-1 text-[13px] rounded-md hover:bg-white/[0.04] focus:bg-white/[0.06] transition-colors placeholder:text-muted-foreground/40"
            />
            <Button
              size="icon"
              onClick={handleAdd}
              disabled={!newTitle.trim() || addSegment.isPending}
              className="size-7 rounded-lg bg-[var(--aurora-accent)]/20 hover:bg-[var(--aurora-accent)]/35 text-[var(--aurora-accent)] border border-[var(--aurora-accent)]/25"
              aria-label="Tambah segmen"
            >
              {addSegment.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
            </Button>
          </div>
        </section>

        <p className="text-[11px] text-muted-foreground/45 leading-relaxed">
          Semua perubahan tersimpan otomatis saat kamu selesai mengedit (blur / Enter).
          Jam tiap segmen dihitung dari jam mulai + durasi — selalu konsisten.
        </p>
      </div>

      <AIExtendDialog open={aiOpen} onOpenChange={setAiOpen} rundown={rundown} />
    </div>
  );
}
