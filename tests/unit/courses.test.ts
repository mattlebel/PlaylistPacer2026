import { describe, expect, it } from "vitest";
import { loadPreset, PRESET_LIST } from "@/lib/courses";

describe("preset courses", () => {
  it.each(PRESET_LIST.map((p) => [p.id, p] as const))("%s loads at its official distance", (id, p) => {
    const c = loadPreset(id);
    expect(c.distance).toBe(p.official);
    expect(c.points.at(-1)!.d).toBeCloseTo(p.official, 6);
    expect(c.approximate).toBe(true);
    expect(c.source).toBe("preset");
    for (let i = 1; i < c.points.length; i++) expect(c.points[i].d).toBeGreaterThan(c.points[i - 1].d);
    for (const pt of c.points) {
      expect(pt.ele).toBeGreaterThanOrEqual(0);
      expect(pt.ele).toBeLessThan(100);
    }
    expect(c.landmarks.length).toBeGreaterThan(3);
    for (const l of c.landmarks) {
      expect(l.d).toBeGreaterThanOrEqual(0);
      expect(l.d).toBeLessThanOrEqual(c.distance);
    }
  });

  it("uses the certified race distances", () => {
    const byId = Object.fromEntries(PRESET_LIST.map((p) => [p.id, p.official]));
    expect(byId["nyc-marathon"]).toBe(42195);
    expect(byId["brooklyn-half"]).toBe(21097.5);
  });

  it("has the Queensboro Bridge around mile 15 of the marathon", () => {
    const c = loadPreset("nyc-marathon");
    const qb = c.landmarks.find((l) => l.name === "Queensboro Bridge")!;
    expect(qb.d / 1609.344).toBeCloseTo(15.2, 1);
  });

  it("throws for an unknown course", () => {
    expect(() => loadPreset("boston")).toThrow(/Unknown course/);
  });
});
