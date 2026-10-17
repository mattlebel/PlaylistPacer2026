import { describe, expect, it } from "vitest";
import { fmtTimeOfDay, FRIEND_MOMENTS, MOMENTS, momentEtas, momentOffsets, RACE, raceCourse, RUNNER_MOMENTS, startInstant } from "@/lib/race";

describe("NYC Marathon moments", () => {
  it("gives the runner start, halfway and finish, and friends the rest", () => {
    expect(RUNNER_MOMENTS.map((m) => m.id)).toEqual(["start", "half", "finish"]);
    expect(FRIEND_MOMENTS).toHaveLength(13);
    expect(new Set(MOMENTS.map((m) => m.id)).size).toBe(MOMENTS.length);
  });

  it("is in course order and spaced so songs don't run into each other", () => {
    for (let i = 1; i < MOMENTS.length; i++) {
      expect(MOMENTS[i].d - MOMENTS[i - 1].d).toBeGreaterThanOrEqual(1200);
    }
    expect(MOMENTS.at(-1)!.d).toBeLessThan(RACE.distance);
    expect(MOMENTS.find((m) => m.id === "half")!.d).toBe(21097.5);
  });

  it("sits on the course", () => {
    const course = raceCourse();
    expect(course.distance).toBe(RACE.distance);
    for (const m of MOMENTS) expect(m.d).toBeLessThanOrEqual(course.distance);
  });
});

describe("times", () => {
  it("builds the start instant in EST (daylight saving ends that morning)", () => {
    expect(startInstant("09:10").toISOString()).toBe("2026-11-01T14:10:00.000Z");
  });

  it("formats clock times in New York", () => {
    expect(fmtTimeOfDay(new Date("2026-11-01T17:25:00Z"))).toBe("12:25 PM");
  });

  it("estimates when the runner reaches each moment", () => {
    const offs = momentOffsets(4 * 3600);
    expect(offs.start).toBe(0);
    expect(offs.half).toBeGreaterThan(1.9 * 3600);
    expect(offs.half).toBeLessThan(2.1 * 3600);
    const etas = momentEtas(startInstant("09:10"), 4 * 3600);
    expect(etas.start).toBe("9:10 AM");
    expect(etas.finish).toMatch(/^1:0\d PM$/);
  });
});
