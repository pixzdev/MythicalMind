// Agent: update / delete

import { db } from "@/lib/db";
import { toAgentDTO } from "@/lib/dto";
import { handle, ok, parseBody, ApiError } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(300).nullable().optional(),
  systemPrompt: z.string().trim().min(1).max(8000).optional(),
  temperature: z.number().min(0).max(2).nullable().optional(),
  providerId: z.string().nullable().optional(),
  modelKey: z.string().nullable().optional(),
  icon: z.string().optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await parseBody(req, PatchSchema);
    const existing = await db.agent.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "not_found", "Agent not found.");

    const agent = await db.agent.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.systemPrompt !== undefined
          ? { systemPrompt: body.systemPrompt }
          : {}),
        ...(body.temperature !== undefined
          ? { temperature: body.temperature }
          : {}),
        ...(body.providerId !== undefined ? { providerId: body.providerId } : {}),
        ...(body.modelKey !== undefined ? { modelKey: body.modelKey } : {}),
        ...(body.icon !== undefined ? { icon: body.icon } : {}),
      },
    });
    return ok({ agent: toAgentDTO(agent) });
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const existing = await db.agent.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "not_found", "Agent not found.");
    await db.agent.delete({ where: { id } });
    return ok({ deleted: true });
  });
}
