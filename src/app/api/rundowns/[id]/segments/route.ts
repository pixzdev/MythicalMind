// Add a segment to a rundown (appended at the end).

import { db } from "@/lib/db";
import { toRundownDetail } from "@/lib/dto";
import { handle, ok, parseBody, ApiError } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  durationMinutes: z.number().int().min(1).max(600).default(15),
  description: z.string().trim().max(600).nullish(),
  pic: z.string().trim().max(80).nullish(),
  notes: z.string().trim().max(600).nullish(),
  materials: z.string().trim().max(400).nullish(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await parseBody(req, CreateSchema);

    const rundown = await db.rundown.findUnique({ where: { id }, select: { id: true } });
    if (!rundown) {
      throw new ApiError(404, "not_found", "Rundown tidak ditemukan.");
    }

    const last = await db.segment.findFirst({
      where: { rundownId: id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    await db.segment.create({
      data: {
        rundownId: id,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        title: body.title,
        durationMinutes: body.durationMinutes,
        description: body.description ?? null,
        pic: body.pic ?? null,
        notes: body.notes ?? null,
        materials: body.materials ?? null,
      },
    });

    const updated = await db.rundown.findUnique({
      where: { id },
      include: { segments: { orderBy: { sortOrder: "asc" } } },
    });
    return ok({ rundown: toRundownDetail(updated!, updated!.segments) }, 201);
  });
}
