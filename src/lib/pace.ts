import { bisect } from "./geo";
import type { Course, PlanSettings } from "./types";

export interface PaceModel {
  goal: number;
  distance: number;
  /** Race clock seconds at distance d (meters). */
  timeAt(d: number): number;
  /** Distance in meters at race clock t (seconds). */
  distAt(t: number): number;
}

/** Grade-adjusted effort multiplier. Roughly +3.3% per 1% uphill, -1.8% per 1% downhill. */
function hillCost(grade: number) {
  const g = Math.max(-0.12, Math.min(0.12, grade));
  return g >= 0 ? 1 + 3.3 * g : Math.max(0.9, 1 + 1.8 * g);
}

export function buildPaceModel(course: Course, s: PlanSettings): PaceModel {
  const pts = course.points;
  const n = pts.length;
  const D = course.distance;
  const goal = Math.max(60, s.goalSec);
  const ds = Float64Array.from(pts.map((p) => p.d));
  const times = new Float64Array(n);

  if (s.strategy === "ghost" && course.hasTimes) {
    // Replay how you actually ran it, stretched to the new goal.
    let max = 0;
    const raw = pts.map((p) => (max = Math.max(max, p.t ?? 0)));
    const T = raw[n - 1] || 1;
    for (let i = 0; i < n; i++) times[i] = (raw[i] / T) * goal;
  } else {
    let c = 0;
    times[0] = 0;
    for (let i = 1; i < n; i++) {
      const L = pts[i].d - pts[i - 1].d;
      const x = (pts[i].d + pts[i - 1].d) / 2 / D;
      let w = 1;
      if (s.strategy === "negative") w *= 1 + s.negativeSplit * (1 - 2 * x);
      if (s.strategy === "hills") w *= hillCost(L > 0 ? (pts[i].ele - pts[i - 1].ele) / L : 0);
      c += L * w;
      times[i] = c;
    }
    for (let i = 0; i < n; i++) times[i] = (times[i] / c) * goal;
  }

  const interp = (xs: Float64Array, ys: Float64Array, x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    const i = bisect(xs, x);
    const span = xs[i + 1] - xs[i];
    return span ? ys[i] + ((ys[i + 1] - ys[i]) * (x - xs[i])) / span : ys[i];
  };

  return {
    goal,
    distance: D,
    timeAt: (d) => interp(ds, times, d),
    distAt: (t) => interp(times, ds, t),
  };
}
