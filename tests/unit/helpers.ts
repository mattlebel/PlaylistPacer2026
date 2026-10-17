import { buildCourse, type RawPoint } from "@/lib/geo";
import { buildPaceModel } from "@/lib/pace";
import type { Course, PlanSettings, Track } from "@/lib/types";

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

export function settings(patch: Partial<PlanSettings> = {}): PlanSettings {
  return {
    goalSec: 3000,
    units: "mi",
    strategy: "even",
    negativeSplit: 0.04,
    crossfadeSec: 0,
    startOffsetSec: 0,
    closerKey: null,
    closerTargetFromEnd: 1000,
    colorMode: "bpm",
    ...patch,
  };
}

export function tracks(specs: (number | [number, number?, string?])[]): Track[] {
  return specs.map((s, i) => {
    const [durationSec, bpm, title] = Array.isArray(s) ? s : [s];
    return { key: `t${i}`, title: title ?? `Song ${i}`, artist: "Artist", durationSec, bpm };
  });
}

export function model(course: Course, s: PlanSettings) {
  return buildPaceModel(course, s);
}
