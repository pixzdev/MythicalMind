// Workspace UI state (client-side view routing, panels, drafts, composer model)

"use client";

import { create } from "zustand";

export type WorkspaceView =
  | "beranda"
  | "rundowns"
  | "rundown-editor"
  | "conversations"
  | "chat"
  | "agents"
  | "tasks"
  | "providers"
  | "models"
  | "activity"
  | "settings";

export interface ModelSelection {
  providerId: string;
  modelKey: string | null;
}

interface WorkspaceState {
  view: WorkspaceView;
  rundownId: string | null;
  conversationId: string | null;
  wizardOpen: boolean;
  wizardTab: "template" | "ai";
  sidebarOpen: boolean; // desktop rail
  mobileNavOpen: boolean; // mobile drawer
  contextOpen: boolean; // desktop context panel
  contextSheetOpen: boolean; // mobile context sheet
  composerModel: ModelSelection | null;
  drafts: Record<string, string>;

  setView: (view: WorkspaceView) => void;
  openRundown: (id: string) => void;
  closeRundown: () => void;
  openWizard: (tab?: "template" | "ai") => void;
  setWizardOpen: (open: boolean) => void;
  setWizardTab: (tab: "template" | "ai") => void;
  openConversation: (id: string) => void;
  newConversation: () => void;
  closeConversation: () => void;
  toggleSidebar: () => void;
  setMobileNavOpen: (open: boolean) => void;
  toggleContext: () => void;
  setContextSheetOpen: (open: boolean) => void;
  setComposerModel: (model: ModelSelection | null) => void;
  setDraft: (conversationId: string, text: string) => void;
}

export const useWorkspace = create<WorkspaceState>((set) => ({
  view: "beranda",
  rundownId: null,
  conversationId: null,
  wizardOpen: false,
  wizardTab: "template" as "template" | "ai",
  sidebarOpen: true,
  mobileNavOpen: false,
  contextOpen: false, // desktop context rail — opt-in (chat stays single-column)
  contextSheetOpen: false,
  composerModel: null,
  drafts: {},

  setView: (view) => set({ view, mobileNavOpen: false }),
  openRundown: (id) =>
    set({ view: "rundown-editor", rundownId: id, mobileNavOpen: false }),
  closeRundown: () => set({ view: "rundowns", rundownId: null }),
  openWizard: (tab) => set({ wizardOpen: true, wizardTab: tab ?? "template", mobileNavOpen: false }),
  setWizardOpen: (open) => set({ wizardOpen: open }),
  setWizardTab: (tab) => set({ wizardTab: tab }),
  openConversation: (id) => set({ view: "chat", conversationId: id, mobileNavOpen: false }),
  newConversation: () => set({ view: "conversations", conversationId: null, mobileNavOpen: false }),
  closeConversation: () => set({ view: "conversations", conversationId: null }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  toggleContext: () => set((s) => ({ contextOpen: !s.contextOpen })),
  setContextSheetOpen: (open) => set({ contextSheetOpen: open }),
  setComposerModel: (model) => set({ composerModel: model }),
  setDraft: (conversationId, text) =>
    set((s) => ({ drafts: { ...s.drafts, [conversationId]: text } })),
}));
