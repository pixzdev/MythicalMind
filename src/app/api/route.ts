import { ok } from "@/lib/api-helpers";
import { generationManager } from "@/lib/runtime/server/generation-manager";

export async function GET() {
  return ok({
    ok: true,
    app: "MythicalMind",
    runtime: {
      active: generationManager.activeStates().length,
    },
  });
}
