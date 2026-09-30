// Regenerate / Retry / Continue — the contextual quick actions.
//
//  regenerate: drop trailing assistant messages after the last user message,
//              create a fresh assistant message, re-run from history.
//  retry:      reuse the failed assistant message (reset), re-run.
//  continue:   reuse the last assistant message and KEEP its content,
//              asking the model to continue exactly where it stopped.

import { db } from "@/lib/db";
import { handle, ok, parseBody, ApiError } from "@/lib/api-helpers";
import {
  buildHistory,
  historyToRequestMessages,
  resolveTarget,
  startGenerationRun,
} from "@/lib/runtime/server/conversation-service";
import { generationManager } from "@/lib/runtime/server/generation-manager";
import type { ChatMessage } from "@/lib/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const GenerateSchema = z.object({
  mode: z.enum(["regenerate", "retry", "continue"]),
  messageId: z.string().optional(),
  providerId: z.string().optional().nullable(),
  modelKey: z.string().optional().nullable(),
  temperature: z.number().min(0).max(2).optional().nullable(),
  maxTokens: z.number().int().positive().max(1_000_000).optional().nullable(),
});

const CONTINUE_INSTRUCTION =
  "Continue your previous answer exactly where it stopped. Do not repeat any content you already produced.";

export async function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await parseBody(req, GenerateSchema);

    const conversation = await db.conversation.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!conversation) throw new ApiError(404, "not_found", "Conversation not found.");

    const messages = await db.message.findMany({
      where: { conversationId: id },
      orderBy: { sortOrder: "asc" },
    });
    if (messages.length === 0) {
      throw new ApiError(400, "empty_conversation", "Nothing to generate from yet — send a message first.");
    }

    // Stop any currently running generation for this conversation so the new
    // run owns the output (regenerate/continue are explicit user intents).
    for (const active of generationManager.activeStates()) {
      if (active.conversationId === id) generationManager.stop(active.id);
    }

    const target = await resolveTarget(id, body);
    const { system, messages: history } = await buildHistory(id);

    if (body.mode === "continue") {
      // Find the trailing assistant message with content to continue.
      let targetMessage = body.messageId
        ? messages.find((m) => m.id === body.messageId)
        : null;
      if (!targetMessage) {
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === "assistant" && messages[i].content.trim()) {
            targetMessage = messages[i];
            break;
          }
        }
      }
      if (!targetMessage || targetMessage.role !== "assistant" || !targetMessage.content.trim()) {
        throw new ApiError(400, "nothing_to_continue", "There is no assistant response to continue.");
      }

      const requestMessages = historyToRequestMessages(system, [
        ...history,
        { role: "user", content: CONTINUE_INSTRUCTION },
      ]);

      const result = await startGenerationRun({
        conversationId: id,
        target,
        requestMessages,
        reuseMessage: targetMessage,
        newAssistant: {
          initialText: targetMessage.content,
          initialReasoning: targetMessage.reasoning ?? undefined,
        },
        temperature: body.temperature ?? null,
        maxTokens: body.maxTokens ?? null,
      });
      return ok(result, 201);
    }

    if (body.mode === "retry") {
      // Retry a failed/interrupted assistant message: reset it, re-run.
      let targetMessage = body.messageId
        ? messages.find((m) => m.id === body.messageId)
        : null;
      if (targetMessage && targetMessage.role !== "assistant") targetMessage = null;
      if (!targetMessage) {
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === "assistant") {
            targetMessage = messages[i];
            break;
          }
        }
      }
      if (!targetMessage) {
        throw new ApiError(400, "nothing_to_retry", "No assistant response to retry.");
      }

      // history up to (not including) the retried message
      const upto: ChatMessage[] = [];
      for (const m of messages) {
        if (m.id === targetMessage.id) break;
        if (m.role === "user" && m.content.trim()) upto.push({ role: "user", content: m.content });
        else if (m.role === "assistant" && m.status === "completed" && m.content.trim()) {
          upto.push({ role: "assistant", content: m.content });
        }
      }
      const requestMessages = historyToRequestMessages(system, upto);

      const result = await startGenerationRun({
        conversationId: id,
        target,
        requestMessages,
        reuseMessage: targetMessage,
        newAssistant: { initialText: "", initialReasoning: "" },
        temperature: body.temperature ?? null,
        maxTokens: body.maxTokens ?? null,
      });
      return ok(result, 201);
    }

    // mode === "regenerate"
    // Remove trailing assistant messages after the last user message.
    const lastUserIdx = findLastIndex(messages, (m) => m.role === "user");
    const toDelete = messages.filter(
      (m, i) => i > lastUserIdx && m.role === "assistant"
    );
    if (lastUserIdx === -1) {
      throw new ApiError(400, "nothing_to_regenerate", "Send a message first.");
    }

    const upto: ChatMessage[] = [];
    for (const m of messages.slice(0, lastUserIdx + 1)) {
      if (m.role === "user" && m.content.trim()) upto.push({ role: "user", content: m.content });
      else if (m.role === "assistant" && m.status === "completed" && m.content.trim()) {
        upto.push({ role: "assistant", content: m.content });
      }
    }
    const requestMessages = historyToRequestMessages(system, upto);

    if (toDelete.length > 0) {
      await db.message.deleteMany({ where: { id: { in: toDelete.map((m) => m.id) } } });
    }

    const result = await startGenerationRun({
      conversationId: id,
      target,
      requestMessages,
      temperature: body.temperature ?? null,
      maxTokens: body.maxTokens ?? null,
    });
    return ok(result, 201);
  });
}

function findLastIndex<T>(arr: T[], pred: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i;
  }
  return -1;
}
