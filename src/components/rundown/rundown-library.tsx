// Pustaka Rundown — all saved rundowns with search, category filters,
// quick actions (open, duplicate, delete, export PDF).

"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ClipboardList,
  MoreHorizontal,
  Copy,
  Trash2,
  Search,
  Plus,
  FileDown,
  Clock3,
  CalendarDays,
  BadgeCheck,
  Sparkles,
} from "lucide-react";
import { useRundowns, useDuplicateRundown, useDeleteRundown } from "@/hooks/mythicalmind/rundown-queries";
import { useWorkspace } from "@/store/workspace-store";
import {
  endTimeOf,
  formatDurationIndo,
  formatTanggalSingkat,
  labelHitungMundur,
  relativeTimeIndo,
} from "@/lib/rundown/time";
import { exportRundownPDF } from "@/lib/rundown/pdf";
import { RUNDOWN_CATEGORY_LABELS, type RundownSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORY_FILTERS = [
  { value: "semua", label: "Semua" },
  { value: "acara", label: "Acara" },
  { value: "harian", label: "Rencana Harian" },
  { value: "studi", label: "Belajar" },
  { value: "kerja", label: "Kerja" },
];

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  template: { label: "Template", className: "text-[var(--aurora-accent-2)]/90 bg-[var(--aurora-accent-2)]/10 border-[var(--aurora-accent-2)]/20" },
  ai: { label: "AI", className: "text-[var(--aurora-accent)] bg-[var(--aurora-accent)]/12 border-[var(--aurora-accent)]/25" },
  manual: { label: "Manual", className: "text-muted-foreground bg-white/[0.04] border-white/8" },
};

function RundownCard({
  rundown,
  onOpen,
  onExport,
}: {
  rundown: RundownSummary;
  onOpen: (id: string) => void;
  onExport: (r: RundownSummary) => void;
}) {
  const duplicate = useDuplicateRundown();
  const del = useDeleteRundown();
  const source = SOURCE_BADGE[rundown.source] ?? SOURCE_BADGE.manual;

  return (
    <div
      className="glass rounded-xl p-4 hover:border-white/14 transition-all group cursor-pointer"
      onClick={() => onOpen(rundown.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(rundown.id);
        }
      }}
      aria-label={`Rundown ${rundown.title}`}
    >
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-lg bg-white/[0.045] border border-white/8 flex items-center justify-center flex-none mt-0.5">
          <ClipboardList className="size-4 text-[var(--aurora-accent-2)]/85" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="text-[14px] font-medium leading-snug truncate flex-1 group-hover:text-white transition-colors">
              {rundown.title}
            </h3>
            {rundown.status === "final" && (
              <BadgeCheck className="size-4 text-emerald-400/80 flex-none mt-0.5" aria-label="Status final" />
            )}
            <div
              className="flex-none"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                    aria-label={`Menu untuk ${rundown.title}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => onOpen(rundown.id)}>
                    <ClipboardList className="size-3.5" /> Buka
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onExport(rundown)}>
                    <FileDown className="size-3.5" /> Ekspor PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => duplicate.mutate(rundown.id)} disabled={duplicate.isPending}>
                    <Copy className="size-3.5" /> Duplikat
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      if (window.confirm(`Hapus "${rundown.title}"? Semua segmennya ikut terhapus.`)) {
                        del.mutate(rundown.id);
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" /> Hapus
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11.5px] text-muted-foreground/85">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3" />
              {rundown.eventDate
                ? `${formatTanggalSingkat(rundown.eventDate)} · ${labelHitungMundur(rundown.eventDate)}`
                : RUNDOWN_CATEGORY_LABELS[rundown.category]}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3" />
              {rundown.startTime}–{endTimeOf(rundown)} · {formatDurationIndo(rundown.totalMinutes)}
            </span>
            <span>{rundown.segmentCount} segmen</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px]",
                source.className
              )}
            >
              {rundown.source === "ai" && <Sparkles className="size-2.5" />}
              {source.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RundownLibrary() {
  const { openRundown, openWizard } = useWorkspace();
  const [filter, setFilter] = useState("semua");
  const [query, setQuery] = useState("");
  const { data: rundowns, isLoading } = useRundowns();
  const duplicate = useDuplicateRundown();
  const del = useDeleteRundown();

  const list = useMemo(() => {
    let items = rundowns ?? [];
    if (filter !== "semua") items = items.filter((r) => r.category === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.venue ?? "").toLowerCase().includes(q) ||
          (r.organizer ?? "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [rundowns, filter, query]);

  const handleExport = (r: RundownSummary) => {
    // export from summary: build a light detail shape (segments fetched first)
    void (async () => {
      try {
        const res = await fetch(`/api/rundowns/${r.id}`);
        if (!res.ok) throw new Error("Gagal memuat data rundown.");
        const data = await res.json();
        await exportRundownPDF(data.rundown);
      } catch (err) {
        import("sonner").then(({ toast }) =>
          toast.error("Ekspor PDF gagal", { description: err instanceof Error ? err.message : "" })
        );
      }
    })();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight">Pustaka Rundown</h1>
            <p className="text-[12.5px] text-muted-foreground mt-1">
              {(rundowns ?? []).length} rundown tersimpan — acara, rencana harian, belajar, dan kerja.
            </p>
          </div>
          <Button
            onClick={() => openWizard()}
            className="h-9 bg-[var(--aurora-accent)] hover:bg-[var(--aurora-accent)]/85 text-white shadow-[0_0_24px_-8px_var(--aurora-accent)]"
          >
            <Plus className="size-4" />
            Rundown baru
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-[340px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari judul, lokasi, penyelenggara…"
              className="h-9 pl-9 text-[13px] bg-white/[0.04] border-white/10"
              aria-label="Cari rundown"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORY_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "h-8 px-3 rounded-lg text-[12.5px] border transition-colors",
                  filter === f.value
                    ? "bg-white/[0.08] border-white/16 text-foreground font-medium"
                    : "bg-white/[0.025] border-white/8 text-muted-foreground hover:text-foreground/85 hover:bg-white/[0.045]"
                )}
                aria-pressed={filter === f.value}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[104px] rounded-xl bg-white/[0.035]" />
            ))}
          </div>
        )}

        {!isLoading && list.length === 0 && (
          <div className="glass rounded-xl p-10 text-center">
            <ClipboardList className="size-8 mx-auto text-muted-foreground/40" />
            <div className="text-[14px] font-medium mt-3">
              {query || filter !== "semua" ? "Tidak ada rundown yang cocok" : "Belum ada rundown"}
            </div>
            <p className="text-[12.5px] text-muted-foreground/80 mt-1 max-w-[380px] mx-auto leading-relaxed">
              {query || filter !== "semua"
                ? "Coba ubah kata kunci atau filter kategori."
                : "Mulai dari template siap pakai — pernikahan, seminar, rapat, sampai rencana hari produktif — atau minta AI menyusunnya."}
            </p>
            {!query && filter === "semua" && (
              <Button
                onClick={() => openWizard()}
                className="mt-4 h-9 bg-[var(--aurora-accent)] hover:bg-[var(--aurora-accent)]/85 text-white"
              >
                <Plus className="size-4" />
                Buat rundown pertama
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {list.map((r) => (
            <RundownCard key={r.id} rundown={r} onOpen={openRundown} onExport={handleExport} />
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground/50 pt-2">
          Terakhir diperbarui {list[0] ? relativeTimeIndo(list[0].updatedAt) : "—"}
          {duplicate.isPending || del.isPending ? " · menyinkronkan…" : ""}
        </p>
      </div>
    </div>
  );
}
