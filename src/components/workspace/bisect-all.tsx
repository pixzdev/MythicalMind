"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ConversationsHome } from "@/components/conversations/conversations-home";
import { TopBar } from "@/components/workspace/top-bar";
import { Sidebar } from "@/components/workspace/sidebar";
import { ContextPanel } from "@/components/workspace/context-panel";
import { CommandPalette } from "@/components/workspace/command-palette";
import { AuroraBackground } from "@/components/aurora/aurora-background";
import { TooltipProvider } from "@/components/ui/tooltip";

function Inner() {
  const p = useSearchParams();
  const mode = p.get("m") ?? "pair";
  const [open, setOpen] = useState(false);
  if (mode === "pair") return (
    <div><ConversationsHome /><ContextPanel /></div>
  );
  if (mode === "topbar") return <TopBar onOpenPalette={() => setOpen(true)} />;
  if (mode === "combo") return (
    <TooltipProvider>
      <div className="h-dvh flex flex-col">
        <AuroraBackground />
        <TopBar onOpenPalette={() => setOpen(true)} />
        <div className="flex-1 flex">
          <Sidebar />
          <main className="flex-1"><ConversationsHome /></main>
          <aside className="w-64"><ContextPanel /></aside>
        </div>
        <CommandPalette open={open} onOpenChange={setOpen} onOpenConversation={() => undefined} />
      </div>
    </TooltipProvider>
  );
  return <div>none</div>;
}

export function BisectAll() {
  return <Suspense><Inner /></Suspense>;
}
