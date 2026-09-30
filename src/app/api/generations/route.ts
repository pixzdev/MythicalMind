// Generations: live + historical overview (Tasks view / boot reconnection)

import { db } from "@/lib/db";
import { handle, ok } from "@/lib/api-helpers";
import { generationManager } from "@/lib/runtime/server/generation-manager";
import type { PublicGenerationState } from "@/lib/types";
import type { Generation } from "@prisma/client";

export const dynamic = "force-dynamic";

type Row = Generation & { conversation: { title: string } | null };

function rowToState(row: Row): PublicGenerationState {
  return {
    id: row.id,
    conversationId: row.conversationId,
    conversationTitle: row.conversation?.title ?? null,
    messageId: row.messageId,
    providerId: row.providerId,
    providerName: row.providerName,
    modelKey: row.modelKey,
    status: row.status as PublicGenerationState["status"],
    text: "",
    reasoning: "",
    outputChars: row.outputChars,
    usage: safeParse(row.usage),
    error: safeParse(row.error),
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    durationMs: row.durationMs,
  };
}

export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") ?? "all";
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 300);

    // Live states (authoritative for anything running right now)
    const active = generationManager.activeStates();

    if (scope === "active") {
      return ok({ generations: active });
    }

    const rows = await db.generation.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
      include: { conversation: { select: { title: true } } },
    });

    const activeIds = new Set(active.map((g) => g.id));
    const historical: PublicGenerationState[] = rows
      .filter((r) => !activeIds.has(r.id))
      .map(rowToState);

    return ok({ generations: [...active, ...historical] });
  });
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
