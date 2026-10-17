export type Units = "mi" | "km";

/** One resampled point along a course. `d` is cumulative meters from the start. */
export interface CoursePoint {
  lat: number;
  lon: number;
  ele: number;
  d: number;
  /** Seconds since start, only when the source had timestamps. */
  t?: number;
}

export interface Landmark {
  /** Distance from start, meters. */
  d: number;
  name: string;
  emoji: string;
  vibe: string;
}

export type CourseSource = "preset" | "gpx";

export interface Course {
  id: string;
  name: string;
  source: CourseSource;
  points: CoursePoint[];
  /** Total distance in meters, after any official-distance scaling. */
  distance: number;
  /** Distance the raw GPS track measured, before scaling. */
  measuredDistance: number;
  hasTimes: boolean;
  landmarks: Landmark[];
  approximate?: boolean;
  /** Original finish time in seconds, when the source had timestamps. */
  sourceTime?: number;
}

export type PaceStrategy = "even" | "negative" | "hills" | "ghost";

export interface PaceSettings {
  goalSec: number;
  strategy: PaceStrategy;
  /** Fraction, e.g. 0.03 = second half 3% faster than first. */
  negativeSplit: number;
}

/** A song as stored on a plant. `spotifyId` is absent for hand-typed songs. */
export interface Song {
  title: string;
  artist: string;
  spotifyId?: string;
  uri?: string;
  art?: string;
  durationSec?: number;
}
