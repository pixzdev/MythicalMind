// Workspace sidebar: rundown-first navigation (Beranda / Rundown / Asisten),
// recent rundowns, provider status footer. Chat remains one click away.

"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalendarPlus,
  Home,
  ClipboardList,
  MessagesSquare,
  Bot,
  Server,
  Boxes,
  Activity,
  Settings2,
  ChevronDown,
  Pencil,
  Trash2,
  Plug,
  Clock3,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDurationIndo, relativeTimeIndo } from "@/lib/rundown/time";
import { useWorkspace, type WorkspaceView } from "@/store/workspace-store";
import {
  useAgents,
  useConversations,
  useCreateConversation,
  useProviders,
} from "@/hooks/mythicalmind/queries";
import {
  useRundowns,
  useUpdateRundown,
} from "@/hooks/mythicalmind/rundown-queries";

interface NavItem {
  view: WorkspaceView;
  label: string;
  icon: LucideIcon;
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Ruang Kerja",
    items: [
      { view: "beranda", label: "Beranda", icon: Home },
      { view: "rundowns", label: "Rundown", icon: ClipboardList },
      { view: "conversations", label: "Asisten AI", icon: MessagesSquare },
    ],
  },
  {
    title: "Infrastruktur",
    items: [
      { view: "providers", label: "Penyedia", icon: Server },
      { view: "models", label: "Model", icon: Boxes },
    ],
  },
  {
    title: "Sistem",
    items: [
      { view: "activity", label: "Aktivitas", icon: Activity },
      { view: "settings", label: "Pengaturan", icon: Settings2 },
    ],
  },
];

