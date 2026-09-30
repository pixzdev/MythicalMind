// Rundown detail: fetch, patch meta, delete.

import { db } from "@/lib/db";
import { toRundownDetail } from "@/lib/dto";
import { handle, ok, parseBody, ApiError } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  category: z.enum(["acara", "harian", "studi", "kerja"]).optional(),
  eventType: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(1000).nullish(),
  eventDate: z.string().datetime().nullable().optional(),
  venue: z.string().trim().max(160).nullish(),
  organizer: z.string().trim().max(160).nullish(),
  startTime: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/)
    .optional(),
  status: z.enum(["draft", "final"]).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const rundown = await db.rundown.findUnique({
      where: { id },
      include: { segments: { orderBy: { sortOrder: "asc" } } },
    });
    if (!rundown) {
      throw new ApiError(404, "not_found", "Rundown tidak ditemukan.");
    }
    return ok({ rundown: toRundownDetail(rundown, rundown.segments) });
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await parseBody(req, PatchSchema);

    const existing = await db.rundown.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "not_found", "Rundown tidak ditemukan.");
    }

    const rundown = await db.rundown.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.eventType !== undefined ? { eventType: body.eventType } : {}),
        ...(body.description !== undefined ? { description: body.description ?? null } : {}),
        ...(body.eventDate !== undefined
          ? { eventDate: body.eventDate ? new Date(body.eventDate) : null }
          : {}),
        ...(body.venue !== undefined ? { venue: body.venue ?? null } : {}),
        ...(body.organizer !== undefined ? { organizer: body.organizer ?? null } : {}),
        ...(body.startTime !== undefined ? { startTime: body.startTime } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
      include: { segments: { orderBy: { sortOrder: "asc" } } },
    });
    return ok({ rundown: toRundownDetail(rundown, rundown.segments) });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const existing = await db.rundown.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      throw new ApiError(404, "not_found", "Rundown tidak ditemukan.");
    }
    await db.rundown.delete({ where: { id } });
    return ok({ deleted: true });
  });
}
