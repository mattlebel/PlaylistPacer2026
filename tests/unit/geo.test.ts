import { describe, expect, it } from "vitest";
import { bisect, bounds, buildCourse, elevationGain, haversine, makePointLookup, pointAt, rescaleCourse, sliceCoords } from "@/lib/geo";
import { M_PER_DEG, straightCourse } from "./helpers";

describe("haversine", () => {
  it("measures one degree of latitude", () => {
    expect(haversine(40, -74, 41, -74)).toBeCloseTo(M_PER_DEG, 0);
  });
  it("is zero for the same point", () => {
    expect(haversine(40.7, -74, 40.7, -74)).toBe(0);
  });
});

describe("bisect", () => {
  const arr = [0, 10, 20, 30];
  it("finds the bracketing index", () => {
    expect(bisect(arr, 15)).toBe(1);
    expect(bisect(arr, 20)).toBe(2);
  });
  it("clamps at the ends", () => {
    expect(bisect(arr, -5)).toBe(0);
    expect(bisect(arr, 99)).toBe(2);
  });
});

describe("buildCourse", () => {
  it("resamples evenly and keeps the measured distance", () => {
    const c = straightCourse(10000);
    expect(c.measuredDistance).toBeCloseTo(10000, -1);
    expect(c.distance).toBeCloseTo(10000, -1);
    expect(c.points[0].d).toBe(0);
    expect(c.points.at(-1)!.d).toBeCloseTo(c.distance, 6);
    const gaps = c.points.slice(1).map((p, i) => p.d - c.points[i].d);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.01);
  });

  it("scales to an official distance", () => {
    const c = straightCourse(43000, { official: 42195 });
    expect(c.distance).toBe(42195);
    expect(c.measuredDistance).toBeCloseTo(43000, -1);
    expect(c.points.at(-1)!.d).toBeCloseTo(42195, 6);
  });

  it("caps very long courses at roughly 4000 points", () => {
    const c = straightCourse(160000, { n: 50 });
    expect(c.points.length).toBeLessThanOrEqual(4002);
  });

  it("detects timestamps only when every point has one", () => {
    expect(straightCourse(5000, { time: (f) => f * 1500 }).hasTimes).toBe(true);
    expect(straightCourse(5000, { time: (f) => f * 1500 }).sourceTime).toBeCloseTo(1500);
    expect(straightCourse(5000).hasTimes).toBe(false);
  });

  it("drops repeated GPS points and rejects courses with fewer than two", () => {
    const raw = [
      { lat: 40, lon: -74 },
      { lat: 40, lon: -74 },
      { lat: 40.01, lon: -74 },
    ];
    expect(buildCourse({ id: "x", name: "x", source: "gpx", raw }).distance).toBeGreaterThan(1000);
    expect(() => buildCourse({ id: "x", name: "x", source: "gpx", raw: [raw[0], raw[1]] })).toThrow(/fewer than 2/);
  });

  it("filters landmarks beyond the finish", () => {
    const raw = [
      { lat: 40, lon: -74 },
      { lat: 40 + 5000 / M_PER_DEG, lon: -74 },
    ];
    const c = buildCourse({
      id: "x",
      name: "x",
      source: "preset",
      raw,
      landmarks: [
        { d: 100, name: "in", emoji: "", vibe: "" },
        { d: 9000, name: "out", emoji: "", vibe: "" },
      ],
    });
    expect(c.landmarks.map((l) => l.name)).toEqual(["in"]);
  });

  it("smooths GPS elevation jitter", () => {
    const c = straightCourse(2000, { n: 400, ele: (f) => 10 + (Math.round(f * 400) % 2 ? 3 : -3) });
    expect(elevationGain(c)).toBeLessThan(20);
  });
});

describe("course helpers", () => {
  const c = straightCourse(10000);

  it("rescales distances and landmarks together", () => {
    const withLm = { ...c, landmarks: [{ d: 5000, name: "half", emoji: "", vibe: "" }] };
    const r = rescaleCourse(withLm, 20000);
    expect(r.distance).toBe(20000);
    expect(r.points.at(-1)!.d).toBeCloseTo(20000, 6);
    expect(r.landmarks[0].d).toBeCloseTo(10000, 6);
  });

  it("interpolates points along the course", () => {
    const mid = pointAt(c, c.distance / 2);
    expect(mid.lat).toBeCloseTo(40 + 5000 / M_PER_DEG, 4);
    const [lon, lat] = makePointLookup(c)(c.distance / 2);
    expect(lon).toBe(-74);
    expect(lat).toBeCloseTo(mid.lat, 9);
  });

  it("slices a sub-route with exact endpoints", () => {
    const seg = sliceCoords(c, 2500, 7500);
    expect(seg.length).toBeGreaterThan(2);
    expect(seg[0][1]).toBeCloseTo(pointAt(c, 2500).lat, 9);
    expect(seg.at(-1)![1]).toBeCloseTo(pointAt(c, 7500).lat, 9);
  });

  it("computes bounds and elevation gain", () => {
    const b = bounds(c);
    expect(b[0][1]).toBeCloseTo(40, 6);
    expect(b[1][1]).toBeGreaterThan(40);
    const hill = straightCourse(4000, { ele: (f) => (f < 0.5 ? f * 100 : (1 - f) * 100) });
    expect(elevationGain(hill)).toBeGreaterThan(40);
    expect(elevationGain(hill)).toBeLessThan(55);
  });
});
