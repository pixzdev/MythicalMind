// Segment: patch fields / delete one segment.

import { db } from "@/lib/db";
import { toRundownDetail } from "@/lib/dto";
import { handle, ok, parseBody, ApiError } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  durationMinutes: z.number().int().min(1).max(600).optional(),
  description: z.string().trim().max(600).nullish(),
  pic: z.string().trim().max(80).nullish(),
  notes: z.string().trim().max(600).nullish(),
  materials: z.string().trim().max(400).nullish(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await parseBody(req, PatchSchema);

    const segment = await db.segment.findUnique({
      where: { id },
      select: { rundownId: true },
    });
    if (!segment) {
      throw new ApiError(404, "not_found", "Segmen tidak ditemukan.");
    }

    await db.segment.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.durationMinutes !== undefined ? { durationMinutes: body.durationMinutes } : {}),
        ...(body.description !== undefined ? { description: body.description ?? null } : {}),
        ...(body.pic !== undefined ? { pic: body.pic ?? null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes ?? null } : {}),
        ...(body.materials !== undefined ? { materials: body.materials ?? null } : {}),
      },
    });

    const rundown = await db.rundown.findUnique({
      where: { id: segment.rundownId },
      include: { segments: { orderBy: { sortOrder: "asc" } } },
    });
    return ok({ rundown: toRundownDetail(rundown!, rundown!.segments) });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const segment = await db.segment.findUnique({
      where: { id },
      select: { rundownId: true },
    });
    if (!segment) {
      throw new ApiError(404, "not_found", "Segmen tidak ditemukan.");
    }

    await db.segment.delete({ where: { id } });

    // compact the remaining order so gaps never accumulate
    const remaining = await db.segment.findMany({
      where: { rundownId: segment.rundownId },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    await db.$transaction(
      remaining.map((s, index) =>
        db.segment.update({ where: { id: s.id }, data: { sortOrder: index } })
      )
    );

    const rundown = await db.rundown.findUnique({
      where: { id: segment.rundownId },
      include: { segments: { orderBy: { sortOrder: "asc" } } },
    });
    return ok({ rundown: toRundownDetail(rundown!, rundown!.segments) });
  });
}
