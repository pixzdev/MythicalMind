// Model discovery via GET {baseURL}/models (optional per provider).
// Existing manually-entered models keep their metadata; new ones are added.

import { db } from "@/lib/db";
import { toModelDTO } from "@/lib/dto";
import { handle, ok, ApiError } from "@/lib/api-helpers";
import { registry } from "@/lib/providers/server/registry";
import type { ProviderConfig } from "@/lib/providers/server/registry";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const provider = await db.provider.findUnique({ where: { id } });
    if (!provider) throw new ApiError(404, "not_found", "Provider not found.");

    const config: ProviderConfig = {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      customHeaders: safeParseHeaders(provider.customHeaders),
    };

    const adapter = registry.get(provider.type);

    let discovered;
    try {
      discovered = await adapter.listModels(config);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Model discovery failed.";
      return ok(
        {
          discovered: false,
          models: [],
          message: `The provider does not expose /models (${message}). Add models manually — everything else works.`,
        },
        200
      );
    }

    let added = 0;
    let updated = 0;
    for (const m of discovered) {
      const existing = await db.model.findUnique({
        where: { providerId_modelId: { providerId: id, modelId: m.modelId } },
      });
      if (existing) {
        if (existing.name === existing.modelId && m.name !== m.modelId) {
          await db.model.update({
            where: { id: existing.id },
            data: {
              name: m.name,
              ...(m.contextWindow && !existing.contextWindow
                ? { contextWindow: m.contextWindow }
                : {}),
            },
          });
          updated++;
        }
        if (m.contextWindow && !existing.contextWindow) {
          await db.model.update({
            where: { id: existing.id },
            data: { contextWindow: m.contextWindow },
          });
        }
      } else {
        await db.model.create({
          data: {
            providerId: id,
            modelId: m.modelId,
            name: m.name,
            ...(m.contextWindow ? { contextWindow: m.contextWindow } : {}),
          },
        });
        added++;
      }
    }

    if (added > 0) {
      await db.activityEvent.create({
        data: {
          type: "provider.models_discovered",
          level: "info",
          title: `${provider.name}: ${added} new models discovered`,
          providerId: provider.id,
        },
      });
    }

    const models = await db.model.findMany({
      where: { providerId: id },
      orderBy: { name: "asc" },
      include: { provider: { select: { name: true } } },
    });

    return ok({
      discovered: true,
      added,
      updated,
      models: models.map(toModelDTO),
      message:
        added > 0
          ? `Discovered ${added} new model${added === 1 ? "" : "s"}.`
          : "No new models — the provider already exposes everything found.",
    });
  });
}

function safeParseHeaders(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string") out[k] = v;
      }
      return out;
    }
  } catch {
    /* ignore */
  }
  return {};
}
