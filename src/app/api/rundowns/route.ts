// Rundowns: list + create (manual payload, from template, from AI result,
// or duplicate an existing rundown).

import { db } from "@/lib/db";
import { toRundownDetail, toRundownSummary } from "@/lib/dto";
import { handle, ok, parseBody, ApiError } from "@/lib/api-helpers";
import { getTemplate } from "@/lib/rundown/templates";
import { z } from "zod";

async function logActivity(
  type: string,
  level: "info" | "success" | "warn" | "error",
  title: string,
  detail?: string
) {
  try {
    await db.activityEvent.create({
      data: { type, level, title, detail: detail ?? null },
    });
  } catch {
    /* activity logging must never break the request */
  }
}

export const dynamic = "force-dynamic";

const SegmentInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  durationMinutes: z.number().int().min(1).max(600),
  description: z.string().trim().max(600).nullish(),
  pic: z.string().trim().max(80).nullish(),
  notes: z.string().trim().max(600).nullish(),
  materials: z.string().trim().max(400).nullish(),
});

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.enum(["acara", "harian", "studi", "kerja"]).default("acara"),
  eventType: z.string().trim().min(1).max(60).default("custom"),
  description: z.string().trim().max(1000).nullish(),
  eventDate: z.string().datetime().nullish(),
  venue: z.string().trim().max(160).nullish(),
  organizer: z.string().trim().max(160).nullish(),
  startTime: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/)
    .default("08:00"),
  status: z.enum(["draft", "final"]).default("draft"),
  source: z.enum(["manual", "template", "ai"]).default("manual"),
  segments: z.array(SegmentInputSchema).max(60).default([]),
  templateId: z.string().max(60).nullish(),
  duplicateOf: z.string().nullish(),
});

export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const rundownRows = await db.rundown.findMany({
      where: category ? { category } : {},
      orderBy: { updatedAt: "desc" },
      take: 300,
      include: { segments: { select: { durationMinutes: true } } },
    });
    const rundowns = rundownRows.map((r) =>
      toRundownSummary(r, {
        segmentCount: r.segments.length,
        totalMinutes: r.segments.reduce((s, x) => s + x.durationMinutes, 0),
      })
    );
    return ok({ rundowns });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = await parseBody(req, CreateSchema);

    // --- duplicate an existing rundown -------------------------------------
    if (body.duplicateOf) {
      const source = await db.rundown.findUnique({
        where: { id: body.duplicateOf },
        include: { segments: { orderBy: { sortOrder: "asc" } } },
      });
      if (!source) {
        throw new ApiError(404, "not_found", "Rundown asal tidak ditemukan.");
      }
      const created = await db.rundown.create({
        data: {
          title: `${source.title} (salinan)`,
          category: source.category,
          eventType: source.eventType,
          description: source.description,
          eventDate: source.eventDate,
          venue: source.venue,
          organizer: source.organizer,
          startTime: source.startTime,
          status: "draft",
          source: source.source,
          segments: {
            create: source.segments.map((s, i) => ({
              sortOrder: i,
              durationMinutes: s.durationMinutes,
              title: s.title,
              description: s.description,
              pic: s.pic,
              notes: s.notes,
              materials: s.materials,
            })),
          },
        },
        include: { segments: true },
      });
      return ok({ rundown: toRundownDetail(created, created.segments) }, 201);
    }

    // --- instantiate a built-in template ------------------------------------
    let segments = body.segments;
    let title = body.title;
    let startTime = body.startTime;
    let eventType = body.eventType;
    let source = body.source;

    if (body.templateId) {
      const template = getTemplate(body.templateId);
      if (!template) {
        throw new ApiError(404, "template_not_found", "Template tidak ditemukan.");
      }
      segments = template.segments;
      startTime = body.startTime !== "08:00" ? body.startTime : template.defaultStartTime;
      eventType = template.eventType;
      source = "template";
      if (title === "Rundown tanpa judul") {
        title = template.name;
      }
    }

    const rundown = await db.rundown.create({
      data: {
        title,
        category: body.category,
        eventType,
        description: body.description ?? null,
        eventDate: body.eventDate ? new Date(body.eventDate) : null,
        venue: body.venue ?? null,
        organizer: body.organizer ?? null,
        startTime,
        status: body.status,
        source,
        segments: {
          create: segments.map((s, i) => ({
            sortOrder: i,
            durationMinutes: s.durationMinutes,
            title: s.title,
            description: s.description ?? null,
            pic: s.pic ?? null,
            notes: s.notes ?? null,
            materials: s.materials ?? null,
          })),
        },
      },
      include: { segments: true },
    });

    const totalMinutes = segments.reduce((sum, s) => sum + s.durationMinutes, 0);
    await logActivity(
      "rundown.created",
      "success",
      `Rundown dibuat — ${title}`,
      `${segments.length} segmen · ${totalMinutes} menit · sumber: ${source}`
    );

    return ok({ rundown: toRundownDetail(rundown, rundown.segments) }, 201);
  });
}
