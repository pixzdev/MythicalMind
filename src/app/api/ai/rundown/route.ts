// AI rundown generation: asks the user's configured provider for a
// structured rundown (JSON), validates it, and returns it for review.
// Nothing is persisted here — the user reviews, edits, then creates.
//
// The response is an SSE stream of real pipeline phases (understanding →
// provider → streaming → parse → validate) followed by the final result,
// so the client can show live agent progress without inventing states.

import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-helpers";
import {
  generateRundownWithAI,
  AIRundownRequestSchema,
  type AIRundownPhase,
} from "@/lib/rundown/ai-rundown-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type StreamEvent =
  | { type: "phase"; phase: string; label: string; detail: string | null; at: number }
  | { type: "result"; rundown: unknown }
  | { type: "error"; code: string; message: string };

function sse(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: Request) {
  // Validate the body first; on failure answer as a normal JSON error so
  // existing error handling (and the API envelope contract) stays intact.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: { code: "invalid_json", message: "Body harus JSON valid." } },
      { status: 400 }
    );
  }
  const parsedBody = AIRundownRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    const first = parsedBody.error.issues[0];
    return Response.json(
      {
        ok: false,
        error: {
          code: "validation_error",
          message: `Input tidak valid: ${first?.path.join(".") || "-"} — ${first?.message ?? ""}`,
        },
      },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(sse(event)));
        } catch {
          /* client disconnected — generation continues, persistence unaffected */
        }
      };

      send({
        type: "phase",
        phase: "understanding",
        label: "Memahami kebutuhan...",
        detail: `${parsedBody.data.mode} · ${parsedBody.data.title}`,
        at: 0,
      });

      try {
        const result = await generateRundownWithAI(parsedBody.data, (ev: AIRundownPhase) => {
          send({ type: "phase", ...ev, detail: ev.detail ?? null });
        });
        send({ type: "result", rundown: result });
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
      } catch (err) {
        const apiErr =
          err instanceof ApiError
            ? err
            : new ApiError(500, "internal", "Terjadi kesalahan tak terduga.");
        send({ type: "error", code: apiErr.code, message: apiErr.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
