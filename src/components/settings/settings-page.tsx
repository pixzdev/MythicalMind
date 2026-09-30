// Settings: appearance (accent, atmosphere), generation defaults, keyboard
// reference, data & privacy — all real, nothing decorative.

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Palette,
  Gauge,
  Keyboard,
  ShieldCheck,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings, useSaveSettings, useModels, api } from "@/hooks/mythicalmind/queries";
import { toast } from "sonner";
import type { WorkspaceSettings } from "@/lib/types";

const ACCENTS: { key: NonNullable<WorkspaceSettings["appearance"]["accent"]>; label: string; color: string }[] = [
  { key: "violet", label: "Violet", color: "#8b5cf6" },
  { key: "cyan", label: "Cyan", color: "#22d3ee" },
  { key: "teal", label: "Teal", color: "#2dd4bf" },
  { key: "magenta", label: "Magenta", color: "#e879f9" },
];

const SHORTCUTS = [
  { keys: "⌘K / Ctrl K", action: "Command palette & search" },
  { keys: "⌘⇧O / Ctrl ⇧ O", action: "New conversation" },
  { keys: "⌘. / Ctrl .", action: "Open context panel (mobile)" },
  { keys: "Enter", action: "Send message" },
  { keys: "Shift + Enter", action: "New line in composer" },
  { keys: "Esc", action: "Close dialogs & menus" },
];

