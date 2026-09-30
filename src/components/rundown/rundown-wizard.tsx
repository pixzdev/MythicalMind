// Rundown wizard: create a rundown from a built-in template (instant,
// offline) or ask the configured AI provider to draft one (reviewed
// before saving). Rendered as a global dialog from the app shell.

"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CalendarDays,
  Clock3,
  ClipboardList,
  Sparkles,
  Trash2,
  Plug,
  Check,
  RotateCcw,
  Users,
  Target,
  FileDown,
  Loader2,
} from "lucide-react";
import {
  RUNDOWN_TEMPLATES,
  templateTotalMinutes,
  type RundownTemplate,
} from "@/lib/rundown/templates";
import {
  formatDurationIndo,
  minutesToClock,
  parseClockHHMM,
} from "@/lib/rundown/time";
import {
  useCreateRundown,
  useAIRundownStream,
  type CreateRundownInput,
} from "@/hooks/mythicalmind/rundown-queries";
import { useProviders, useSettings } from "@/hooks/mythicalmind/queries";
import { useWorkspace } from "@/store/workspace-store";
import type { SegmentInput } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS = [
  { value: "acara", label: "Acara" },
  { value: "harian", label: "Rencana Harian" },
  { value: "studi", label: "Belajar" },
  { value: "kerja", label: "Kerja" },
];

