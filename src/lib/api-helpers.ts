// MythicalMind — API route helpers: unified error envelope + guards.

import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as unknown as Record<string, unknown>, {
    status,
  });
}

export function fail(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message } },
    { status }
  );
}

/** Wrap a route handler with the unified error envelope. */
export async function handle(
  fn: () => Promise<Response>
): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.status, err.code, err.message);
    }
    if (err instanceof ZodError) {
      return fail(
        400,
        "invalid_request",
        err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
      );
    }
    const message =
      err instanceof Error ? err.message : "Unexpected server error";
    // Never leak stack traces to clients.
    console.error("[api]", message);
    return fail(500, "internal", "Something went wrong on the server.");
  }
}

export async function parseBody<T>(
  req: Request,
  schema: ZodType<T>
): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body is not valid JSON.");
  }
  return schema.parse(raw);
}

export function requireString(v: string | undefined, field: string): string {
  if (!v || !v.trim()) {
    throw new ApiError(400, "invalid_request", `Field "${field}" is required.`);
  }
  return v.trim();
}
