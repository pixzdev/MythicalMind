// Danger zone: delete all conversations (destructive, confirmed in UI)

import { db } from "@/lib/db";
import { handle, ok } from "@/lib/api-helpers";
import { generationManager } from "@/lib/runtime/server/generation-manager";

export const dynamic = "force-dynamic";

export async function DELETE() {
  return handle(async () => {
    // stop every active generation first
    for (const active of generationManager.activeStates()) {
      generationManager.stop(active.id);
    }
    const result = await db.conversation.deleteMany({});
    await db.activityEvent.create({
      data: {
        type: "workspace.cleared",
        level: "warn",
        title: `All conversations deleted (${result.count})`,
      },
    });
    return ok({ deleted: result.count });
  });
}