export function SidebarContent() {
  const { view, setView, openRundown, openWizard, openConversation, rundownId, conversationId } =
    useWorkspace();
  const { data: rundowns } = useRundowns();
  const { data: agents } = useAgents();
  const { data: providers } = useProviders();
  const { data: conversations } = useConversations();
  const createConversation = useCreateConversation();
  const updateRundown = useUpdateRundown();

  const recentRundowns = useMemo(
    () => (rundowns ?? []).slice(0, 8),
    [rundowns]
  );

  const connectedProviders = (providers ?? []).filter(
    (p) => p.status === "connected"
  ).length;

  const startConversation = (agentId?: string) => {
    if (agentId) {
      createConversation.mutate(
        { agentId },
        { onSuccess: (data) => openConversation(data.conversation.id) }
      );
    } else {
      createConversation.mutate({}, {
        onSuccess: (data) => openConversation(data.conversation.id),
      });
    }
  };

  const renameRundown = (id: string, title: string) => {
    updateRundown.mutate({ id, title });
  };

  return (
    <div className="flex h-full flex-col min-h-0">
      {/* Primary action: new rundown */}
      <div className="p-3 pb-2">
        <DropdownMenu>
          <div className="flex gap-1.5">
            <Button
              onClick={() => openWizard()}
              className="flex-1 h-9 bg-[var(--aurora-accent)] hover:bg-[var(--aurora-accent)]/85 text-white shadow-[0_0_24px_-8px_var(--aurora-accent)]"
              aria-label="Rundown baru"
            >
              <CalendarPlus className="size-4" />
              <span className="text-[13.5px] font-medium">Rundown baru</span>
            </Button>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-7 border-white/10"
                aria-label="Percakapan asisten baru"
              >
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
          </div>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">
              Percakapan asisten
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => startConversation()} className="gap-2">
              <MessagesSquare className="size-3.5 text-[var(--aurora-accent-2)]" />
              <span>Percakapan baru</span>
            </DropdownMenuItem>
            {(agents ?? []).map((agent) => (
              <DropdownMenuItem
                key={agent.id}
                onClick={() => startConversation(agent.id)}
                className="gap-2"
              >
                <Bot className="size-3.5 text-[var(--aurora-accent-2)]" />
                <span className="truncate">{agent.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav aria-label="Navigasi ruang kerja" className="px-2 py-1 space-y-3">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="px-2.5 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  view === item.view ||
                  (item.view === "conversations" && view === "chat" && !conversationId) ||
                  (item.view === "rundowns" && view === "rundown-editor");
                return (
                  <button
                    key={item.view}
                    onClick={() => setView(item.view)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "w-full flex items-center gap-2.5 h-8 rounded-lg px-2.5 text-[13px] transition-colors",
                      active
                        ? "bg-white/[0.06] text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground/90 hover:bg-white/[0.035]"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-4",
                        active ? "text-[var(--aurora-accent-2)]" : "opacity-80"
                      )}
                    />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Recent rundowns */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 pt-1">
        {recentRundowns.length > 0 && (
          <div className="px-2.5 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
            Rundown terbaru
          </div>
        )}
        {recentRundowns.length === 0 && (
          <div className="px-3 py-6 text-xs text-muted-foreground/70 leading-relaxed">
            Rundown-mu akan tampil di sini.
          </div>
        )}
        <div className="space-y-0.5">
          {recentRundowns.map((r) => {
            const isActive = rundownId === r.id;
            return (
              <div key={r.id} className="group/row relative">
                <button
                  onClick={() => openRundown(r.id)}
                  className={cn(
                    "w-full text-left flex items-center gap-2 rounded-lg px-2.5 h-9 pr-9 transition-colors",
                    isActive
                      ? "bg-white/[0.06] text-foreground"
                      : "text-muted-foreground hover:bg-white/[0.035] hover:text-foreground/90"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="truncate text-[13px]">{r.title}</span>
                </button>
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <span className="hidden group-hover/row:flex text-[10.5px] text-muted-foreground/50 pr-1 tabular-nums items-center gap-1">
                    <Clock3 className="size-2.5" />
                    {formatDurationIndo(r.totalMinutes)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 opacity-0 group-hover/row:opacity-100 text-muted-foreground"
                        aria-label={`Aksi untuk ${r.title}`}
                      >
                        <Pencil className="size-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      <DropdownMenuItem
                        onClick={() => {
                          const title = window.prompt("Ganti judul rundown", r.title);
                          if (title && title.trim()) renameRundown(r.id, title.trim());
                        }}
                      >
                        <Pencil className="size-3.5" /> Ganti judul
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openWizard()}>
                        <CalendarPlus className="size-3.5" /> Rundown baru
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>

        {/* quiet conversations hint under recent rundowns */}
        {(conversations ?? []).length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setView("conversations")}
              className="w-full flex items-center gap-2 rounded-lg px-2.5 h-8 text-[12.5px] text-muted-foreground/70 hover:text-foreground/85 hover:bg-white/[0.035] transition-colors"
            >
              <MessagesSquare className="size-3.5" />
              <span className="truncate">
                {conversations!.length} percakapan asisten
              </span>
              <span className="ml-auto text-[10.5px] text-muted-foreground/45">
                {relativeTimeIndo(conversations![0].updatedAt)}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Footer: provider status */}
      <button
        onClick={() => setView("providers")}
        className="m-2 mt-0 flex items-center gap-2 rounded-lg border border-white/6 bg-white/[0.02] px-2.5 h-8 text-[12px] text-muted-foreground hover:bg-white/[0.045] hover:text-foreground/90 transition-colors"
        aria-label="Status penyedia"
      >
        <Plug
          className={cn(
            "size-3.5",
            providers?.length
              ? connectedProviders > 0
                ? "text-emerald-400/90"
                : "text-amber-400/90"
              : "text-muted-foreground/50"
          )}
        />
        <span className="truncate">
          {providers?.length
            ? `${providers.length} penyedia · ${connectedProviders} terhubung`
            : "Belum ada penyedia AI"}
        </span>
      </button>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside
      className="hidden lg:flex w-[252px] flex-none flex-col min-h-0 border-r border-white/6 bg-[rgba(5,8,15,0.6)] backdrop-blur-xl"
      aria-label="Sidebar"
    >
      <SidebarContent />
    </aside>
  );
}

export { SECTIONS as NAV_SECTIONS };
export type { NavItem };
