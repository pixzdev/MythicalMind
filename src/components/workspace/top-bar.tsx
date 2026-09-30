// Top bar: wordmark, search trigger (⌘K), live runtime indicator, actions.

"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings2, SlidersHorizontal, Search, Menu, Zap, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveRuns } from "@/lib/runtime/client/hooks";
import { useWorkspace, type WorkspaceView } from "@/store/workspace-store";
import { formatCount } from "@/lib/format";

const VIEW_LABELS: Record<WorkspaceView, string> = {
  beranda: "Beranda",
  rundowns: "Pustaka Rundown",
  "rundown-editor": "Editor Rundown",
  conversations: "Asisten AI",
  chat: "Percakapan",
  agents: "Agents",
  tasks: "Tasks",
  providers: "Providers",
  models: "Models",
  activity: "Activity",
  settings: "Settings",
};

export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { view, setMobileNavOpen, setView, toggleContext, openWizard } = useWorkspace();
  const active = useActiveRuns();

  const streaming = active.filter((r) => r.state.status === "streaming");
  const queued = active.filter((r) => r.state.status === "queued");

  return (
    <header className="h-13 flex-none px-3 sm:px-4 flex items-center gap-2 hairline-b bg-[rgba(4,6,13,0.6)] backdrop-blur-xl z-30">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden text-muted-foreground"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="size-4.5" />
      </Button>

      <div className="flex items-baseline gap-2.5 min-w-0">
        <span className="text-aurora-gradient font-semibold tracking-tight text-[15px] leading-none select-none">
          MythicalMind
        </span>
        <span className="hidden sm:block text-[11.5px] text-muted-foreground/70 font-medium tracking-wide uppercase truncate">
          {VIEW_LABELS[view]}
        </span>
      </div>

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => openWizard()}
        className="hidden sm:flex h-8 px-2.5 gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"
        aria-label="Rundown baru"
      >
        <CalendarPlus className="size-3.5 text-[var(--aurora-accent-2)]/80" />
        Rundown baru
      </Button>

      <button
        onClick={onOpenPalette}
        className="hidden md:flex items-center gap-2 h-8 px-3 rounded-lg border border-white/7 bg-white/[0.03] text-[13px] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground/90 transition-colors"
        aria-label="Cari (Command K)"
      >
        <Search className="size-3.5" />
        <span>Cari…</span>
        <kbd className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.04] text-muted-foreground/80">
          ⌘K
        </kbd>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-muted-foreground"
        onClick={onOpenPalette}
        aria-label="Cari"
      >
        <Search className="size-4" />
      </Button>

      {/* live runtime indicator — always visible while anything runs */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setView("tasks")}
            className="flex items-center gap-2 h-8 px-2.5 rounded-lg border border-white/7 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
            aria-label={`Runtime: ${active.length} active generation${active.length === 1 ? "" : "s"}`}
          >
            {active.length > 0 ? (
              <>
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full rounded-full bg-[var(--aurora-accent)] status-dot-live" />
                </span>
                <Zap className="size-3.5 text-[var(--aurora-accent)]" />
                <span className="text-[12.5px] font-medium tabular-nums">
                  {streaming.length > 0 && `${streaming.length} streaming`}
                  {streaming.length > 0 && queued.length > 0 && " · "}
                  {queued.length > 0 && `${queued.length} queued`}
                </span>
              </>
            ) : (
              <>
                <span className="size-2 rounded-full bg-emerald-400/70" />
                <span className="text-[12.5px] text-muted-foreground hidden sm:inline">
                  Runtime ready
                </span>
              </>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {active.length > 0
            ? `${formatCount(active.length)} generasi berjalan di latar belakang`
            : "Tidak ada generasi aktif"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "hidden xl:inline-flex text-muted-foreground",
              view === "chat" && "hidden"
            )}
            onClick={toggleContext}
            aria-label="Toggle context panel"
          >
            <SlidersHorizontal className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Panel konteks</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Workspace menu">
            <Settings2 className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setView("settings")}>
            Pengaturan
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setView("activity")}>
            Aktivitas
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setView("providers")}>
            Kelola penyedia
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
