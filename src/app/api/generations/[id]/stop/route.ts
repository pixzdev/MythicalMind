// Stop a single generation. Other generations are untouched — each run has
// its own AbortController in the runtime.

import { db } from "@/lib/db";
import { handle, ok, ApiError } from "@/lib/api-helpers";
import { generationManager } from "@/lib/runtime/server/generation-manager";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const result = generationManager.stop(id);
    if (!result.ok && result.status === "unknown") {
      // Not in the runtime — make sure the DB agrees it is terminal.
      const row = await db.generation.findUnique({ where: { id } });
      if (!row) throw new ApiError(404, "not_found", "Generation not found.");
      if (row.status === "streaming" || row.status === "queued") {
        await db.generation.update({
          where: { id },
          data: {
            status: "cancelled",
            endedAt: new Date(),
            error: JSON.stringify({
              code: "cancelled",
              message: "Generation was stopped.",
            }),
          },
        });
        return ok({ stopped: true, status: "cancelled" });
      }
      return ok({ stopped: false, status: row.status });
    }
    return ok({ stopped: result.ok, status: result.status });
  });
}
