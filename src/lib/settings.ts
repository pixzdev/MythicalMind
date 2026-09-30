// MythicalMind — workspace settings (server-side, persisted in Setting rows).

import { db } from "@/lib/db";
import {
  DEFAULT_SETTINGS,
  type WorkspaceSettings,
} from "@/lib/types";

const KEY = "workspace";

function mergeDeep<T>(base: T, patch: unknown): T {
  if (patch === null || patch === undefined) return base;
  if (typeof base !== "object" || base === null || Array.isArray(base)) {
    return patch as T;
  }
  if (typeof patch !== "object" || Array.isArray(patch)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    out[k] = k in out ? mergeDeep((base as Record<string, unknown>)[k], v) : v;
  }
  return out as T;
}

export async function getSettings(): Promise<WorkspaceSettings> {
  try {
    const row = await db.setting.findUnique({ where: { key: KEY } });
    if (!row) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(row.value);
    return mergeDeep(structuredClone(DEFAULT_SETTINGS), parsed);
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export async function saveSettings(
  patch: unknown
): Promise<WorkspaceSettings> {
  const current = await getSettings();
  const next = mergeDeep(current, patch);
  await db.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  return next;
}
