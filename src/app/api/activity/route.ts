// Activity: user-facing runtime overview (real events only — written by the
// generation runtime and provider operations)

import { db } from "@/lib/db";
import { toActivityDTO } from "@/lib/dto";
import { handle, ok } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const limit = Math.min(
      Number(url.searchParams.get("limit") ?? 100) || 100,
      300
    );
    const events = await db.activityEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return ok({ events: events.map(toActivityDTO) });
  });
}
