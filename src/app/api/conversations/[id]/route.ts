// Conversation detail: get (with messages + live generation), rename, archive, delete

import { db } from "@/lib/db";
import { toConversationDetail } from "@/lib/dto";
import { handle, ok, parseBody, ApiError } from "@/lib/api-helpers";
import { generationManager } from "@/lib/runtime/server/generation-manager";
import type { PublicGenerationState } from "@/lib/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const conversation = await db.conversation.findUnique({
      where: { id },
      include: {
        messages: true,
        agent: { select: { name: true } },
        generations: {
          where: { status: { in: ["queued", "streaming"] } },
          select: { id: true, status: true },
        },
      },
    });
    if (!conversation) throw new ApiError(404, "not_found", "Conversation not found.");

    // Live generation state (if one is running in the runtime right now)
    const activeGenId = conversation.generations[0]?.id ?? null;
    let liveGeneration: PublicGenerationState | null = null;
    if (activeGenId) {
      const state = generationManager.getLive(activeGenId);
      if (state && !["completed", "failed", "cancelled"].includes(state.status)) {
        liveGeneration = state;
      }
    }

    return ok({
      conversation: toConversationDetail(conversation),
      liveGeneration,
    });
  });
}

const PatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  systemPrompt: z.string().max(8000).nullable().optional(),
  archived: z.boolean().optional(),
  providerId: z.string().nullable().optional(),
  modelKey: z.string().nullable().optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await parseBody(req, PatchSchema);
    const existing = await db.conversation.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "not_found", "Conversation not found.");

    const conversation = await db.conversation.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.systemPrompt !== undefined ? { systemPrompt: body.systemPrompt } : {}),
        ...(body.archived !== undefined ? { archived: body.archived } : {}),
        ...(body.providerId !== undefined ? { providerId: body.providerId } : {}),
        ...(body.modelKey !== undefined ? { modelKey: body.modelKey } : {}),
        updatedAt: new Date(),
      },
      include: {
        messages: true,
        agent: { select: { name: true } },
        generations: {
          where: { status: { in: ["queued", "streaming"] } },
          select: { id: true, status: true },
        },
      },
    });
    return ok({ conversation: toConversationDetail(conversation) });
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const existing = await db.conversation.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "not_found", "Conversation not found.");

    // Stop any live generation belonging to this conversation first.
    const active = generationManager.activeStates();
    for (const gen of active) {
      if (gen.conversationId === id) generationManager.stop(gen.id);
    }

    await db.conversation.delete({ where: { id } });
    return ok({ deleted: true });
  });
}
