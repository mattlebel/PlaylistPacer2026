import { describe, expect, it } from "vitest";
import { loadPreset } from "@/lib/courses";
import { haversine, pointAt } from "@/lib/geo";
import { MILES } from "@/lib/race";

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

/** Each mile marker should sit where its name says. Reference points are well-known spots on the route. */
const NEAR: Record<number, { lat: number; lon: number; within: number; what: string }> = {
  0: { lat: 40.6019, lon: -74.062, within: 150, what: "Fort Wadsworth start" },
  1: { lat: 40.6066, lon: -74.0447, within: 400, what: "Verrazzano mid-span" },
  8: { lat: 40.6826, lon: -73.9754, within: 700, what: "Barclays Center" },
  13: { lat: 40.7405, lon: -73.9525, within: 600, what: "Pulaski Bridge" },
  15: { lat: 40.7533, lon: -73.9465, within: 500, what: "Queensboro Bridge approach, Queens Plaza" },
  16: { lat: 40.7615, lon: -73.9607, within: 400, what: "First Ave in the low 60s" },
  20: { lat: 40.808, lon: -73.9262, within: 500, what: "just over the Willis Ave Bridge" },
  21: { lat: 40.8123, lon: -73.934, within: 500, what: "Madison Ave Bridge" },
  22: { lat: 40.8045, lon: -73.9435, within: 500, what: "Marcus Garvey Park" },
  23: { lat: 40.7921, lon: -73.9526, within: 500, what: "Fifth Ave climb" },
  24: { lat: 40.7794, lon: -73.9632, within: 500, what: "the Met, East Drive" },
  26: { lat: 40.7723, lon: -73.9777, within: 400, what: "Tavern on the Green" },
};

describe("mile markers on the real course", () => {
  it.each(Object.entries(NEAR))("mile %s lands where its name says", (n, ref) => {
    const m = MILES.find((x) => x.n === Number(n))!;
    const p = pointAt(nyc, m.d);
    expect(haversine(p.lat, p.lon, ref.lat, ref.lon), ref.what).toBeLessThan(ref.within);
  });
});
