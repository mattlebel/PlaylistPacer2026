export type Units = "mi" | "km";

/** One resampled point along a course. `d` is cumulative meters from the start. */
export interface CoursePoint {
  lat: number;
  lon: number;
  ele: number;
  d: number;
  /** Seconds since start, only when the source had timestamps (Strava activity / GPX with <time>). */
  t?: number;
}

export interface Landmark {
  /** Distance from start, meters. */
  d: number;
  name: string;
  emoji: string;
  vibe: string;
}

export type CourseSource = "preset" | "gpx" | "strava-activity" | "strava-route";

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

export interface Track {
  key: string;
  title: string;
  artist: string;
  durationSec: number;
  spotifyId?: string;
  uri?: string;
  art?: string;
  bpm?: number;
}

export type PaceStrategy = "even" | "negative" | "hills" | "ghost";

export interface PlanSettings {
  goalSec: number;
  units: Units;
  strategy: PaceStrategy;
  /** Fraction, e.g. 0.03 = second half 3% faster than first. */
  negativeSplit: number;
  /** Seconds of Spotify crossfade between songs. */
  crossfadeSec: number;
  /** Seconds between pressing play and crossing the start mat. */
  startOffsetSec: number;
  /** key of the track locked as the finisher. */
  closerKey: string | null;
  /** Meters before the finish where the closer song should start. */
  closerTargetFromEnd: number;
  colorMode: "bpm" | "rainbow";
}

export interface Segment {
  track: Track;
  index: number;
  color: string;
  /** Playlist clock seconds. */
  playStart: number;
  playEnd: number;
  /** Race clock seconds, clamped to [0, goal]. */
  raceStart: number;
  raceEnd: number;
  /** Meters. */
  startD: number;
  endD: number;
  phase: "corral" | "race" | "post";
  /** True when the race finishes mid-song. */
  partial: boolean;
}
