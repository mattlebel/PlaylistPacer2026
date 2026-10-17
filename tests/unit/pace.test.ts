import { describe, expect, it } from "vitest";
import { buildPaceModel } from "@/lib/pace";
import { settings, straightCourse } from "./helpers";

const flat = straightCourse(10000);

describe("even pacing", () => {
  const m = buildPaceModel(flat, settings({ goalSec: 3000 }));
  it("hits the goal at the finish and halfway at half time", () => {
    expect(m.timeAt(0)).toBe(0);
    expect(m.timeAt(flat.distance)).toBeCloseTo(3000, 6);
    expect(m.timeAt(flat.distance / 2)).toBeCloseTo(1500, 0);
  });
  it("inverts cleanly", () => {
    for (const d of [123, 2500, 6789, 9999]) expect(m.distAt(m.timeAt(d))).toBeCloseTo(d, 3);
  });
  it("clamps outside the race", () => {
    expect(m.distAt(-10)).toBe(0);
    expect(m.distAt(99999)).toBeCloseTo(flat.distance, 6);
  });
  it("enforces a sane minimum goal", () => {
    expect(buildPaceModel(flat, settings({ goalSec: 5 })).goal).toBe(60);
  });
});

describe("negative split", () => {
  it("runs the second half faster by about the configured fraction", () => {
    const m = buildPaceModel(flat, settings({ goalSec: 3000, strategy: "negative", negativeSplit: 0.04 }));
    const first = m.timeAt(flat.distance / 2);
    const second = 3000 - first;
    expect(first).toBeGreaterThan(second);
    expect((first - second) / 1500).toBeCloseTo(0.04, 2);
    expect(m.timeAt(flat.distance)).toBeCloseTo(3000, 6);
  });
});

describe("hill-smart pacing", () => {
  it("slows on the climb and speeds up on the descent", () => {
    const hill = straightCourse(10000, { ele: (f) => (f < 0.5 ? f * 200 : (1 - f) * 200) });
    const m = buildPaceModel(hill, settings({ goalSec: 3000, strategy: "hills" }));
    // 2% grade: up costs 1 + 3.3(0.02), down costs 1 - 1.8(0.02) → first half gets 1.066 / 2.03 of the time.
    expect(m.timeAt(hill.distance / 2)).toBeCloseTo((3000 * 1.066) / 2.03, -1);
    expect(m.timeAt(hill.distance)).toBeCloseTo(3000, 6);
  });
  it("matches even pacing on a flat course", () => {
    const m = buildPaceModel(flat, settings({ strategy: "hills" }));
    expect(m.timeAt(flat.distance / 2)).toBeCloseTo(1500, 0);
  });
});

describe("ghost pacing", () => {
  it("replays the recorded pace curve scaled to the new goal", () => {
    // Recorded: first half in 40% of the time.
    const rec = straightCourse(10000, { time: (f) => (f <= 0.5 ? f * 0.8 : 0.4 + (f - 0.5) * 1.2) * 2500 });
    const m = buildPaceModel(rec, settings({ goalSec: 3000, strategy: "ghost" }));
    expect(m.timeAt(rec.distance / 2)).toBeCloseTo(1200, -1);
    expect(m.timeAt(rec.distance)).toBeCloseTo(3000, 6);
  });
  it("survives a GPS clock that briefly goes backwards", () => {
    const rec = straightCourse(10000, { time: (f) => (Math.abs(f - 0.5) < 0.01 ? 1000 : f * 2500) });
    const m = buildPaceModel(rec, settings({ strategy: "ghost" }));
    let prev = -1;
    for (let d = 0; d <= rec.distance; d += 250) {
      const t = m.timeAt(d);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });
  it("falls back to even pacing without timestamps", () => {
    const m = buildPaceModel(flat, settings({ strategy: "ghost" }));
    expect(m.timeAt(flat.distance / 2)).toBeCloseTo(1500, 0);
  });
});
