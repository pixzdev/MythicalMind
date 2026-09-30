// ⌘K command palette: workspace actions, recent conversations, and live
// server-side search across conversation titles and message content.

"use client";

import { useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  MessageSquarePlus,
  MessagesSquare,
  Bot,
  ListChecks,
  Server,
  Boxes,
  Activity,
  Settings2,
  Plug,
  Search,
  Zap,
  FileText,
  Home,
  CalendarPlus,
  ClipboardList,
} from "lucide-react";
import { useWorkspace, type WorkspaceView } from "@/store/workspace-store";
import { useConversations, useCreateConversation, useSearch } from "@/hooks/mythicalmind/queries";
import { useRundowns } from "@/hooks/mythicalmind/rundown-queries";
import { runtime } from "@/lib/runtime/client/runtime-client";
import { relativeTime } from "@/lib/format";
import { formatDurationIndo, relativeTimeIndo } from "@/lib/rundown/time";

const NAV_ACTIONS: { view: WorkspaceView; label: string; icon: React.ElementType; kbd?: string }[] = [
  { view: "rundowns", label: "Buka Pustaka Rundown", icon: ClipboardList },
  { view: "providers", label: "Open Providers", icon: Server },
  { view: "models", label: "Open Models", icon: Boxes },
  { view: "tasks", label: "Open Tasks (runtime)", icon: ListChecks },
  { view: "activity", label: "Open Activity", icon: Activity },
  { view: "agents", label: "Open Agents", icon: Bot },
  { view: "settings", label: "Open Settings", icon: Settings2 },
];

export function CommandPalette({
  open,
  onOpenChange,
  onOpenConversation,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenConversation: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const setView = useWorkspace((s) => s.setView);
  const openRundown = useWorkspace((s) => s.openRundown);
  const openWizard = useWorkspace((s) => s.openWizard);
  const { data: conversations } = useConversations();
  const { data: rundowns } = useRundowns();
  const createConversation = useCreateConversation();
  const { data: searchResults } = useSearch(query, query.trim().length > 1);

  const q = query.trim().toLowerCase();
  const rundownMatches = (rundowns ?? []).filter(
    (r) => q.length === 0 || r.title.toLowerCase().includes(q)
  );

  const handleOpenChange = (v: boolean) => {
    if (!v) setQuery("");
    onOpenChange(v);
  };

  const run = () => onOpenChange(false);

  const stopAll = () => {
    for (const r of runtime.activeRuns()) {
      void fetch(`/api/generations/${r.id}/stop`, { method: "POST" });
    }
    run();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="p-0 overflow-hidden top-[18%] translate-y-0 max-w-[560px] glass rounded-2xl border-white/10">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Cari rundown dan percakapan, atau lompat ke bagian mana pun di ruang kerja.
        </DialogDescription>
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:text-muted-foreground/60 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.07em]">
          <div className="flex items-center gap-2 border-b border-white/8 px-4">
            <Search className="size-4 text-muted-foreground/60" />
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Cari rundown, percakapan, atau lompat ke mana saja…"
              className="flex-1 h-11 text-[13.5px] bg-transparent outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          <CommandList className="max-h-[380px] p-1.5">
            <CommandEmpty className="py-6 text-[13px] text-muted-foreground/70">
              {query.trim() ? "Tidak ada yang cocok." : "Ketik untuk mencari…"}
            </CommandEmpty>

            <CommandGroup heading="Aksi">
              <PaletteItem
                icon={CalendarPlus}
                label="Rundown baru"
                kbd="⌘⇧O"
                onSelect={() => { openWizard(); run(); }}
              />
              <PaletteItem
                icon={Home}
                label="Kembali ke Beranda"
                onSelect={() => { setView("beranda"); run(); }}
              />
              <PaletteItem
                icon={MessageSquarePlus}
                label="Percakapan asisten baru"
                onSelect={() => {
                  createConversation.mutate(
                    {},
                    { onSuccess: (d) => { run(); onOpenConversation(d.conversation.id); } }
                  );
                  run();
                }}
              />
              <PaletteItem
                icon={Plug}
                label="Sambungkan penyedia AI"
                onSelect={() => { setView("providers"); run(); }}
              />
              <PaletteItem
                icon={Zap}
                label="Hentikan semua generasi"
                onSelect={stopAll}
              />
            </CommandGroup>

            <CommandGroup heading="Buka">
              {NAV_ACTIONS.map((a) => (
                <PaletteItem
                  key={a.view}
                  icon={a.icon}
                  label={a.label}
                  onSelect={() => { setView(a.view); run(); }}
                />
              ))}
              <PaletteItem
                icon={MessagesSquare}
                label="Semua percakapan asisten"
                onSelect={() => { setView("conversations"); run(); }}
              />
            </CommandGroup>

            {rundownMatches.length > 0 && (
              <CommandGroup heading="Rundown">
                {rundownMatches.slice(0, 6).map((r) => (
                  <PaletteItem
                    key={r.id}
                    icon={ClipboardList}
                    label={r.title}
                    hint={`${r.segmentCount} segmen · ${formatDurationIndo(r.totalMinutes)} · ${relativeTimeIndo(r.updatedAt)}`}
                    onSelect={() => { openRundown(r.id); run(); }}
                  />
                ))}
              </CommandGroup>
            )}

            {query.trim().length <= 1 && (conversations ?? []).length > 0 && (
              <CommandGroup heading="Percakapan terbaru">
                {(conversations ?? []).slice(0, 6).map((c) => (
                  <PaletteItem
                    key={c.id}
                    icon={FileText}
                    label={c.title}
                    hint={relativeTime(c.updatedAt)}
                    onSelect={() => { onOpenConversation(c.id); run(); }}
                  />
                ))}
              </CommandGroup>
            )}

            {query.trim().length > 1 && (
              <CommandGroup heading="Hasil pencarian pesan">
                {(searchResults ?? []).length === 0 && (
                  <div className="px-3 py-3 text-[12.5px] text-muted-foreground/60">
                    Tidak ada pesan yang cocok dengan “{query}”.
                  </div>
                )}
                {(searchResults ?? []).map((r) => (
                  <PaletteItem
                    key={r.id}
                    icon={FileText}
                    label={r.title}
                    hint={r.snippet ?? relativeTime(r.updatedAt)}
                    onSelect={() => { onOpenConversation(r.id); run(); }}
                  />
                ))}
              </CommandGroup>
            )}

            <CommandSeparator className="opacity-50" />
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function PaletteItem({
  icon: Icon,
  label,
  hint,
  kbd,
  onSelect,
}: {
  icon: React.ElementType;
  label: string;
  hint?: string;
  kbd?: string;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      onSelect={onSelect}
      className="rounded-lg px-2.5 py-2 text-[13px] gap-2.5 aria-selected:bg-white/[0.06]"
    >
      <Icon className="size-4 text-muted-foreground/80" />
      <span className="truncate flex-1">{label}</span>
      {hint && (
        <span className="text-[11px] text-muted-foreground/55 truncate max-w-[220px]">
          {hint}
        </span>
      )}
      {kbd && (
        <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.04] text-muted-foreground/70">
          {kbd}
        </kbd>
      )}
    </CommandItem>
  );
}
