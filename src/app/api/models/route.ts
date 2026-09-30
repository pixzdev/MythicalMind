// Models: aggregate list across providers + manual add

import { db } from "@/lib/db";
import { toModelDTO } from "@/lib/dto";
import { handle, ok, parseBody, ApiError } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const providerId = url.searchParams.get("providerId");
    const models = await db.model.findMany({
      where: providerId ? { providerId } : undefined,
      orderBy: [{ provider: { name: "asc" } }, { name: "asc" }],
      include: { provider: { select: { name: true } } },
    });
    return ok({ models: models.map(toModelDTO) });
  });
}

const CreateSchema = z.object({
  providerId: z.string(),
  modelId: z.string().trim().min(1).max(200),
  name: z.string().trim().max(200).optional(),
  contextWindow: z.number().int().positive().optional().nullable(),
  vision: z.boolean().optional().default(false),
  reasoning: z.boolean().optional().default(false),
  tools: z.boolean().optional().default(false),
  streaming: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = await parseBody(req, CreateSchema);
    const provider = await db.provider.findUnique({
      where: { id: body.providerId },
    });
    if (!provider) throw new ApiError(404, "not_found", "Provider not found.");

    const existing = await db.model.findUnique({
      where: {
        providerId_modelId: { providerId: body.providerId, modelId: body.modelId },
      },
    });
    if (existing) {
      throw new ApiError(
        409,
        "already_exists",
        `Model "${body.modelId}" already exists for this provider.`
      );
    }

    const model = await db.model.create({
      data: {
        providerId: body.providerId,
        modelId: body.modelId,
        name: body.name?.trim() || body.modelId,
        contextWindow: body.contextWindow ?? null,
        vision: body.vision,
        reasoning: body.reasoning,
        tools: body.tools,
        streaming: body.streaming,
      },
      include: { provider: { select: { name: true } } },
    });

    return ok({ model: toModelDTO(model) }, 201);
  });
}
