// SSE: live generation events. This is how the UI subscribes to (and
// re-subscribes to) a generation without owning it:
//
//   connect   → server replies with a `snapshot` of accumulated state
//             → then streams `text-delta` / `reasoning-delta` / `usage`
//             → finally `status` + `done` (terminal)
//
// The connection can be dropped at any time (navigation, refresh, sleep).
// Reconnecting replays the snapshot — the generation itself never depended
// on the connection.

import { generationManager } from "@/lib/runtime/server/generation-manager";
import type { RuntimeEvent } from "@/lib/types";
import { isTerminal } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

function encodeEvent(ev: RuntimeEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(ev)}\n\n`);
}

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const manager = generationManager;

  const live = manager.getLive(id);

  if (live && !isTerminal(live.status)) {
    // Active generation — live subscription.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let unsubscribe: (() => void) | null = null;
        let heartbeat: ReturnType<typeof setInterval> | null = null;

        const cleanup = () => {
          if (closed) return;
          closed = true;
          if (heartbeat) clearInterval(heartbeat);
          if (unsubscribe) unsubscribe();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };

        const send = (ev: RuntimeEvent) => {
          if (closed) return;
          try {
            controller.enqueue(encodeEvent(ev));
          } catch {
            closed = true;
          }
          if (ev.type === "done") {
            // brief delay lets the terminal event flush before close
            setTimeout(cleanup, 250);
          }
        };

        // replay current state, then follow live events
        send({ type: "snapshot", state: live });

        unsubscribe = manager.subscribe(id, send);
        if (unsubscribe === null) {
          // generation ended between getLive and subscribe — send final state
          const final = manager.getLive(id);
          if (final) {
            send({ type: "done", state: final });
          }
          setTimeout(cleanup, 250);
          return;
        }

        heartbeat = setInterval(() => {
          if (closed) return;
          try {
            controller.enqueue(new TextEncoder().encode(`: ping\n\n`));
          } catch {
            closed = true;
          }
        }, 15_000);

        req.signal.addEventListener("abort", cleanup);
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  }

  // Terminal (or unknown-to-runtime) generation — single snapshot + done.
  const state = live ?? (await manager.snapshot(id));
  if (!state) {
    return new Response(
      new TextEncoder().encode(
        `data: ${JSON.stringify({
          type: "status",
          status: "failed",
          error: {
            code: "unknown_generation",
            message: "This generation no longer exists.",
          },
        })}\n\ndata: ${JSON.stringify({
          type: "done",
          state: {
            id,
            status: "failed",
            text: "",
            conversationId: "",
            messageId: null,
            providerId: "",
            providerName: "",
            modelKey: "",
            reasoning: "",
            outputChars: 0,
            usage: null,
            error: {
              code: "unknown_generation",
              message: "This generation no longer exists.",
            },
            startedAt: new Date().toISOString(),
            endedAt: new Date().toISOString(),
            durationMs: 0,
            conversationTitle: null,
          },
        })}\n\n`
      ),
      { status: 200, headers: SSE_HEADERS }
    );
  }

  const terminalStream = new ReadableStream<Uint8Array>({
    start(controller) {
      try {
        controller.enqueue(encodeEvent({ type: "snapshot", state }));
        controller.enqueue(
          encodeEvent({
            type: "done",
            state: { ...state, text: state.text },
          })
        );
        controller.close();
      } catch {
        /* client gone */
      }
    },
  });

  return new Response(terminalStream, { headers: SSE_HEADERS });
}
