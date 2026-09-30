// Data export: full workspace JSON. Provider API keys are intentionally
// EXCLUDED — exports are for content backup, not secret transport.

import { db } from "@/lib/db";
import { handle } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const [providers, models, conversations, messages, generations, agents, activity] =
      await Promise.all([
        db.provider.findMany(),
        db.model.findMany(),
        db.conversation.findMany(),
        db.message.findMany({ orderBy: { sortOrder: "asc" } }),
        db.generation.findMany({ orderBy: { startedAt: "desc" } }),
        db.agent.findMany(),
        db.activityEvent.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
      ]);

    const payload = {
      app: "MythicalMind",
      exportedAt: new Date().toISOString(),
      note: "Provider API keys are excluded from exports by design.",
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        baseUrl: p.baseUrl,
        defaultModel: p.defaultModel,
        customHeaders: JSON.parse(p.customHeaders ?? "{}"),
        status: p.status,
        createdAt: p.createdAt,
      })),
      models,
      conversations,
      messages,
      generations,
      agents,
      activity,
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="mythicalmind-export-${new Date()
          .toISOString()
          .slice(0, 10)}.json"`,
      },
    });
  });
}
