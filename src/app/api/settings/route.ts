// Workspace settings

import { handle, ok, parseBody } from "@/lib/api-helpers";
import { getSettings, saveSettings } from "@/lib/settings";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const settings = await getSettings();
    return ok({ settings });
  });
}

const SettingsSchema = z.object({
  appearance: z
    .object({
      accent: z.enum(["violet", "cyan", "teal", "magenta"]).optional(),
      atmosphere: z.enum(["subtle", "medium", "off"]).optional(),
    })
    .optional(),
  generation: z
    .object({
      temperature: z.number().min(0).max(2).nullable().optional(),
      maxTokens: z.number().int().positive().max(1_000_000).nullable().optional(),
      timeoutMs: z.number().int().min(30_000).max(3_600_000).optional(),
      defaultProviderId: z.string().nullable().optional(),
      defaultModelKey: z.string().nullable().optional(),
    })
    .optional(),
});

export async function PUT(req: Request) {
  return handle(async () => {
    const patch = await parseBody(req, SettingsSchema);
    const settings = await saveSettings(patch);
    return ok({ settings });
  });
}
