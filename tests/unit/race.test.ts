import { describe, expect, it } from "vitest";
import {
  ADDING_CLOSES_AT,
  DEFAULT_PACE_SEC,
  etaAtMile,
  finishEta,
  fmtPace,
  fmtTimeOfDay,
  LEGACY_MOMENT_MILE,
  MILES,
  mileByN,
  mileLabel,
  parsePace,
  RACE,
  raceCourse,
  SONGS_PER_MILE,
  startHhmm,
  startInstant,
  waveLabel,
} from "@/lib/race";
import { METERS_PER_MILE } from "@/lib/geo";
import { COURSE_NOTES, COURSE_NOTES_CREDIT } from "@/lib/courseNotes";

describe("NYC Marathon miles", () => {
  it("has a marker for the start and every mile through 26", () => {
    expect(MILES.map((m) => m.n)).toEqual(Array.from({ length: 27 }, (_, i) => i));
    expect(SONGS_PER_MILE).toBe(3);
  });

  it("puts each marker at its mile, in course order, on the course", () => {
    const course = raceCourse();
    expect(course.distance).toBe(RACE.distance);
    for (const m of MILES) {
      expect(Math.abs(m.d - m.n * METERS_PER_MILE)).toBeLessThan(1);
      expect(m.d).toBeLessThanOrEqual(RACE.distance);
    }
  });

  it("gives every mile a name and a note, and stars the big moments", () => {
    for (const m of MILES) {
      expect(m.title.length).toBeGreaterThan(3);
      expect(m.note.length).toBeGreaterThan(10);
    }
    expect(MILES.filter((m) => m.landmark).map((m) => m.n)).toEqual([0, 1, 8, 13, 15, 16, 20, 23, 26]);
  });

  it("labels miles", () => {
    expect(mileLabel(0)).toBe("Start");
    expect(mileLabel(15)).toBe("Mile 15");
    expect(mileByN(15)?.title).toBe("Queensboro Bridge");
    expect(mileByN(27)).toBeUndefined();
  });

  it("moves every first-version moment onto a real mile, with room to spare", () => {
    const perMile = new Map<number, number>();
    for (const n of Object.values(LEGACY_MOMENT_MILE)) {
      expect(mileByN(n)).toBeDefined();
      perMile.set(n, (perMile.get(n) ?? 0) + 1);
    }
    for (const count of perMile.values()) expect(count).toBeLessThanOrEqual(SONGS_PER_MILE);
  });
});

describe("coach's course notes", () => {
  it("are attached to real miles, credited, and cover the big moments", () => {
    for (const [n, notes] of Object.entries(COURSE_NOTES)) {
      expect(mileByN(Number(n)), `mile ${n}`).toBeDefined();
      expect(notes.length).toBeGreaterThan(0);
      for (const p of notes) expect(p.trim().length).toBeGreaterThan(40);
    }
    for (const m of MILES.filter((x) => x.landmark)) expect(COURSE_NOTES[m.n], `landmark mile ${m.n}`).toBeDefined();
    expect(COURSE_NOTES_CREDIT).toBe("Course notes by coach Stuart Calderwood");
  });
});

describe("times", () => {
  it("closes adding at 6am race morning, EST (daylight saving ends that morning)", () => {
    expect(ADDING_CLOSES_AT.toISOString()).toBe("2026-11-01T11:00:00.000Z");
  });

  it("formats clock times in New York", () => {
    expect(fmtTimeOfDay(new Date("2026-11-01T17:25:00Z"))).toBe("12:25 PM");
  });

  it("estimates each mile at an even pace from the wave start", () => {
    const start = startInstant("09:10");
    expect(start.toISOString()).toBe("2026-11-01T14:10:00.000Z");
    expect(startHhmm(start)).toBe("09:10");
    expect(waveLabel("09:10")).toBe("Wave 1");
    expect(waveLabel("09:12")).toBeUndefined();
    expect(DEFAULT_PACE_SEC).toBe(660);
    expect(fmtTimeOfDay(etaAtMile(start, 660, 0))).toBe("9:10 AM");
    expect(fmtTimeOfDay(etaAtMile(start, 660, 15))).toBe("11:55 AM");
    expect(fmtTimeOfDay(etaAtMile(start, 660, 26))).toBe("1:56 PM");
    expect(fmtTimeOfDay(finishEta(start, 660))).toBe("1:58 PM");
  });

  it("reads and writes paces", () => {
    expect(fmtPace(660)).toBe("11:00");
    expect(fmtPace(545)).toBe("9:05");
    expect(parsePace("11:00")).toBe(660);
    expect(parsePace("9:05")).toBe(545);
    expect(parsePace("11")).toBe(660);
    expect(parsePace("4:30")).toBeNull();
    expect(parsePace("11:75")).toBeNull();
    expect(parsePace("fast")).toBeNull();
  });
});
