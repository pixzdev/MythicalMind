// App shell: aurora atmosphere + top bar + sidebar + routed main view +
// context panel, with responsive drawer fallbacks and global shortcuts.

"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuroraBackground } from "@/components/aurora/aurora-background";
import { TopBar } from "./top-bar";
import { Sidebar, SidebarContent } from "./sidebar";
import { ContextPanel } from "./context-panel";
import { CommandPalette } from "./command-palette";
import { RundownDashboard } from "@/components/rundown/rundown-dashboard";
import { RundownLibrary } from "@/components/rundown/rundown-library";
import { RundownEditor } from "@/components/rundown/rundown-editor";
import { RundownWizard } from "@/components/rundown/rundown-wizard";
import { ConversationView } from "@/components/chat/conversation-view";
import { ConversationsHome } from "@/components/conversations/conversations-home";
import { AgentsPage } from "@/components/agents/agents-page";
import { TasksPage } from "@/components/tasks/tasks-page";
import { ProvidersPage } from "@/components/providers/providers-page";
import { ModelsPage } from "@/components/models/models-page";
import { ActivityPage } from "@/components/activity/activity-page";
import { SettingsPage } from "@/components/settings/settings-page";
import { useWorkspace } from "@/store/workspace-store";

export function AppShell() {
  const {
    view,
    conversationId,
    rundownId,
    sidebarOpen,
    mobileNavOpen,
    setMobileNavOpen,
    contextOpen,
    contextSheetOpen,
    setContextSheetOpen,
    setView,
    openConversation,
    openWizard,
  } = useWorkspace();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        openWizard();
      } else if (mod && e.key === ".") {
        e.preventDefault();
        setContextSheetOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setView, setContextSheetOpen, openWizard]);

  return (
    <TooltipProvider delayDuration={250}>
      <div className="h-dvh flex flex-col overflow-hidden">
        <AuroraBackground />
        <TopBar onOpenPalette={() => setPaletteOpen(true)} />

        <div className="flex-1 flex min-h-0">
          {sidebarOpen && <Sidebar />}

          <main className="flex-1 min-w-0 flex flex-col relative" aria-live="off">
            {view === "beranda" && <RundownDashboard />}
            {view === "rundowns" && <RundownLibrary />}
            {view === "rundown-editor" &&
              (rundownId ? <RundownEditor key={rundownId} rundownId={rundownId} /> : <RundownLibrary />)}
            {view === "conversations" && <ConversationsHome />}
            {view === "chat" && conversationId && (
              <ConversationView key={conversationId} conversationId={conversationId} />
            )}
            {view === "chat" && !conversationId && <ConversationsHome />}
            {view === "agents" && <AgentsPage />}
            {view === "tasks" && <TasksPage />}
            {view === "providers" && <ProvidersPage />}
            {view === "models" && <ModelsPage />}
            {view === "activity" && <ActivityPage />}
            {view === "settings" && <SettingsPage />}
          </main>

          {view !== "chat" && contextOpen && (
            <aside
              className="hidden xl:flex w-[304px] flex-none flex-col min-h-0 border-l border-white/6 bg-[rgba(5,8,15,0.55)] backdrop-blur-xl"
              aria-label="Context panel"
            >
              <ContextPanel />
            </aside>
          )}
        </div>

        {/* Mobile / tablet navigation drawer */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent
            side="left"
            className="w-[270px] p-0 bg-[rgba(6,9,17,0.97)] border-white/8"
          >
            <SheetTitle className="sr-only">Navigasi</SheetTitle>
            <SheetDescription className="sr-only">
              Navigasi ruang kerja, rundown terbaru, dan status penyedia.
            </SheetDescription>
            <SidebarContent />
          </SheetContent>
        </Sheet>

        {/* Context panel on smaller screens (and chat "info" drawer at any
            size): bottom sheet on mobile, side sheet on tablet+ */}
        <Drawer open={contextSheetOpen} onOpenChange={setContextSheetOpen}>
          <DrawerContent className="max-h-[82dvh] bg-[rgba(8,11,20,0.97)] border-white/8">
            <DrawerTitle className="sr-only">Info</DrawerTitle>
            <DrawerDescription className="sr-only">
              Runtime, model aktif, dan system prompt percakapan.
            </DrawerDescription>
            <div className="overflow-y-auto max-h-[74dvh]">
              <ContextPanel onDone={() => setContextSheetOpen(false)} />
            </div>
          </DrawerContent>
        </Drawer>

        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          onOpenConversation={openConversation}
        />

        {/* Rundown creation wizard (global dialog) */}
        <RundownWizard />
      </div>
    </TooltipProvider>
  );
}
