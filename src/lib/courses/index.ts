import { buildCourse } from "../geo";
import type { Course } from "../types";
import nycMarathon from "./nyc-marathon.json";

/**
 * Course geometry from a real GPS track of the race, imported with scripts/import-course.mjs
 * (positions and elevation only). Distances are scaled to the certified length.
 */
interface CourseFile {
  name: string;
  measuredMeters: number;
  /** [lat, lon, ele] every ~25 m */
  points: [number, number, number][];
}

const PRESETS: Record<string, { name: string; official: number; file: CourseFile }> = {
  "nyc-marathon": { name: "NYC Marathon", official: 42195, file: nycMarathon as CourseFile },
};

const cache = new Map<string, Course>();

export function loadPreset(id: string): Course {
  const hit = cache.get(id);
  if (hit) return hit;
  const p = PRESETS[id];
  if (!p) throw new Error(`Unknown course ${id}`);
  const course = buildCourse({
    id,
    name: p.name,
    source: "preset",
    raw: p.file.points.map(([lat, lon, ele]) => ({ lat, lon, ele })),
    officialDistance: p.official,
  });
  cache.set(id, course);
  return course;
}
