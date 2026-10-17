import { loadPreset } from "./courses";
import { METERS_PER_MILE } from "./geo";
import { buildPaceModel } from "./pace";

/**
 * The one race Playlist Pacer supports for now: the 2026 NYC Marathon.
 * Sunday, November 1, 2026. Daylight saving ends at 2am that morning, so the race runs on EST.
 */
export const RACE = {
  id: "nyc-2026",
  name: "NYC Marathon",
  date: "2026-11-01",
  dateLabel: "Sunday, November 1, 2026",
  utcOffset: "-05:00",
  timeZone: "America/New_York",
  courseId: "nyc-marathon",
  distance: 42195,
  /** Approximate wave start times; runners should check their own confirmation. */
  waves: [
    { label: "Wave 1", time: "09:10" },
    { label: "Wave 2", time: "09:35" },
    { label: "Wave 3", time: "10:00" },
    { label: "Wave 4", time: "10:25" },
    { label: "Wave 5", time: "10:50" },
  ],
} as const;

export type MomentOwner = "runner" | "friend";

export interface Moment {
  id: string;
  /** Meters from the start where the song should begin. */
  d: number;
  label: string;
  /** Short line about why this spot matters. */
  note: string;
  owner: MomentOwner;
}

const mi = (m: number) => Math.round(m * METERS_PER_MILE);

/**
 * One song per moment. Moments are spaced at least ~1.3 km apart, so a song (~3.5 min, about
 * 0.8 km even at a 3-hour pace) finishes before the next moment begins.
 */
export const MOMENTS: Moment[] = [
  { id: "start", d: 0, label: "The start", note: "Verrazzano Bridge. Cannon fires, Sinatra plays, you begin.", owner: "runner" },
  { id: "brooklyn", d: mi(2.0), label: "Into Brooklyn", note: "Mile 2. Off the Verrazzano and into the first crowds.", owner: "friend" },
  { id: "5k", d: 5000, label: "5K · Bay Ridge", note: "Fourth Avenue, Brooklyn crowds three deep.", owner: "friend" },
  { id: "10k", d: 10000, label: "10K · Park Slope", note: "Still on Fourth Ave, settling into pace.", owner: "friend" },
  { id: "lafayette", d: mi(8.3), label: "Lafayette Avenue", note: "Mile 8. The drum lines and the loudest block in Brooklyn.", owner: "friend" },
  { id: "williamsburg", d: mi(11.2), label: "Williamsburg", note: "Mile 11. A quiet stretch where your own music carries you.", owner: "friend" },
  { id: "half", d: 21097.5, label: "Halfway · Pulaski Bridge", note: "13.1 miles. Into Queens.", owner: "runner" },
  { id: "queensboro", d: mi(15.0), label: "Queensboro Bridge", note: "Mile 15. No crowds, just footsteps. The song matters most here.", owner: "friend" },
  { id: "first-ave", d: mi(16.2), label: "First Avenue", note: "Mile 16. Coming off the bridge into a wall of sound.", owner: "friend" },
  { id: "30k", d: 30000, label: "30K · East Harlem", note: "Mile 18.6. Where the race starts to get real.", owner: "friend" },
  { id: "bronx", d: mi(20.0), label: "The Bronx", note: "Mile 20. The wall lives around here.", owner: "friend" },
  { id: "madison", d: mi(21.1), label: "Madison Avenue Bridge", note: "Mile 21. Back to Manhattan for the last time.", owner: "friend" },
  { id: "fifth-ave", d: mi(23.0), label: "Fifth Avenue hill", note: "Mile 23. The long, sneaky climb to the park.", owner: "friend" },
  { id: "central-park", d: mi(24.0), label: "Into Central Park", note: "Mile 24. Rolling hills on East Drive.", owner: "friend" },
  { id: "40k", d: 40000, label: "40K · East Drive", note: "Mile 24.9. Just over two kilometers left.", owner: "friend" },
  { id: "finish", d: 42195 - 800, label: "The final stretch", note: "Central Park South, Columbus Circle, and the last 800 meters to Tavern on the Green.", owner: "runner" },
];

export const RUNNER_MOMENTS = MOMENTS.filter((m) => m.owner === "runner");
export const FRIEND_MOMENTS = MOMENTS.filter((m) => m.owner === "friend");

export function momentById(id: string) {
  return MOMENTS.find((m) => m.id === id);
}

/** "09:10" on race day → absolute instant (EST). */
export function startInstant(hhmm: string) {
  return new Date(`${RACE.date}T${hhmm}:00${RACE.utcOffset}`);
}

let course: ReturnType<typeof loadPreset> | null = null;
export function raceCourse() {
  course ??= loadPreset(RACE.courseId);
  return course;
}

/** Seconds after the gun when the runner reaches each moment, hill-adjusted to their goal. */
export function momentOffsets(goalSec: number): Record<string, number> {
  const model = buildPaceModel(raceCourse(), { goalSec, strategy: "hills", negativeSplit: 0 });
  return Object.fromEntries(MOMENTS.map((m) => [m.id, model.timeAt(m.d)]));
}

export function fmtTimeOfDay(date: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: RACE.timeZone, hour: "numeric", minute: "2-digit" }).format(date);
}

/** Estimated clock time at each moment, e.g. { bronx: "12:13 PM" }. */
export function momentEtas(start: Date, goalSec: number): Record<string, string> {
  const offs = momentOffsets(goalSec);
  return Object.fromEntries(Object.entries(offs).map(([id, s]) => [id, fmtTimeOfDay(new Date(start.getTime() + s * 1000))]));
}

export const fmtMile = (d: number) => (d / METERS_PER_MILE).toFixed(1);
