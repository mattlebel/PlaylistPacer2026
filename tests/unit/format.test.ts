import { describe, expect, it } from "vitest";
import { fmtClock, fmtDist, fmtPace, fromUnits, parseClock, toUnits } from "@/lib/format";
import { METERS_PER_MILE } from "@/lib/geo";

describe("fmtClock", () => {
  it("formats minutes and hours", () => {
    expect(fmtClock(0)).toBe("0:00");
    expect(fmtClock(65)).toBe("1:05");
    expect(fmtClock(3599)).toBe("59:59");
    expect(fmtClock(3600)).toBe("1:00:00");
    expect(fmtClock(14399)).toBe("3:59:59");
  });
  it("can force the hours field and handles negatives", () => {
    expect(fmtClock(65, true)).toBe("0:01:05");
    expect(fmtClock(-30)).toBe("-0:30");
  });
  it("rounds to the nearest second", () => {
    expect(fmtClock(59.6)).toBe("1:00");
  });
});

describe("parseClock", () => {
  it("parses h:mm:ss, mm:ss and plain seconds", () => {
    expect(parseClock("3:59:59")).toBe(14399);
    expect(parseClock("45:00")).toBe(2700);
    expect(parseClock("90")).toBe(90);
    expect(parseClock(" 1:02:03 ")).toBe(3723);
  });
  it("rejects junk", () => {
    expect(parseClock("abc")).toBeNull();
    expect(parseClock("1:2:3:4")).toBeNull();
    expect(parseClock("1:-2")).toBeNull();
    expect(parseClock("")).toBeNull();
  });
});

describe("units", () => {
  it("round-trips miles and km", () => {
    expect(toUnits(METERS_PER_MILE, "mi")).toBeCloseTo(1);
    expect(toUnits(5000, "km")).toBe(5);
    expect(fromUnits(26.2, "mi")).toBeCloseTo(42164.8, 0);
    expect(fmtDist(42195, "km", 1)).toBe("42.2");
  });
  it("formats pace per unit", () => {
    expect(fmtPace(600 / METERS_PER_MILE, "mi")).toBe("10:00/mi");
    expect(fmtPace(300 / 1000, "km")).toBe("5:00/km");
  });
});
