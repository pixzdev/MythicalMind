// Provider: get / update / delete. API keys: never returned; leaving the key
// field blank on update keeps the stored key.

import { db } from "@/lib/db";
import { toProviderDTO } from "@/lib/dto";
import { handle, ok, parseBody, ApiError } from "@/lib/api-helpers";
import { normalizeBaseUrl } from "@/lib/providers/server/openai-compatible";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const provider = await db.provider.findUnique({
      where: { id },
      include: { _count: { select: { models: true } } },
    });
    if (!provider) throw new ApiError(404, "not_found", "Provider not found.");
    return ok({ provider: toProviderDTO(provider) });
  });
}

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  baseUrl: z.string().trim().min(4).max(500).optional(),
  apiKey: z.string().max(500).optional(), // undefined/'' → keep existing
  defaultModel: z.string().trim().max(200).nullable().optional(),
  customHeaders: z.record(z.string(), z.string()).optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await parseBody(req, PatchSchema);
    const existing = await db.provider.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "not_found", "Provider not found.");

    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) data.name = body.name;
    if (body.baseUrl !== undefined) data.baseUrl = normalizeBaseUrl(body.baseUrl);
    if (body.defaultModel !== undefined) data.defaultModel = body.defaultModel || null;
    if (body.customHeaders !== undefined) {
      data.customHeaders = JSON.stringify(body.customHeaders);
    }
    if (typeof body.apiKey === "string" && body.apiKey.trim() !== "") {
      data.apiKey = body.apiKey.trim();
    }
    // any config change invalidates the last test result
    if (
      body.baseUrl !== undefined ||
      body.apiKey !== undefined ||
      body.customHeaders !== undefined
    ) {
      data.status = "unverified";
      data.statusDetail = null;
      data.lastTestedAt = null;
    }

    const provider = await db.provider.update({
      where: { id },
      data,
      include: { _count: { select: { models: true } } },
    });
    return ok({ provider: toProviderDTO(provider) });
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const existing = await db.provider.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "not_found", "Provider not found.");

    await db.provider.delete({ where: { id } });

    await db.activityEvent.create({
      data: {
        type: "provider.removed",
        level: "warn",
        title: `Provider removed: ${existing.name}`,
        detail: existing.baseUrl,
      },
    });

    return ok({ deleted: true });
  });
}
