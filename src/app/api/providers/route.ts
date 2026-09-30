// Providers: list (masked) + create

import { db } from "@/lib/db";
import { toProviderDTO } from "@/lib/dto";
import { handle, ok, parseBody, ApiError } from "@/lib/api-helpers";
import { normalizeBaseUrl } from "@/lib/providers/server/openai-compatible";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const providers = await db.provider.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { models: true } } },
    });
    return ok({ providers: providers.map(toProviderDTO) });
  });
}

const HeadersSchema = z.record(z.string(), z.string());

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.string().default("openai-compatible"),
  baseUrl: z.string().trim().min(4).max(500),
  apiKey: z.string().max(500).default(""),
  defaultModel: z.string().trim().max(200).optional().nullable(),
  customHeaders: HeadersSchema.optional().default({}),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = await parseBody(req, CreateSchema);
    const baseUrl = normalizeBaseUrl(body.baseUrl);

    const provider = await db.provider.create({
      data: {
        name: body.name,
        type: body.type || "openai-compatible",
        baseUrl,
        apiKey: body.apiKey ?? "",
        defaultModel: body.defaultModel || null,
        customHeaders: JSON.stringify(body.customHeaders ?? {}),
      },
      include: { _count: { select: { models: true } } },
    });

    await db.activityEvent.create({
      data: {
        type: "provider.added",
        level: "info",
        title: `Provider added: ${provider.name}`,
        detail: baseUrl,
        providerId: provider.id,
      },
    });

    return ok({ provider: toProviderDTO(provider) }, 201);
  });
}
