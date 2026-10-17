import "server-only";
import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { AppError } from "./repo";

export function appOrigin(req: NextRequest) {
  const configured = process.env.APP_URL ?? process.env.RENDER_EXTERNAL_URL;
  return configured?.replace(/\/$/, "") ?? req.nextUrl.origin;
}

/** Turn thrown AppErrors into JSON responses; anything else is a 500. */
export async function handle(fn: () => Promise<unknown>) {
  try {
    const out = await fn();
    return NextResponse.json(out ?? { ok: true });
  } catch (e) {
    // Let Next.js's own control-flow signals (e.g. "render this per request") pass through.
    unstable_rethrow(e);
    if (e instanceof AppError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Something went wrong on our end. Try again in a moment." }, { status: 500 });
  }
}

const buckets = new Map<string, number[]>();

/** Tiny in-memory sliding-window limiter (single instance). */
export function rateLimit(req: NextRequest, bucket: string, max: number, windowMs: number) {
  if (process.env.RATE_LIMITS === "off") return;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) throw new AppError("limit", "Slow down a little and try again in a minute.", 429);
  hits.push(now);
  buckets.set(key, hits);
}

export async function readJson(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    throw new AppError("invalid", "Expected a JSON body.");
  }
}
