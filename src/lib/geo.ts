import type { Course, CoursePoint, CourseSource, Landmark } from "./types";

export const METERS_PER_MILE = 1609.344;

const R = 6371008.8;
const rad = (x: number) => (x * Math.PI) / 180;

export function haversine(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface RawPoint {
  lat: number;
  lon: number;
  ele?: number;
  /** seconds since start */
  t?: number;
}

/** Binary search: index i such that arr[i] <= x < arr[i+1]. */
export function bisect(arr: ArrayLike<number>, x: number) {
  let lo = 0;
  let hi = arr.length - 1;
  if (x <= arr[0]) return 0;
  if (x >= arr[hi]) return hi - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= x) lo = mid;
    else hi = mid;
  }
  return lo;
}

function lerp(a: number, b: number, f: number) {
  return a + (b - a) * f;
}

/**
 * Turn a raw GPS trace into evenly spaced points with smoothed elevation.
 * Spacing adapts so even an ultra stays under ~4000 points.
 */
export function buildCourse(opts: {
  id: string;
  name: string;
  source: CourseSource;
  raw: RawPoint[];
  officialDistance?: number;
  landmarks?: Landmark[];
  approximate?: boolean;
}): Course {
  const raw = opts.raw.filter((p, i, a) => i === 0 || p.lat !== a[i - 1].lat || p.lon !== a[i - 1].lon);
  if (raw.length < 2) throw new Error("That course has fewer than 2 GPS points.");

  const cum: number[] = [0];
  for (let i = 1; i < raw.length; i++) {
    cum.push(cum[i - 1] + haversine(raw[i - 1].lat, raw[i - 1].lon, raw[i].lat, raw[i].lon));
  }
  const measured = cum[cum.length - 1];
  const hasEle = raw.some((p) => p.ele !== undefined);
  const hasTimes = raw.every((p) => p.t !== undefined) && (raw[raw.length - 1].t ?? 0) > 0;

  const step = Math.max(10, measured / 4000);
  const n = Math.max(2, Math.round(measured / step) + 1);
  const pts: CoursePoint[] = [];
  for (let k = 0; k < n; k++) {
    const d = (measured * k) / (n - 1);
    const i = bisect(cum, d);
    const span = cum[i + 1] - cum[i] || 1;
    const f = Math.min(1, Math.max(0, (d - cum[i]) / span));
    const a = raw[i];
    const b = raw[i + 1];
    pts.push({
      lat: lerp(a.lat, b.lat, f),
      lon: lerp(a.lon, b.lon, f),
      ele: hasEle ? lerp(a.ele ?? 0, b.ele ?? 0, f) : 0,
      d,
      t: hasTimes ? lerp(a.t!, b.t!, f) : undefined,
    });
  }

  // Smooth elevation over ~120m so GPS jitter doesn't read as hills.
  if (hasEle) {
    const w = Math.max(1, Math.round(60 / step));
    const ele = pts.map((p) => p.ele);
    for (let k = 0; k < pts.length; k++) {
      let s = 0;
      let c = 0;
      for (let j = Math.max(0, k - w); j <= Math.min(pts.length - 1, k + w); j++) {
        s += ele[j];
        c++;
      }
      pts[k].ele = s / c;
    }
  }

  const official = opts.officialDistance && opts.officialDistance > 0 ? opts.officialDistance : measured;
  const scale = official / measured;
  for (const p of pts) p.d *= scale;

  return {
    id: opts.id,
    name: opts.name,
    source: opts.source,
    points: pts,
    distance: official,
    measuredDistance: measured,
    hasTimes,
    sourceTime: hasTimes ? pts[pts.length - 1].t : undefined,
    landmarks: (opts.landmarks ?? []).filter((l) => l.d <= official),
    approximate: opts.approximate,
  };
}

/** Re-scale a course to a new official distance (e.g. your watch said 26.51, the race is 26.2). */
export function rescaleCourse(course: Course, official: number): Course {
  const scale = official / course.distance;
  return {
    ...course,
    distance: official,
    points: course.points.map((p) => ({ ...p, d: p.d * scale })),
    landmarks: course.landmarks.map((l) => ({ ...l, d: l.d * scale })),
  };
}

const distCache = new WeakMap<Course, Float64Array>();
function distances(course: Course) {
  let ds = distCache.get(course);
  if (!ds) {
    ds = Float64Array.from(course.points.map((p) => p.d));
    distCache.set(course, ds);
  }
  return ds;
}

export function pointAt(course: Course, d: number): CoursePoint {
  const pts = course.points;
  const i = bisect(distances(course), d);
  const a = pts[i];
  const b = pts[i + 1] ?? a;
  const f = b.d === a.d ? 0 : Math.min(1, Math.max(0, (d - a.d) / (b.d - a.d)));
  return { lat: lerp(a.lat, b.lat, f), lon: lerp(a.lon, b.lon, f), ele: lerp(a.ele, b.ele, f), d };
}

/** Fast version for animation loops: caller passes the distances array once. */
export function makePointLookup(course: Course) {
  const ds = distances(course);
  return (d: number): [number, number] => {
    const pts = course.points;
    const i = bisect(ds, d);
    const a = pts[i];
    const b = pts[i + 1] ?? a;
    const f = b.d === a.d ? 0 : Math.min(1, Math.max(0, (d - a.d) / (b.d - a.d)));
    return [lerp(a.lon, b.lon, f), lerp(a.lat, b.lat, f)];
  };
}

export function sliceCoords(course: Course, fromD: number, toD: number): [number, number][] {
  const look = makePointLookup(course);
  const out: [number, number][] = [look(fromD)];
  for (const p of course.points) if (p.d > fromD && p.d < toD) out.push([p.lon, p.lat]);
  out.push(look(toD));
  return out;
}

export function bounds(course: Course): [[number, number], [number, number]] {
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  for (const p of course.points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  return [[minLon, minLat], [maxLon, maxLat]];
}

export function elevationGain(course: Course) {
  let gain = 0;
  const pts = course.points;
  for (let i = 1; i < pts.length; i++) gain += Math.max(0, pts[i].ele - pts[i - 1].ele);
  return gain;
}
