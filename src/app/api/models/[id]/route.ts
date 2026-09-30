// Model metadata edit (manual capabilities) + delete

import { db } from "@/lib/db";
import { toModelDTO } from "@/lib/dto";
import { handle, ok, parseBody, ApiError } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  contextWindow: z.number().int().positive().nullable().optional(),
  vision: z.boolean().optional(),
  reasoning: z.boolean().optional(),
  tools: z.boolean().optional(),
  streaming: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await parseBody(req, PatchSchema);
    const existing = await db.model.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "not_found", "Model not found.");

    const model = await db.model.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.contextWindow !== undefined
          ? { contextWindow: body.contextWindow }
          : {}),
        ...(body.vision !== undefined ? { vision: body.vision } : {}),
        ...(body.reasoning !== undefined ? { reasoning: body.reasoning } : {}),
        ...(body.tools !== undefined ? { tools: body.tools } : {}),
        ...(body.streaming !== undefined ? { streaming: body.streaming } : {}),
      },
      include: { provider: { select: { name: true } } },
    });
    return ok({ model: toModelDTO(model) });
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const existing = await db.model.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "not_found", "Model not found.");

    // clear default-model references pointing at it
    await db.provider.updateMany({
      where: { defaultModel: existing.modelId, id: existing.providerId },
      data: { defaultModel: null },
    });
    await db.conversation.updateMany({
      where: { providerId: existing.providerId, modelKey: existing.modelId },
      data: { modelKey: null },
    });

    await db.model.delete({ where: { id } });
    return ok({ deleted: true });
  });
}
