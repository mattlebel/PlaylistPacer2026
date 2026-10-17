import { buildCourse, type RawPoint } from "@/lib/geo";
import type { Course, PaceSettings } from "@/lib/types";

/** Meters per degree of latitude on the sphere geo.ts uses. */
export const M_PER_DEG = (2 * Math.PI * 6371008.8) / 360;

/** A straight north-running course of `meters`, optionally with elevation and timestamps. */
export function straightCourse(
  meters: number,
  opts: { n?: number; ele?: (f: number) => number; time?: (f: number) => number; official?: number } = {},
): Course {
  const n = opts.n ?? 200;
  const raw: RawPoint[] = Array.from({ length: n + 1 }, (_, i) => {
    const f = i / n;
    return { lat: 40 + (f * meters) / M_PER_DEG, lon: -74, ele: opts.ele?.(f), t: opts.time?.(f) };
  });
  return buildCourse({ id: "test", name: "Test Course", source: "gpx", raw, officialDistance: opts.official });
}

export function settings(patch: Partial<PaceSettings> = {}): PaceSettings {
  return { goalSec: 3000, strategy: "even", negativeSplit: 0.04, ...patch };
}