function TemplateCard({
  template,
  onPick,
}: {
  template: RundownTemplate;
  onPick: (t: RundownTemplate) => void;
}) {
  return (
    <button
      onClick={() => onPick(template)}
      className="text-left rounded-xl border border-white/8 bg-white/[0.025] p-3.5 hover:border-[var(--aurora-accent)]/40 hover:bg-white/[0.045] transition-all group"
      aria-label={`Gunakan template ${template.name}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13.5px] font-medium leading-snug">{template.name}</div>
        <ClipboardList className="size-4 text-muted-foreground/50 group-hover:text-[var(--aurora-accent-2)] transition-colors flex-none mt-0.5" />
      </div>
      <p className="text-[11.5px] text-muted-foreground/80 mt-1 line-clamp-2 leading-relaxed">
        {template.description}
      </p>
      <div className="flex items-center gap-3 mt-2.5 text-[11px] text-muted-foreground/70 tabular-nums">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="size-3" />
          {formatDurationIndo(templateTotalMinutes(template))}
        </span>
        <span>{template.segments.length} segmen</span>
        <span className="ml-auto">mulai {template.defaultStartTime}</span>
      </div>
    </button>
  );
}

function AIResultPreview({
  result,
  onChange,
}: {
  result: { title: string; segments: SegmentInput[]; startTime: string };
  onChange: (next: { title: string; segments: SegmentInput[]; startTime: string }) => void;
}) {
  const total = result.segments.reduce((s, x) => s + x.durationMinutes, 0);

  // Precompute slot clocks — pure derivation, no render-time reassignment.
  const slots = result.segments.reduce<
    { start: string; end: string; segment: SegmentInput }[]
  >((acc, s) => {
    const startMinutes = acc.length
      ? parseClockHHMM(acc[acc.length - 1].end)
      : parseClockHHMM(result.startTime);
    const endMinutes = startMinutes + s.durationMinutes;
    acc.push({
      start: minutesToClock(startMinutes),
      end: minutesToClock(endMinutes),
      segment: s,
    });
    return acc;
  }, []);

  const removeSegment = (index: number) => {
    onChange({ ...result, segments: result.segments.filter((_, i) => i !== index) });
  };
  const bumpDuration = (index: number, delta: number) => {
    const segments = result.segments.map((s, i) =>
      i === index
        ? { ...s, durationMinutes: Math.min(600, Math.max(1, s.durationMinutes + delta)) }
        : s
    );
    onChange({ ...result, segments });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Check className="size-3.5 text-emerald-400" />
          {result.segments.length} segmen · {formatDurationIndo(total)}
        </span>
        <span>· mulai {result.startTime}</span>
      </div>
      <div className="max-h-[300px] overflow-y-auto pr-1 space-y-1.5 rounded-lg border border-white/6 bg-black/20 p-2">
        {slots.map((slot, i) => {
          const s = slot.segment;
          return (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 bg-white/[0.03] border border-white/5"
            >
              <span className="text-[11px] tabular-nums text-muted-foreground/70 w-[86px] flex-none">
                {slot.start}–{slot.end}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium">{s.title}</div>
                {s.description && (
                  <div className="truncate text-[11px] text-muted-foreground/85">{s.description}</div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-none">
                <button
                  onClick={() => bumpDuration(i, -5)}
                  className="size-6 rounded-md hover:bg-white/10 text-[13px] text-muted-foreground"
                  aria-label="Kurangi 5 menit"
                >
                  −
                </button>
                <span className="text-[11px] tabular-nums text-muted-foreground w-[44px] text-center">
                  {s.durationMinutes}m
                </span>
                <button
                  onClick={() => bumpDuration(i, 5)}
                  className="size-6 rounded-md hover:bg-white/10 text-[13px] text-muted-foreground"
                  aria-label="Tambah 5 menit"
                >
                  +
                </button>
                <button
                  onClick={() => removeSegment(i)}
                  className="size-6 rounded-md hover:bg-destructive/15 text-destructive/80 flex items-center justify-center"
                  aria-label={`Hapus segmen ${s.title}`}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          );
        })}
        {result.segments.length === 0 && (
          <div className="p-4 text-center text-[12px] text-muted-foreground/70">
            Semua segmen dihapus — tambahkan minimal satu sebelum menyimpan,
            atau kembali dan susun ulang.
          </div>
        )}
      </div>
    </div>
  );
}

export function RundownWizard() {
  const { wizardOpen, setWizardOpen, wizardTab, setWizardTab, openRundown } = useWorkspace();
  const { data: providers } = useProviders();
  const { data: settings } = useSettings();

  const createRundown = useCreateRundown();
  const generateAI = useAIRundownStream();

  // template form
  const [templateDate, setTemplateDate] = useState("");
  const [templateStartTime, setTemplateStartTime] = useState("");

  // AI form
  const [aiTitle, setAiTitle] = useState("");
  const [aiEventType, setAiEventType] = useState("");
  const [aiCategory, setAiCategory] = useState("acara");
  const [aiDate, setAiDate] = useState("");
  const [aiStartTime, setAiStartTime] = useState("08:00");
  const [aiDuration, setAiDuration] = useState("240");
  const [aiAudience, setAiAudience] = useState("");
  const [aiGoal, setAiGoal] = useState("");
  const [aiNotes, setAiNotes] = useState("");

  // AI result (local, editable before persist)
  const [aiResult, setAiResult] = useState<{
    title: string;
    segments: SegmentInput[];
    startTime: string;
    description: string | null;
    provider: string;
    model: string;
  } | null>(null);

  const connectedProviders = (providers ?? []).filter((p) => p.status === "connected");
  const canUseAI =
    connectedProviders.length > 0 ||
    Boolean(settings?.generation?.defaultProviderId);

  const eventTypePlaceholder = useMemo(
    () =>
      aiCategory === "harian"
        ? "mis. hari produktif kerja dari rumah"
        : aiCategory === "studi"
          ? "mis. persiapan ujian akhir semester"
          : aiCategory === "kerja"
            ? "mis. rapat evaluasi kuartal"
            : "mis. seminar kewirausahaan",
    [aiCategory]
  );

  const close = () => {
    setWizardOpen(false);
    // reset wizard state for next open
    setTimeout(() => {
      setAiResult(null);
      setTemplateDate("");
      setTemplateStartTime("");
    }, 250);
  };

  const pickTemplate = (t: RundownTemplate) => {
    const input: CreateRundownInput = {
      title: t.name,
      templateId: t.id,
      category: t.category,
      eventType: t.eventType,
      eventDate: templateDate ? new Date(`${templateDate}T00:00:00`).toISOString() : null,
      startTime: templateStartTime || undefined,
      source: "template",
    };
    createRundown.mutate(input, {
      onSuccess: (data) => {
        close();
        openRundown(data.rundown.id);
      },
    });
  };

  const runAI = async () => {
    if (!aiTitle.trim() || !aiEventType.trim()) return;
    const r = await generateAI.run({
      title: aiTitle.trim(),
      eventType: aiEventType.trim(),
      category: aiCategory,
      startTime: aiStartTime || null,
      targetDurationMinutes: Number(aiDuration) || null,
      eventDate: aiDate ? new Date(`${aiDate}T00:00:00`).toISOString() : null,
      audience: aiAudience.trim() || null,
      goal: aiGoal.trim() || null,
      notes: aiNotes.trim() || null,
      mode: "full",
    });
    if (r) {
      setAiResult({
        title: r.title,
        segments: r.segments,
        startTime: r.suggestedStartTime || aiStartTime || "08:00",
        description: r.description,
        provider: r.providerName,
        model: r.modelKey,
      });
    }
  };

  const saveAIResult = () => {
    if (!aiResult || aiResult.segments.length === 0) return;
    createRundown.mutate(
      {
        title: aiResult.title,
        category: aiCategory,
        eventType: aiEventType.trim() || "custom",
        description: aiResult.description,
        eventDate: aiDate ? new Date(`${aiDate}T00:00:00`).toISOString() : null,
        startTime: aiResult.startTime,
        source: "ai",
        segments: aiResult.segments,
      },
      {
        onSuccess: (data) => {
          close();
          openRundown(data.rundown.id);
        },
      }
    );
  };

  const busy = generateAI.isPending || createRundown.isPending;

  return (
    <Dialog open={wizardOpen} onOpenChange={(v) => (v ? setWizardOpen(true) : close())}>
      <DialogContent className="p-0 overflow-hidden top-[6%] translate-y-0 max-w-[680px] glass rounded-2xl border-white/10 max-h-[88dvh] flex flex-col">
        <div className="px-5 pt-5 pb-4 hairline-b">
          <DialogTitle className="text-[16.5px] font-semibold flex items-center gap-2.5">
            <span className="size-8 rounded-lg bg-[var(--aurora-accent)]/15 border border-[var(--aurora-accent)]/25 flex items-center justify-center">
              <CalendarDays className="size-4 text-[var(--aurora-accent)]" />
            </span>
            Rundown baru
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-muted-foreground mt-1 ml-[42px]">
            Mulai dari template siap pakai, atau minta AI menyusun dari deskripsi acaramu.
          </DialogDescription>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <Tabs value={wizardTab} onValueChange={(v) => setWizardTab(v as "template" | "ai")}>
            <div className="px-5 pt-4">
              <TabsList className="h-9 bg-white/[0.045] border border-white/8">
                <TabsTrigger value="template" className="gap-1.5 text-[12.5px] data-[state=active]:bg-white/[0.09]">
                  <ClipboardList className="size-3.5" />
                  Template
                </TabsTrigger>
                <TabsTrigger value="ai" className="gap-1.5 text-[12.5px] data-[state=active]:bg-white/[0.09]">
                  <Sparkles className="size-3.5" />
                  Susun dengan AI
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── Template tab ─────────────────────────────────────────── */}
            <TabsContent value="template" className="mt-4 px-5 pb-5">
              <div className="flex flex-wrap items-end gap-3 mb-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-date" className="text-[11.5px] text-muted-foreground">
                    Tanggal acara (opsional)
                  </Label>
                  <Input
                    id="tpl-date"
                    type="date"
                    value={templateDate}
                    onChange={(e) => setTemplateDate(e.target.value)}
                    className="h-8 w-[150px] text-[12.5px] bg-white/[0.04] border-white/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-start" className="text-[11.5px] text-muted-foreground">
                    Jam mulai (opsional)
                  </Label>
                  <Input
                    id="tpl-start"
                    type="time"
                    value={templateStartTime}
                    onChange={(e) => setTemplateStartTime(e.target.value)}
                    className="h-8 w-[118px] text-[12.5px] bg-white/[0.04] border-white/10"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground/60 ml-auto max-w-[220px] leading-relaxed hidden sm:block">
                  Template mengisi segmen lengkap — semuanya bisa kamu ubah setelah dibuat.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {RUNDOWN_TEMPLATES.map((t) => (
                  <TemplateCard key={t.id} template={t} onPick={pickTemplate} />
                ))}
              </div>
            </TabsContent>

            {/* ── AI tab ───────────────────────────────────────────────── */}
            <TabsContent value="ai" className="mt-4 px-5 pb-5 space-y-4">
              {!canUseAI && (
                <Alert className="border-amber-400/25 bg-amber-400/[0.07]">
                  <Plug className="size-4 text-amber-300" />
                  <AlertTitle className="text-[13px]">Belum ada penyedia AI terhubung</AlertTitle>
                  <AlertDescription className="text-[12px] leading-relaxed">
                    Untuk menyusun rundown dengan AI, sambungkan dulu penyedia OpenAI-compatible
                    milikmu (base URL + API key + model) di menu Penyedia. Sementara itu, tab
                    Template tetap bisa dipakai tanpa AI.
                  </AlertDescription>
                </Alert>
              )}

              {aiResult ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-medium">
                      {aiResult.title}
                      <span className="ml-2 text-[11px] text-muted-foreground/70 font-normal">
                        via {aiResult.provider} · {aiResult.model}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[12px] border-white/14 hover:bg-white/[0.06]"
                      disabled={busy}
                      onClick={() => setAiResult(null)}
                    >
                      <RotateCcw className="size-3.5" />
                      Ubah input
                    </Button>
                  </div>
                  <AIResultPreview
                    result={aiResult}
                    onChange={(next) => setAiResult({ ...aiResult, ...next })}
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" className="h-9 border-white/12" onClick={close} disabled={busy}>
                      Batal
                    </Button>
                    <Button
                      onClick={saveAIResult}
                      disabled={busy || aiResult.segments.length === 0}
                      className="h-9 bg-[var(--aurora-accent)] hover:bg-[var(--aurora-accent)]/85 text-white"
                    >
                      <Check className="size-4" />
                      Simpan & buka editor
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="ai-title" className="text-[11.5px] text-muted-foreground">
                        Nama acara / rencana <span className="text-[var(--aurora-accent-2)]">*</span>
                      </Label>
                      <Input
                        id="ai-title"
                        value={aiTitle}
                        onChange={(e) => setAiTitle(e.target.value)}
                        placeholder="mis. Wedding Dinda & Bagas"
                        className="h-9 text-[13px] bg-white/[0.04] border-white/10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ai-type" className="text-[11.5px] text-muted-foreground">
                        Jenis <span className="text-[var(--aurora-accent-2)]">*</span>
                      </Label>
                      <Input
                        id="ai-type"
                        value={aiEventType}
                        onChange={(e) => setAiEventType(e.target.value)}
                        placeholder={eventTypePlaceholder}
                        className="h-9 text-[13px] bg-white/[0.04] border-white/10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11.5px] text-muted-foreground">Kategori</Label>
                      <Select value={aiCategory} onValueChange={setAiCategory}>
                        <SelectTrigger className="h-9 text-[13px] bg-white/[0.04] border-white/10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORY_OPTIONS.map((c) => (
                            <SelectItem key={c.value} value={c.value} className="text-[13px]">
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ai-date" className="text-[11.5px] text-muted-foreground">
                        Tanggal (opsional)
                      </Label>
                      <Input
                        id="ai-date"
                        type="date"
                        value={aiDate}
                        onChange={(e) => setAiDate(e.target.value)}
                        className="h-9 text-[13px] bg-white/[0.04] border-white/10"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="ai-start" className="text-[11.5px] text-muted-foreground">
                          Jam mulai
                        </Label>
                        <Input
                          id="ai-start"
                          type="time"
                          value={aiStartTime}
                          onChange={(e) => setAiStartTime(e.target.value)}
                          className="h-9 text-[13px] bg-white/[0.04] border-white/10"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ai-dur" className="text-[11.5px] text-muted-foreground">
                          Durasi (menit)
                        </Label>
                        <Input
                          id="ai-dur"
                          inputMode="numeric"
                          value={aiDuration}
                          onChange={(e) => setAiDuration(e.target.value.replace(/[^\d]/g, ""))}
                          className="h-9 text-[13px] bg-white/[0.04] border-white/10"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="ai-goal" className="text-[11.5px] text-muted-foreground inline-flex items-center gap-1.5">
                        <Target className="size-3" />
                        Tujuan acara (opsional)
                      </Label>
                      <Textarea
                        id="ai-goal"
                        value={aiGoal}
                        onChange={(e) => setAiGoal(e.target.value)}
                        placeholder="mis. memberi wawasan praktis kepada 100 peserta UMKM"
                        rows={2}
                        className="text-[13px] bg-white/[0.04] border-white/10 resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ai-aud" className="text-[11.5px] text-muted-foreground inline-flex items-center gap-1.5">
                        <Users className="size-3" />
                        Audiens (opsional)
                      </Label>
                      <Input
                        id="ai-aud"
                        value={aiAudience}
                        onChange={(e) => setAiAudience(e.target.value)}
                        placeholder="mis. 100 pelaku UMKM"
                        className="h-9 text-[13px] bg-white/[0.04] border-white/10"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="ai-notes" className="text-[11.5px] text-muted-foreground">
                        Catatan khusus (opsional)
                      </Label>
                      <Textarea
                        id="ai-notes"
                        value={aiNotes}
                        onChange={(e) => setAiNotes(e.target.value)}
                        placeholder="mis. ada sesi door prize, 3 narasumber"
                        rows={3}
                        className="text-[13px] bg-white/[0.04] border-white/10 resize-none"
                      />
                    </div>
                  </div>

                  {generateAI.isPending && (
                    <div
                      className="rounded-xl border border-[var(--aurora-accent)]/20 bg-[var(--aurora-accent)]/[0.06] p-3.5 space-y-1.5"
                      aria-live="polite"
                    >
                      <div className="flex items-center gap-2 text-[11.5px] font-medium text-[var(--aurora-accent)]">
                        <Loader2 className="size-3.5 animate-spin" />
                        Agent bekerja — status live
                      </div>
                      <div className="space-y-1 max-h-[132px] overflow-y-auto">
                        {generateAI.phases.map((p, i) => (
                          <div
                            key={`${p.phase}-${i}`}
                            className="flex items-center gap-2 text-[12px] text-muted-foreground"
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                i === generateAI.phases.length - 1
                                  ? "bg-[var(--aurora-accent)] animate-pulse"
                                  : "bg-[var(--aurora-accent)]/40"
                              }`}
                            />
                            <span className="text-foreground/90">{p.label}</span>
                            {p.detail && (
                              <span className="text-muted-foreground/70 text-[11px]">{p.detail}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" className="h-9 border-white/12" onClick={close}>
                      Batal
                    </Button>
                    <Button
                      onClick={runAI}
                      disabled={busy || !aiTitle.trim() || !aiEventType.trim() || !canUseAI}
                      className="h-9 bg-[var(--aurora-accent)] hover:bg-[var(--aurora-accent)]/85 text-white"
                    >
                      {generateAI.isPending ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          AI sedang menyusun…
                          </>
                      ) : (
                        <>
                          <Sparkles className="size-4" />
                          Susun rundown
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="px-5 py-3 hairline-t flex items-center gap-2 text-[11px] text-muted-foreground/60">
          <FileDown className="size-3.5" />
          Rundown tersimpan bisa langsung diekspor ke PDF dari editor.
        </div>
      </DialogContent>
    </Dialog>
  );
}
