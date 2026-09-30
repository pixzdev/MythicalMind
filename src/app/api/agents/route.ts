// Agents: persona presets (system prompt + default model)

import { db } from "@/lib/db";
import { toAgentDTO } from "@/lib/dto";
import { handle, ok, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const agents = await db.agent.findMany({ orderBy: { createdAt: "asc" } });
    return ok({ agents: agents.map(toAgentDTO) });
  });
}

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional().nullable(),
  systemPrompt: z.string().trim().min(1).max(8000),
  temperature: z.number().min(0).max(2).optional().nullable(),
  providerId: z.string().optional().nullable(),
  modelKey: z.string().optional().nullable(),
  icon: z.string().default("sparkles"),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = await parseBody(req, CreateSchema);
    const agent = await db.agent.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        systemPrompt: body.systemPrompt,
        temperature: body.temperature ?? null,
        providerId: body.providerId ?? null,
        modelKey: body.modelKey ?? null,
        icon: body.icon || "sparkles",
      },
    });
    return ok({ agent: toAgentDTO(agent) }, 201);
  });
}
