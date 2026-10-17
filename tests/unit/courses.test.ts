import { describe, expect, it } from "vitest";
import { loadPreset } from "@/lib/courses";
import { haversine, pointAt } from "@/lib/geo";
import { MOMENTS, RACE } from "@/lib/race";

const nyc = loadPreset("nyc-marathon");

describe("NYC Marathon course", () => {
  it("is a real GPS track scaled to the certified distance", () => {
    expect(nyc.distance).toBe(42195);
    expect(nyc.measuredDistance).toBeGreaterThan(42195);
    expect(nyc.measuredDistance).toBeLessThan(42195 * 1.02);
    expect(nyc.approximate).toBeFalsy();
    expect(nyc.points.length).toBeGreaterThan(1500);
    for (let i = 1; i < nyc.points.length; i++) expect(nyc.points[i].d).toBeGreaterThan(nyc.points[i - 1].d);
  });

  it("has real elevation, topping out on the Verrazzano", () => {
    const top = nyc.points.reduce((a, b) => (b.ele > a.ele ? b : a));
    expect(top.ele).toBeGreaterThan(60);
    expect(top.d / 1609.344).toBeLessThan(1.5);
  });

  it("starts on Staten Island and finishes by Tavern on the Green", () => {
    const s = nyc.points[0];
    const f = nyc.points.at(-1)!;
    expect(haversine(s.lat, s.lon, 40.6019, -74.062)).toBeLessThan(150);
    expect(haversine(f.lat, f.lon, 40.7724, -73.977)).toBeLessThan(150);
  });

  it("is cached", () => {
    expect(loadPreset("nyc-marathon")).toBe(nyc);
  });

  it("throws for an unknown course", () => {
    expect(() => loadPreset("boston")).toThrow(/Unknown course/);
  });
});

/** Each moment should sit where its label says. Reference points are well-known spots on the route. */
const NEAR: Record<string, { lat: number; lon: number; within: number }> = {
  start: { lat: 40.6019, lon: -74.062, within: 150 },
  "5k": { lat: 40.6273, lon: -74.0266, within: 400 }, // 4th Ave, Bay Ridge
  lafayette: { lat: 40.6875, lon: -73.9731, within: 500 }, // Lafayette Ave, Fort Greene
  half: { lat: 40.7405, lon: -73.9525, within: 400 }, // Pulaski Bridge
  queensboro: { lat: 40.7533, lon: -73.9465, within: 500 }, // bridge approach, Queens Plaza
  "first-ave": { lat: 40.7615, lon: -73.9607, within: 400 }, // First Ave in the low 60s
  bronx: { lat: 40.808, lon: -73.9262, within: 500 }, // just over the Willis Ave Bridge
  madison: { lat: 40.8123, lon: -73.934, within: 500 }, // Madison Ave Bridge
  "fifth-ave": { lat: 40.7921, lon: -73.9526, within: 500 }, // Fifth Ave climb
  "central-park": { lat: 40.7812, lon: -73.9638, within: 500 }, // East Drive
  finish: { lat: 40.7673, lon: -73.9801, within: 400 }, // Central Park South, before Columbus Circle
};

describe("moments on the real course", () => {
  it.each(Object.entries(NEAR))("%s lands where its label says", (id, ref) => {
    const m = MOMENTS.find((x) => x.id === id)!;
    const p = pointAt(nyc, m.d);
    expect(haversine(p.lat, p.lon, ref.lat, ref.lon)).toBeLessThan(ref.within);
  });

  it("every moment is on the course", () => {
    for (const m of MOMENTS) expect(m.d).toBeLessThanOrEqual(RACE.distance);
  });
});
