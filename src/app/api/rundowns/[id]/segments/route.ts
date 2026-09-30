// Segment collection routes: POST appends a segment, PUT atomically replaces
// the whole segment list (used when applying an AI replan).

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

const ReplaceSchema = z.object({
  segments: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(160),
        durationMinutes: z.number().int().min(1).max(600),
        description: z.string().trim().max(600).nullish(),
        pic: z.string().trim().max(80).nullish(),
        notes: z.string().trim().max(600).nullish(),
        materials: z.string().trim().max(400).nullish(),
      })
    )
    .min(1)
    .max(60),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await parseBody(req, ReplaceSchema);

    const rundown = await db.rundown.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!rundown) {
      throw new ApiError(404, "not_found", "Rundown tidak ditemukan.");
    }

    // Atomic replace: delete + recreate with compact sortOrder in one
    // transaction, so a failure can never leave a half-applied schedule.
    await db.$transaction(async (tx) => {
      await tx.segment.deleteMany({ where: { rundownId: id } });
      await tx.segment.createMany({
        data: body.segments.map((s, i) => ({
          rundownId: id,
          sortOrder: i,
          title: s.title,
          durationMinutes: s.durationMinutes,
          description: s.description ?? null,
          pic: s.pic ?? null,
          notes: s.notes ?? null,
          materials: s.materials ?? null,
        })),
      });
    });

    try {
      await db.activityEvent.create({
        data: {
          type: "rundown.replanned",
          level: "success",
          title: `Jadwal diperbarui — ${rundown.title}`,
          detail: `${body.segments.length} segmen diterapkan dari hasil AI`,
        },
      });
    } catch {
      /* activity logging must never break the request */
    }

    const updated = await db.rundown.findUnique({
      where: { id },
      include: { segments: { orderBy: { sortOrder: "asc" } } },
    });
    return ok({ rundown: toRundownDetail(updated!, updated!.segments) });
  });
}

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
