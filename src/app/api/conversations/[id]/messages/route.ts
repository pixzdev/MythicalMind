// Send a message: persists the user message, creates the assistant message +
// generation, and starts the background run. Returns immediately — streaming
// happens over /api/generations/[id]/events.

import { db } from "@/lib/db";
import { handle, ok, parseBody } from "@/lib/api-helpers";
import {
  buildHistory,
  historyToRequestMessages,
  resolveTarget,
  startGenerationRun,
} from "@/lib/runtime/server/conversation-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const SendSchema = z.object({
  content: z.string().min(1, "Message cannot be empty.").max(100_000),
  providerId: z.string().optional().nullable(),
  modelKey: z.string().optional().nullable(),
  temperature: z.number().min(0).max(2).optional().nullable(),
  maxTokens: z.number().int().positive().max(1_000_000).optional().nullable(),
});

export async function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await parseBody(req, SendSchema);

    const conversation = await db.conversation.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!conversation) {
      return ok({ error: { code: "not_found", message: "Conversation not found." } }, 404);
    }

    const target = await resolveTarget(id, body);

    // Any live generation for this conversation must not be duplicated:
    // stop it first (the UI offers "send anyway while stopped" semantics).
    const { generationManager } = await import(
      "@/lib/runtime/server/generation-manager"
    );
    for (const active of generationManager.activeStates()) {
      if (active.conversationId === id) generationManager.stop(active.id);
    }

    const { system, messages } = await buildHistory(id);
    const requestMessages = historyToRequestMessages(system, [
      ...messages,
      { role: "user", content: body.content.trim() },
    ]);

    const result = await startGenerationRun({
      conversationId: id,
      target,
      requestMessages,
      userContent: body.content,
      temperature: body.temperature ?? null,
      maxTokens: body.maxTokens ?? null,
    });

    return ok(result, 201);
  });
}
