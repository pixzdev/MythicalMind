// Conversations: list + create

import { db } from "@/lib/db";
import { toConversationSummary } from "@/lib/dto";
import { handle, ok, parseBody, ApiError } from "@/lib/api-helpers";
import { getSettings } from "@/lib/settings";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const includeArchived = url.searchParams.get("archived") === "1";
    const conversations = await db.conversation.findMany({
      where: includeArchived ? {} : { archived: false },
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        _count: { select: { messages: true } },
        messages: {
          orderBy: { sortOrder: "desc" },
          take: 1,
          select: { content: true, role: true },
        },
        generations: {
          where: { status: { in: ["queued", "streaming"] } },
          select: { id: true, status: true },
        },
      },
    });
    return ok({ conversations: conversations.map(toConversationSummary) });
  });
}

const CreateSchema = z.object({
  title: z.string().trim().max(120).optional(),
  agentId: z.string().optional().nullable(),
  systemPrompt: z.string().max(8000).optional().nullable(),
  providerId: z.string().optional().nullable(),
  modelKey: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = await parseBody(req, CreateSchema);

    let agentSystemPrompt: string | null = null;
    let agentProviderId: string | null = null;
    let agentModelKey: string | null = null;
    let agentId: string | null = null;

    if (body.agentId) {
      const agent = await db.agent.findUnique({ where: { id: body.agentId } });
      if (!agent) {
        throw new ApiError(404, "not_found", "Agent not found.");
      }
      agentId = agent.id;
      agentSystemPrompt = agent.systemPrompt;
      agentProviderId = agent.providerId;
      agentModelKey = agent.modelKey;
    }

    const settings = await getSettings();
    const providerId =
      body.providerId ??
      agentProviderId ??
      settings.generation.defaultProviderId;
    let modelKey =
      body.modelKey ?? agentModelKey ?? settings.generation.defaultModelKey;

    // resolve a sensible default model when only a provider is known
    if (providerId && !modelKey) {
      const provider = await db.provider.findUnique({
        where: { id: providerId },
        select: { defaultModel: true },
      });
      modelKey = provider?.defaultModel ?? null;
      if (!modelKey) {
        const firstModel = await db.model.findFirst({
          where: { providerId },
          orderBy: { createdAt: "asc" },
          select: { modelId: true },
        });
        modelKey = firstModel?.modelId ?? null;
      }
    }

    const conversation = await db.conversation.create({
      data: {
        title: body.title?.trim() || "New conversation",
        agentId,
        systemPrompt: body.systemPrompt ?? agentSystemPrompt,
        providerId,
        modelKey,
      },
      include: {
        _count: { select: { messages: true } },
        agent: { select: { name: true } },
        messages: true,
      },
    });

    return ok({ conversation: toConversationSummary(conversation) }, 201);
  });
}
