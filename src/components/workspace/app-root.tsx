// App root: query client + runtime bridge boot + settings application.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { runtime } from "@/lib/runtime/client/runtime-client";
import { useSettings } from "@/hooks/mythicalmind/queries";
import { useWorkspace } from "@/store/workspace-store";
import { AppShell } from "./app-shell";

const ACCENTS: Record<string, string> = {
  violet: "#8b5cf6",
  cyan: "#22d3ee",
  teal: "#2dd4bf",
  magenta: "#e879f9",
};

const ACCENT_SECONDARY: Record<string, string> = {
  violet: "#22d3ee",
  cyan: "#8b5cf6",
  teal: "#a78bfa",
  magenta: "#22d3ee",
};

const ATMOSPHERE_OPACITY: Record<string, string> = {
  subtle: "0.55",
  medium: "0.95",
  off: "0",
};

function RuntimeProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useSettings();

  // Apply appearance settings to the document root (live).
  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    const accent = ACCENTS[settings.appearance.accent] ?? ACCENTS.violet;
    const accent2 = ACCENT_SECONDARY[settings.appearance.accent] ?? ACCENT_SECONDARY.violet;
    root.style.setProperty("--aurora-accent", accent);
    root.style.setProperty("--aurora-accent-2", accent2);
    root.style.setProperty(
      "--aurora-opacity",
      ATMOSPHERE_OPACITY[settings.appearance.atmosphere] ?? "0.55"
    );
    root.classList.toggle(
      "aurora-static",
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, [settings]);

  // Boot: reconnect to every active generation (background streaming
  // survives refreshes — the runtime never depended on the page).
  useEffect(() => {
    void runtime.syncActive();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void runtime.syncActive();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  // Completion notices for generations the user is NOT currently watching.
  const handler = useCallback((run: { state: { status: string; conversationId: string; conversationTitle: string | null; error: { message: string } | null } }) => {
    const state = useWorkspace.getState();
    const watching = state.conversationId === run.state.conversationId;
    if (watching) return;
    const title = run.state.conversationTitle ?? "Percakapan";
    if (run.state.status === "completed") {
      toast.success(`Generasi selesai — ${title}`, {
        description: "Respons lengkap sudah tersimpan.",
        action: {
          label: "Buka",
          onClick: () => {
            useWorkspace.getState().openConversation(run.state.conversationId);
          },
        },
      });
    } else if (run.state.status === "failed") {
      toast.error(`Generasi gagal — ${title}`, {
        description: run.state.error?.message ?? "Penyedia melaporkan sebuah kesalahan.",
        action: {
          label: "Buka",
          onClick: () => {
            useWorkspace.getState().openConversation(run.state.conversationId);
          },
        },
      });
    }
  }, []);

  useEffect(() => {
    runtime.setCompletionHandler(handler);
    return () => runtime.setCompletionHandler(null);
  }, [handler]);

  return <>{children}</>;
}

export function AppRoot() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  useEffect(() => {
    runtime.setQueryClient(queryClient);
  }, [queryClient]);

  const content = useMemo(
    () => (
      <RuntimeProvider>
        <AppShell />
      </RuntimeProvider>
    ),
    []
  );

  return (
    <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
  );
}
