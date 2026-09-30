// Beranda — productivity home.
// The FIRST surface: greeting, today's focus, stats, upcoming events,
// quick actions, and recent rundowns. Chat is one click away, not the hero.

"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CalendarClock,
  CalendarPlus,
  ClipboardList,
  Clock3,
  FileDown,
  FileText,
  Layers,
  ListChecks,
  MapPin,
  Plus,
  Sparkles,
  ArrowRight,
  CalendarCheck2,
  Bot,
  Plug,
} from "lucide-react";
import { useRundowns } from "@/hooks/mythicalmind/rundown-queries";
import { useProviders } from "@/hooks/mythicalmind/queries";
import { useWorkspace } from "@/store/workspace-store";
import {
  endTimeOf,
  formatDurationIndo,
  formatTanggalIndo,
  hariMenuju,
  isHariIni,
  labelHitungMundur,
  relativeTimeIndo,
  sapaanIndo,
} from "@/lib/rundown/time";
import { RUNDOWN_CATEGORY_LABELS, type RundownSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

// Time-dependent greeting must be computed AFTER mount: server (UTC) and
// client (user timezone) disagree on hour-of-day/date, and a module-level
// `new Date()` would break hydration (server text ≠ client text).
function useClockDate(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const raf = requestAnimationFrame(tick); // after hydration paint
    const timer = setInterval(tick, 60_000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
    };
  }, []);
  return now;
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="glass-subtle rounded-xl p-4 flex items-start gap-3">
      <div className="size-8 rounded-lg bg-white/[0.045] flex items-center justify-center flex-none">
        <Icon className="size-4 text-[var(--aurora-accent-2)]" />
      </div>
      <div className="min-w-0">
        <div className="text-[20px] font-semibold leading-tight tabular-nums">{value}</div>
        <div className="text-[12px] text-muted-foreground mt-0.5">{label}</div>
        {hint && <div className="text-[10.5px] text-muted-foreground/60 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}

function RundownRow({ rundown, onOpen }: { rundown: RundownSummary; onOpen: (id: string) => void }) {
  const tanggal = rundown.eventDate ? formatTanggalIndo(rundown.eventDate) : null;
  return (
    <button
      onClick={() => onOpen(rundown.id)}
      className="w-full text-left flex items-center gap-3 rounded-lg px-2.5 h-[52px] hover:bg-white/[0.04] transition-colors group"
      aria-label={`Buka rundown ${rundown.title}`}
    >
      <div className="size-8 rounded-lg bg-white/[0.04] border border-white/6 flex items-center justify-center flex-none">
        <ClipboardList className="size-3.5 text-[var(--aurora-accent-2)]/80" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium">{rundown.title}</div>
        <div className="truncate text-[11.5px] text-muted-foreground/80">
          {tanggal ?? RUNDOWN_CATEGORY_LABELS[rundown.category]}
          {" · "}
          {rundown.segmentCount} segmen · {formatDurationIndo(rundown.totalMinutes)}
        </div>
      </div>
      <span className="text-[11px] text-muted-foreground/50 tabular-nums flex-none hidden sm:block">
        {rundown.eventDate ? labelHitungMundur(rundown.eventDate) : relativeTimeIndo(rundown.updatedAt)}
      </span>
      <ArrowRight className="size-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/70 transition-colors flex-none" />
    </button>
  );
}

export function RundownDashboard() {
  const { openRundown, openWizard, setView, openConversation } = useWorkspace();
  const { data: rundowns, isLoading } = useRundowns();
  const { data: providers } = useProviders();
  const clock = useClockDate();

  const connected = (providers ?? []).filter((p) => p.status === "connected").length;

  const { today, upcoming, recent, stats } = useMemo(() => {
    const list = rundowns ?? [];
    const withDate = list.filter((r) => r.eventDate);
    const todayList = withDate
      .filter((r) => isHariIni(r.eventDate!))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const upcomingList = withDate
      .filter((r) => hariMenuju(r.eventDate!) > 0)
      .sort((a, b) => hariMenuju(a.eventDate!) - hariMenuju(b.eventDate!))
      .slice(0, 5);
    const recentList = [...list]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6);
    const thisWeek = list.filter((r) => {
      if (!r.updatedAt) return false;
      const diff = Date.now() - new Date(r.updatedAt).getTime();
      return diff < 7 * 86_400_000;
    }).length;
    const plannedMinutes = list.reduce((s, r) => s + r.totalMinutes, 0);
    return {
      today: todayList,
      upcoming: upcomingList,
      recent: recentList,
      stats: {
        total: list.length,
        thisWeek,
        plannedMinutes,
        final: list.filter((r) => r.status === "final").length,
      },
    };
  }, [rundowns]);

  const focus = today[0] ?? upcoming[0] ?? null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Greeting */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-tight">
              {clock ? sapaanIndo(clock) : "Selamat datang"}
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              {clock ? `${formatTanggalIndo(clock)} · Rencanakan, susun, ekspor — satu tempat.` : "Rencanakan, susun, ekspor — satu tempat."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => openWizard()}
              className="h-9 bg-[var(--aurora-accent)] hover:bg-[var(--aurora-accent)]/85 text-white shadow-[0_0_24px_-8px_var(--aurora-accent)]"
            >
              <Plus className="size-4" />
              Rundown baru
            </Button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => openWizard()}
            className="glass rounded-xl p-4 flex items-center gap-3.5 text-left hover:border-white/14 hover:bg-white/[0.03] transition-all group"
          >
            <div className="size-10 rounded-lg bg-[var(--aurora-accent)]/15 border border-[var(--aurora-accent)]/25 flex items-center justify-center flex-none group-hover:scale-105 transition-transform">
              <CalendarPlus className="size-4.5 text-[var(--aurora-accent)]" />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-medium">Buat rundown baru</div>
              <div className="text-[12px] text-muted-foreground/85 mt-0.5">
                Dari template siap pakai atau dari nol
              </div>
            </div>
          </button>

          <button
            onClick={() => setView("rundowns")}
            className="glass rounded-xl p-4 flex items-center gap-3.5 text-left hover:border-white/14 hover:bg-white/[0.03] transition-all group"
          >
            <div className="size-10 rounded-lg bg-[var(--aurora-accent-2)]/12 border border-[var(--aurora-accent-2)]/25 flex items-center justify-center flex-none group-hover:scale-105 transition-transform">
              <Layers className="size-4.5 text-[var(--aurora-accent-2)]" />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-medium">Pustaka rundown</div>
              <div className="text-[12px] text-muted-foreground/85 mt-0.5">
                {stats.total > 0 ? `${stats.total} rundown tersimpan` : "Belum ada rundown"}
              </div>
            </div>
          </button>

          <button
            onClick={() => openWizard("ai")}
            className="glass rounded-xl p-4 flex items-center gap-3.5 text-left hover:border-white/14 hover:bg-white/[0.03] transition-all group"
          >
            <div className="size-10 rounded-lg bg-[var(--aurora-accent-2)]/12 border border-[var(--aurora-accent-2)]/25 flex items-center justify-center flex-none group-hover:scale-105 transition-transform">
              <Sparkles className="size-4.5 text-[var(--aurora-accent-2)]" />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-medium">Susun dengan AI</div>
              <div className="text-[12px] text-muted-foreground/85 mt-0.5">
                {connected > 0
                  ? "Ceritakan acaranya, AI menyusun segmennya"
                  : "Butuh penyedia AI — atau pakai template"}
              </div>
            </div>
          </button>
        </div>

        {/* Today's focus */}
        {focus && (
          <Card className="glass border-white/8 overflow-hidden">
            <div className="h-0.5 aurora-strip" aria-hidden="true" />
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <CalendarCheck2 className="size-4 text-[var(--aurora-accent-2)]" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {today[0] ? "Fokus hari ini" : "Acara terdekat"}
                </span>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[18px] font-semibold truncate">{focus.title}</div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[12.5px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="size-3.5" />
                      {focus.startTime} – {endTimeOf(focus)} · {formatDurationIndo(focus.totalMinutes)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <ListChecks className="size-3.5" />
                      {focus.segmentCount} segmen
                    </span>
                    {focus.venue && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-3.5" />
                        {focus.venue}
                      </span>
                    )}
                    {focus.eventDate && !today[0] && (
                      <Badge variant="secondary" className="h-5 text-[11px]">
                        {labelHitungMundur(focus.eventDate)}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-white/12"
                    onClick={() => openRundown(focus.id)}
                  >
                    Buka rundown
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={ClipboardList} label="Total rundown" value={String(stats.total)} hint={`${stats.final} final`} />
          <StatCard icon={CalendarClock} label="Acara mendatang" value={String(upcoming.length + today.length)} hint={`${today.length} hari ini`} />
          <StatCard icon={Clock3} label="Total durasi terencana" value={formatDurationIndo(stats.plannedMinutes)} hint="semua rundown" />
          <StatCard icon={FileText} label="Aktivitas 7 hari" value={String(stats.thisWeek)} hint="rundown disentuh" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Upcoming */}
          <section aria-label="Acara mendatang">
            <div className="flex items-center justify-between px-1 mb-2">
              <h2 className="text-[13px] font-semibold text-foreground/90">Acara mendatang</h2>
              <Button variant="ghost" size="sm" className="h-7 text-[12px] text-muted-foreground" onClick={() => setView("rundowns")}>
                Lihat semua
              </Button>
            </div>
            <div className="glass rounded-xl p-1.5 min-h-[76px]">
              {isLoading && (
                <div className="p-4 text-[12.5px] text-muted-foreground">Memuat…</div>
              )}
              {!isLoading && upcoming.length === 0 && (
                <div className="p-4 text-[12.5px] text-muted-foreground/70">
                  Belum ada acara terjadwal. Buat rundown dan atur tanggalnya agar muncul di sini.
                </div>
              )}
              {upcoming.map((r) => (
                <RundownRow key={r.id} rundown={r} onOpen={openRundown} />
              ))}
            </div>
          </section>

          {/* Recent */}
          <section aria-label="Rundown terbaru">
            <div className="flex items-center justify-between px-1 mb-2">
              <h2 className="text-[13px] font-semibold text-foreground/90">Terakhir diedit</h2>
              <Button variant="ghost" size="sm" className="h-7 text-[12px] text-muted-foreground" onClick={() => setView("rundowns")}>
                Lihat semua
              </Button>
            </div>
            <div className="glass rounded-xl p-1.5 min-h-[76px]">
              {isLoading && (
                <div className="p-4 text-[12.5px] text-muted-foreground">Memuat…</div>
              )}
              {!isLoading && recent.length === 0 && (
                <div className="p-4 text-[12.5px] text-muted-foreground/70">
                  Belum ada rundown. Mulai dari template — pernikahan, seminar, rapat, hingga rencana harian.
                </div>
              )}
              {recent.map((r) => (
                <RundownRow key={r.id} rundown={r} onOpen={openRundown} />
              ))}
            </div>
          </section>
        </div>

        {/* Assistant hint */}
        <div className="glass-subtle rounded-xl p-4 flex flex-wrap items-center gap-3">
          <div className="size-8 rounded-lg bg-white/[0.045] flex items-center justify-center flex-none">
            <Bot className="size-4 text-[var(--aurora-accent-2)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium">Butuh brainstorming dulu?</div>
            <div className="text-[11.5px] text-muted-foreground/80 mt-0.5">
              Asisten AI siap membantu memikirkan konsep acara — dengan penyedia milikmu sendiri.
            </div>
          </div>
          <div className="flex gap-2">
            {connected === 0 && (
              <Button variant="outline" size="sm" className="h-8 border-white/12" onClick={() => setView("providers")}>
                <Plug className="size-3.5" />
                Sambungkan penyedia
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 border-white/12" onClick={() => setView("conversations")}>
              Buka Asisten
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