export function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const save = useSaveSettings();
  const { data: models } = useModels();
  const [clearing, setClearing] = useState(false);

  if (isLoading || !settings) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-4 sm:px-8 py-7 space-y-6">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
      </div>
    );
  }

  const providerIds = [...new Set((models ?? []).map((m) => m.providerId))];

  const exportData = async () => {
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mythicalmind-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
  };

  const clearConversations = async () => {
    setClearing(true);
    try {
      const res = await api<{ deleted: number }>("/api/data", { method: "DELETE" });
      toast.success(`Deleted ${res.deleted} conversation${res.deleted === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error("Could not delete conversations", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-4 sm:px-8 py-7 space-y-7">
        <h1 className="text-[19px] font-semibold tracking-tight">Settings</h1>

        {/* Appearance */}
        <section className="rounded-2xl border border-white/8 bg-white/[0.022] p-5 space-y-4">
          <h2 className="flex items-center gap-2 text-[14px] font-medium">
            <Palette className="size-4 text-[var(--aurora-accent-2)]/85" /> Appearance
          </h2>

          <div className="grid gap-1.5">
            <Label className="text-[12px] text-muted-foreground">Accent</Label>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => save.mutate({ appearance: { accent: a.key } })}
                  className={cn(
                    "flex items-center gap-2 h-9 px-3 rounded-lg border text-[12.5px] transition-colors",
                    settings.appearance.accent === a.key
                      ? "border-white/25 bg-white/[0.06]"
                      : "border-white/10 hover:bg-white/[0.04]"
                  )}
                  aria-pressed={settings.appearance.accent === a.key}
                >
                  <span
                    className="size-3.5 rounded-full"
                    style={{ background: a.color, boxShadow: `0 0 12px -2px ${a.color}` }}
                  />
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-[12px] text-muted-foreground">Aurora atmosphere</Label>
            <div className="flex gap-2">
              {(["subtle", "medium", "off"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => save.mutate({ appearance: { atmosphere: level } })}
                  className={cn(
                    "h-9 px-3.5 rounded-lg border text-[12.5px] capitalize transition-colors",
                    settings.appearance.atmosphere === level
                      ? "border-white/25 bg-white/[0.06]"
                      : "border-white/10 hover:bg-white/[0.04]"
                  )}
                  aria-pressed={settings.appearance.atmosphere === level}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground/60">
              The ambient background respects your system's reduced-motion
              preference automatically.
            </p>
          </div>
        </section>

        {/* Generation */}
        <section className="rounded-2xl border border-white/8 bg-white/[0.022] p-5 space-y-4">
          <h2 className="flex items-center gap-2 text-[14px] font-medium">
            <Gauge className="size-4 text-[var(--aurora-accent-2)]/85" /> Generation
          </h2>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[12px] text-muted-foreground">
                Default temperature
              </Label>
              <span className="text-[12.5px] tabular-nums">
                {(settings.generation.temperature ?? 0.7).toFixed(1)}
              </span>
            </div>
            <Slider
              value={[settings.generation.temperature ?? 0.7]}
              min={0}
              max={1.5}
              step={0.1}
              onValueChange={([v]) => save.mutate({ generation: { temperature: v } })}
              className="pt-1"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label className="text-[12px] text-muted-foreground">
                Max tokens (blank = provider default)
              </Label>
              <Input
                value={settings.generation.maxTokens ?? ""}
                onChange={(e) =>
                  save.mutate({
                    generation: {
                      maxTokens: e.target.value ? Number(e.target.value) || null : null,
                    },
                  })
                }
                placeholder="e.g. 4096"
                className="h-9 bg-white/[0.03] border-white/10 text-[13px] tabular-nums"
                inputMode="numeric"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[12px] text-muted-foreground">
                Timeout (minutes)
              </Label>
              <Input
                value={String(Math.round(settings.generation.timeoutMs / 60000))}
                onChange={(e) => {
                  const mins = Number(e.target.value.replace(/\D/g, "")) || 10;
                  save.mutate({ generation: { timeoutMs: Math.max(1, mins) * 60000 } });
                }}
                className="h-9 bg-white/[0.03] border-white/10 text-[13px] tabular-nums"
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label className="text-[12px] text-muted-foreground">
                Default provider
              </Label>
              <Select
                value={settings.generation.defaultProviderId ?? "none"}
                onValueChange={(v) =>
                  save.mutate({
                    generation: {
                      defaultProviderId: v === "none" ? null : v,
                      defaultModelKey: v === "none" ? null : settings.generation.defaultModelKey,
                    },
                  })
                }
              >
                <SelectTrigger className="h-9 bg-white/[0.03] border-white/10 text-[13px]">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {providerIds.map((pid) => {
                    const name =
                      (models ?? []).find((m) => m.providerId === pid)?.providerName ?? pid;
                    return (
                      <SelectItem key={pid} value={pid}>
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[12px] text-muted-foreground">Default model</Label>
              <Select
                value={settings.generation.defaultModelKey ?? "none"}
                onValueChange={(v) =>
                  save.mutate({
                    generation: { defaultModelKey: v === "none" ? null : v },
                  })
                }
              >
                <SelectTrigger className="h-9 bg-white/[0.03] border-white/10 text-[13px]">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(models ?? [])
                    .filter(
                      (m) =>
                        !settings.generation.defaultProviderId ||
                        m.providerId === settings.generation.defaultProviderId
                    )
                    .map((m) => (
                      <SelectItem key={m.id} value={m.modelId} className="font-mono text-[12px]">
                        {m.modelId}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Keyboard */}
        <section className="rounded-2xl border border-white/8 bg-white/[0.022] p-5 space-y-3.5">
          <h2 className="flex items-center gap-2 text-[14px] font-medium">
            <Keyboard className="size-4 text-[var(--aurora-accent-2)]/85" /> Keyboard
          </h2>
          <div className="space-y-2">
            {SHORTCUTS.map((s) => (
              <div key={s.keys} className="flex items-center justify-between gap-4">
                <span className="text-[12.5px] text-muted-foreground">{s.action}</span>
                <kbd className="text-[11px] font-mono px-2 py-1 rounded border border-white/10 bg-white/[0.04] text-muted-foreground/80 whitespace-nowrap">
                  {s.keys}
                </kbd>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy & data */}
        <section className="rounded-2xl border border-white/8 bg-white/[0.022] p-5 space-y-4">
          <h2 className="flex items-center gap-2 text-[14px] font-medium">
            <ShieldCheck className="size-4 text-[var(--aurora-accent-2)]/85" /> Privacy & data
          </h2>
          <div className="text-[12.5px] text-muted-foreground leading-relaxed space-y-2">
            <p>
              Provider API keys are stored in the server-side database only.
              They are sent exclusively to the provider's own endpoint when
              generating — never to the browser, never logged, and excluded
              from exports.
            </p>
            <p>
              Everything (conversations, messages, generations, activity) lives
              in this workspace's local database.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Button variant="outline" className="border-white/12" onClick={exportData}>
              <Download className="size-4" /> Export workspace (JSON)
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={clearing}
                >
                  {clearing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Delete all conversations
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="glass border-white/10">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete every conversation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes all conversations and their
                    messages, including any running generations. Providers and
                    models are kept.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/85"
                    onClick={clearConversations}
                  >
                    Delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-white/[0.05] text-[10px] text-muted-foreground">
              local database
            </Badge>
            <Badge variant="secondary" className="bg-white/[0.05] text-[10px] text-muted-foreground">
              keys never leave the server
            </Badge>
            <Badge variant="secondary" className="bg-white/[0.05] text-[10px] text-muted-foreground">
              no telemetry
            </Badge>
          </div>
        </section>
      </div>
    </div>
  );
}
