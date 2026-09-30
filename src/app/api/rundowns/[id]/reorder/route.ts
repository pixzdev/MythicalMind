// Reorder segments: receives the full ordered list of segment ids and
// rewrites sortOrder in a single transaction.

import { db } from "@/lib/db";
import { toRundownDetail } from "@/lib/dto";
import { handle, ok, parseBody, ApiError } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ReorderSchema = z.object({
  segmentIds: z.array(z.string()).min(1).max(60),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await parseBody(req, ReorderSchema);

    const rundown = await db.rundown.findUnique({
      where: { id },
      include: { segments: { select: { id: true } } },
    });
    if (!rundown) {
      throw new ApiError(404, "not_found", "Rundown tidak ditemukan.");
    }

    const known = new Set(rundown.segments.map((s) => s.id));
    const unknown = body.segmentIds.filter((sid) => !known.has(sid));
    if (unknown.length > 0) {
      throw new ApiError(400, "invalid_request", "Ada segmen yang bukan milik rundown ini.");
    }
    if (body.segmentIds.length !== rundown.segments.length) {
      throw new ApiError(400, "invalid_request", "Daftar urutan belum mencakup semua segmen.");
    }

    await db.$transaction(
      body.segmentIds.map((segmentId, index) =>
        db.segment.update({
          where: { id: segmentId },
          data: { sortOrder: index },
        })
      )
    );

    const updated = await db.rundown.findUnique({
      where: { id },
      include: { segments: { orderBy: { sortOrder: "asc" } } },
    });
    return ok({ rundown: toRundownDetail(updated!, updated!.segments) });
  });
}
