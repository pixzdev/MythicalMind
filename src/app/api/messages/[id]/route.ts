// Message edit (user) + delete (this message and everything after it)

import { db } from "@/lib/db";
import { toMessageDTO } from "@/lib/dto";
import { handle, ok, parseBody, ApiError } from "@/lib/api-helpers";
import { generationManager } from "@/lib/runtime/server/generation-manager";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  content: z.string().min(1).max(100_000),
  truncateAfter: z.boolean().optional().default(true),
});

export async function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await parseBody(req, PatchSchema);
    const message = await db.message.findUnique({ where: { id } });
    if (!message) throw new ApiError(404, "not_found", "Message not found.");
    if (message.role !== "user") {
      throw new ApiError(400, "not_editable", "Only user messages can be edited.");
    }

    const updated = await db.message.update({
      where: { id },
      data: { content: body.content.trim(), updatedAt: new Date() },
    });

    let removed = 0;
    if (body.truncateAfter) {
      // stop any live generation writing after this message
      const actives = generationManager.activeStates().filter(
        (g) =>
          g.conversationId === message.conversationId &&
          g.messageId &&
          g.messageId !== message.id
      );
      for (const g of actives) generationManager.stop(g.id);

      const result = await db.message.deleteMany({
        where: {
          conversationId: message.conversationId,
          sortOrder: { gt: message.sortOrder },
        },
      });
      removed = result.count;
      await db.conversation.update({
        where: { id: message.conversationId },
        data: { updatedAt: new Date() },
      });
    }

    return ok({ message: toMessageDTO(updated), removed });
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const message = await db.message.findUnique({ where: { id } });
    if (!message) throw new ApiError(404, "not_found", "Message not found.");

    // stop a live generation writing into this message
    const actives = generationManager.activeStates().filter(
      (g) => g.messageId === message.id
    );
    for (const g of actives) generationManager.stop(g.id);

    const removed = await db.message.deleteMany({
      where: {
        conversationId: message.conversationId,
        sortOrder: { gte: message.sortOrder },
      },
    });
    await db.conversation.update({
      where: { id: message.conversationId },
      data: { updatedAt: new Date() },
    });
    return ok({ removed: removed.count });
  });
}
