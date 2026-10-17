import type { PaceModel } from "./pace";
import type { Landmark, PlanSettings, Segment, Track } from "./types";

export const PASTELS = ["#F7D3D8", "#9DB8FF", "#FFE08A", "#C3B5F7", "#8FE3C0", "#FFB38A", "#FF8FA3", "#FFFFFF"];

const HEAT: [number, [number, number, number]][] = [
  [90, [110, 132, 255]],
  [125, [195, 181, 247]],
  [150, [247, 211, 216]],
  [168, [255, 143, 163]],
  [185, [255, 92, 122]],
];

/** Slow songs read cool (periwinkle), fast songs read warm (pink -> coral). */
export function bpmColor(bpm?: number) {
  if (!bpm) return "#7C86C4";
  const b = Math.max(HEAT[0][0], Math.min(HEAT[HEAT.length - 1][0], bpm));
  let i = 0;
  while (i < HEAT.length - 2 && b > HEAT[i + 1][0]) i++;
  const [b0, c0] = HEAT[i];
  const [b1, c1] = HEAT[i + 1];
  const f = (b - b0) / (b1 - b0);
  const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Playlist-clock start time of every track, accounting for crossfade overlap. */
export function playStarts(tracks: Track[], crossfade: number) {
  const out: number[] = [];
  let t = 0;
  for (const tr of tracks) {
    out.push(t);
    t += Math.max(1, tr.durationSec - crossfade);
  }
  return out;
}

export function computeSegments(tracks: Track[], s: PlanSettings, model: PaceModel): Segment[] {
  const starts = playStarts(tracks, s.crossfadeSec);
  const goal = model.goal;
  return tracks.map((track, index) => {
    const playStart = starts[index];
    const playEnd = index + 1 < tracks.length ? starts[index + 1] : playStart + track.durationSec;
    const rs = playStart - s.startOffsetSec;
    const re = playEnd - s.startOffsetSec;
    const raceStart = Math.min(goal, Math.max(0, rs));
    const raceEnd = Math.min(goal, Math.max(0, re));
    const phase: Segment["phase"] = re <= 0 ? "corral" : rs >= goal ? "post" : "race";
    return {
      track,
      index,
      color: s.colorMode === "bpm" ? bpmColor(track.bpm) : PASTELS[index % PASTELS.length],
      playStart,
      playEnd,
      raceStart,
      raceEnd,
      startD: model.distAt(raceStart),
      endD: model.distAt(raceEnd),
      phase,
      partial: phase === "race" && re > goal,
    };
  });
}

export interface CloserReport {
  segment: Segment;
  targetTime: number;
  /** Positive = the closer drops too late. Seconds. */
  delta: number;
  status: "perfect" | "early" | "late" | "missing";
  bestIndex: number;
  bestDelta: number;
  suggestion?: CloserFix;
}

export interface CloserFix {
  text: string;
  /** Closer lands this many seconds off target after the fix. */
  after: number;
  apply(tracks: Track[]): Track[];
}

export function closerReport(
  tracks: Track[],
  segments: Segment[],
  s: PlanSettings,
  model: PaceModel,
): CloserReport | null {
  const idx = tracks.findIndex((t) => t.key === s.closerKey);
  if (idx < 0) return null;
  const seg = segments[idx];
  const targetD = Math.max(0, model.distance - s.closerTargetFromEnd);
  const targetTime = model.timeAt(targetD);
  const actual = seg.playStart - s.startOffsetSec;
  const delta = actual - targetTime;

  // Where in the list would the closer land closest to the target?
  const others = tracks.filter((_, i) => i !== idx);
  let bestIndex = idx;
  let bestDelta = delta;
  let t = 0;
  for (let i = 0; i <= others.length; i++) {
    const d = t - s.startOffsetSec - targetTime;
    if (Math.abs(d) < Math.abs(bestDelta)) {
      bestDelta = d;
      bestIndex = i;
    }
    if (i < others.length) t += Math.max(1, others[i].durationSec - s.crossfadeSec);
  }

  const suggestion = Math.abs(delta) > 10 ? bestFix(tracks, idx, delta, s.crossfadeSec) : undefined;

  return {
    segment: seg,
    targetTime,
    delta,
    status: Math.abs(delta) <= 10 ? "perfect" : delta > 0 ? "late" : "early",
    bestIndex,
    bestDelta,
    suggestion,
  };
}

/**
 * One-move fixes for a mistimed closer: cut a song before it, pull a song from after it,
 * or swap one across. Returns the move that lands closest, if it's a real improvement.
 */
function bestFix(tracks: Track[], closerIdx: number, delta: number, cf: number): CloserFix | undefined {
  const len = (t: Track) => Math.max(1, t.durationSec - cf);
  const bpmGap = (a?: number, b?: number) => (a && b ? Math.abs(a - b) : 40);
  const before = tracks.slice(0, closerIdx);
  const after = tracks.slice(closerIdx + 1);
  const closer = tracks[closerIdx];
  const prev = before.at(-1);
  // `cost` = how much the move scrambles your BPM ramp.
  const options: (CloserFix & { cost: number })[] = [];

  for (const x of before) {
    options.push({ text: `Cut “${x.title}”`, after: delta - len(x), cost: 0, apply: (ts) => ts.filter((t) => t.key !== x.key) });
  }
  for (const y of after) {
    options.push({
      text: `Play “${y.title}” before the closer`,
      after: delta + len(y),
      cost: bpmGap(y.bpm, prev?.bpm),
      apply: (ts) => {
        const rest = ts.filter((t) => t.key !== y.key);
        const k = rest.findIndex((t) => t.key === closer.key);
        return [...rest.slice(0, k), y, ...rest.slice(k)];
      },
    });
  }
  for (const x of before) {
    for (const y of after) {
      options.push({
        text: `Swap “${x.title}” ↔ “${y.title}”`,
        after: delta + len(y) - len(x),
        cost: bpmGap(x.bpm, y.bpm),
        apply: (ts) => ts.map((t) => (t.key === x.key ? y : t.key === y.key ? x : t)),
      });
    }
  }

  const better = options.filter((o) => Math.abs(o.after) < Math.abs(delta) - 5);
  const landed = better.filter((o) => Math.abs(o.after) <= 10);
  const pool = landed.length ? landed : better;
  pool.sort((a, b) => (landed.length ? a.cost - b.cost : Math.abs(a.after) - Math.abs(b.after)));
  return pool[0];
}

/** Moves track at `from` to position `to` (in the list without it). */
export function moveTrack(tracks: Track[], from: number, to: number) {
  const copy = tracks.slice();
  const [t] = copy.splice(from, 1);
  copy.splice(to, 0, t);
  return copy;
}

/** Slow -> fast. Unknown-BPM songs go first as warmup; the closer song is placed to land on target. */
export function autoRamp(tracks: Track[], s: PlanSettings, model: PaceModel) {
  const closer = tracks.find((t) => t.key === s.closerKey);
  const rest = tracks.filter((t) => t.key !== s.closerKey);
  const unknown = rest.filter((t) => !t.bpm);
  const known = rest.filter((t) => t.bpm).sort((a, b) => a.bpm! - b.bpm!);
  let out = [...unknown, ...known];
  if (closer) {
    out = [...out, closer];
    const segs = computeSegments(out, s, model);
    const rep = closerReport(out, segs, s, model);
    if (rep) out = moveTrack(out, out.length - 1, rep.bestIndex);
  }
  return out;
}

export function landmarkHits(landmarks: Landmark[], segments: Segment[]) {
  return landmarks.map((l) => ({
    landmark: l,
    segment: segments.find((s) => s.phase === "race" && l.d >= s.startD && l.d <= s.endD),
  }));
}

export function playlistStats(tracks: Track[], segments: Segment[], s: PlanSettings, model: PaceModel) {
  const last = segments[segments.length - 1];
  const totalPlay = last ? last.playEnd : 0;
  const raceCoverage = totalPlay - s.startOffsetSec;
  const race = segments.filter((x) => x.phase === "race");
  const bpms = race.map((x) => x.track.bpm).filter((b): b is number => !!b);
  const third = Math.max(1, Math.floor(bpms.length / 3));
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : undefined);
  return {
    totalPlay,
    /** Seconds of silence at the end of the race. */
    shortBy: Math.max(0, model.goal - raceCoverage),
    raceSongs: race.length,
    corralSongs: segments.filter((x) => x.phase === "corral").length,
    postSongs: segments.filter((x) => x.phase === "post").length,
    openingBpm: avg(bpms.slice(0, third)),
    closingBpm: avg(bpms.slice(-third)),
    bpmCoverage: tracks.length ? tracks.filter((t) => t.bpm).length / tracks.length : 0,
  };
}
