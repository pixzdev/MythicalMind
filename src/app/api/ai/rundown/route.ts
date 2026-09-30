// AI rundown generation: asks the user's configured provider for a
// structured rundown (JSON), validates it, and returns it for review.
// Nothing is persisted here — the user reviews, edits, then creates.

import { db } from "@/lib/db";
import { handle, ok, parseBody } from "@/lib/api-helpers";
import {
  generateRundownWithAI,
  AIRundownRequestSchema,
} from "@/lib/rundown/ai-rundown-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  return handle(async () => {
    const body = await parseBody(req, AIRundownRequestSchema);
    const result = await generateRundownWithAI(body);
    try {
      await db.activityEvent.create({
        data: {
          type: "rundown.ai_generated",
          level: "success",
          title: `Rundown disusun AI — ${result.title}`,
          detail: `${result.segments.length} segmen · ${result.providerName} · ${result.modelKey}`,
        },
      });
    } catch {
      /* activity logging must never break the request */
    }
    return ok({ rundown: result });
  });
}
