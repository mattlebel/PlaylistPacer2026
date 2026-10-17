import { describe, expect, it } from "vitest";
import {
  autoRamp,
  bpmColor,
  closerReport,
  computeSegments,
  landmarkHits,
  moveTrack,
  PASTELS,
  playlistStats,
  playStarts,
} from "@/lib/plan";
import { model, settings, straightCourse, tracks } from "./helpers";

const course = straightCourse(10000); // 10 km, 3000 s goal → 300 s per km at even pace

describe("playStarts", () => {
  it("stacks durations", () => {
    expect(playStarts(tracks([100, 200, 300]), 0)).toEqual([0, 100, 300]);
  });
  it("overlaps by the crossfade", () => {
    expect(playStarts(tracks([100, 200, 300]), 5)).toEqual([0, 95, 290]);
  });
  it("never goes backwards for very short songs", () => {
    expect(playStarts(tracks([3, 3, 3]), 10)).toEqual([0, 1, 2]);
  });
});

describe("computeSegments", () => {
  it("maps a playlist that exactly fills the goal onto the whole course", () => {
    const s = settings();
    const segs = computeSegments(tracks(Array(10).fill(300)), s, model(course, s));
    expect(segs.every((x) => x.phase === "race")).toBe(true);
    expect(segs[0].startD).toBe(0);
    expect(segs[4].endD).toBeCloseTo(5000, 0);
    expect(segs.at(-1)!.endD).toBeCloseTo(course.distance, 6);
    expect(segs.some((x) => x.partial)).toBe(false);
    for (let i = 1; i < segs.length; i++) expect(segs[i].startD).toBeCloseTo(segs[i - 1].endD, 6);
  });

  it("puts songs before the start mat in the corral", () => {
    const s = settings({ startOffsetSec: 300 });
    const segs = computeSegments(tracks(Array(10).fill(300)), s, model(course, s));
    expect(segs[0].phase).toBe("corral");
    expect(segs[1].phase).toBe("race");
    expect(segs[1].raceStart).toBe(0);
  });

  it("marks a song cut off by the finish and songs after it", () => {
    const s = settings();
    const segs = computeSegments(tracks([...Array(6).fill(450), 450, 200]), s, model(course, s));
    expect(segs[6].phase).toBe("race");
    expect(segs[6].partial).toBe(true);
    expect(segs[6].raceEnd).toBe(3000);
    expect(segs[7].phase).toBe("post");
  });

  it("handles a song that straddles the start", () => {
    const s = settings({ startOffsetSec: 120 });
    const segs = computeSegments(tracks([300, 300]), s, model(course, s));
    expect(segs[0].phase).toBe("race");
    expect(segs[0].raceStart).toBe(0);
    expect(segs[0].raceEnd).toBe(180);
  });

  it("colors by tempo or by position", () => {
    const t = tracks([[300, 90], [300, 185], [300]]);
    const bpm = computeSegments(t, settings(), model(course, settings()));
    expect(bpm[0].color).toBe(bpmColor(90));
    expect(bpm[2].color).toBe(bpmColor(undefined));
    const rainbow = computeSegments(t, settings({ colorMode: "rainbow" }), model(course, settings()));
    expect(rainbow.map((x) => x.color)).toEqual(PASTELS.slice(0, 3));
  });
});

describe("bpmColor", () => {
  it("clamps to the ends of the ramp", () => {
    expect(bpmColor(40)).toBe(bpmColor(90));
    expect(bpmColor(250)).toBe(bpmColor(185));
    expect(bpmColor(90)).toBe("rgb(110, 132, 255)");
  });
  it("interpolates between stops", () => {
    expect(bpmColor(107.5)).not.toBe(bpmColor(90));
    expect(bpmColor(107.5)).not.toBe(bpmColor(125));
  });
});

describe("closerReport", () => {
  // Target: 1000 m from the end = 9000 m = 2700 s at even pace.
  const s = (closerKey: string) => settings({ closerKey, closerTargetFromEnd: 1000 });

  it("returns null without a closing track", () => {
    const t = tracks(Array(10).fill(300));
    expect(closerReport(t, computeSegments(t, settings(), model(course, settings())), settings(), model(course, settings()))).toBeNull();
  });

  it("is on time when the closer starts at the target", () => {
    const t = tracks(Array(10).fill(300));
    const st = s("t9");
    const m = model(course, st);
    const r = closerReport(t, computeSegments(t, st, m), st, m)!;
    expect(r.delta).toBeCloseTo(0, 6);
    expect(r.status).toBe("perfect");
    expect(r.suggestion).toBeUndefined();
  });

  it("reports early and finds the best slot", () => {
    const t = tracks(Array(10).fill(300));
    const st = s("t8"); // starts at 2400 s
    const m = model(course, st);
    const r = closerReport(t, computeSegments(t, st, m), st, m)!;
    expect(r.status).toBe("early");
    expect(r.delta).toBeCloseTo(-300, 6);
    expect(r.bestIndex).toBe(9);
    expect(r.bestDelta).toBeCloseTo(0, 6);
    const fixed = r.suggestion!.apply(t);
    expect(fixed.at(-1)!.key).toBe("t8");
    expect(r.suggestion!.after).toBeCloseTo(0, 6);
  });

  it("reports late and suggests a cut that lands it", () => {
    const t = tracks(Array(11).fill(300));
    const st = s("t10"); // starts at 3000 s
    const m = model(course, st);
    const r = closerReport(t, computeSegments(t, st, m), st, m)!;
    expect(r.status).toBe("late");
    expect(r.delta).toBeCloseTo(300, 6);
    expect(r.suggestion!.text).toMatch(/^Cut/);
    const fixed = r.suggestion!.apply(t);
    expect(fixed).toHaveLength(10);
    const fm = model(course, st);
    expect(closerReport(fixed, computeSegments(fixed, st, fm), st, fm)!.status).toBe("perfect");
  });

  it("prefers the fix that keeps the tempo ramp intact", () => {
    // Before the closer: 2760 s (late by 60). Swapping the 360 s song with a 300 s song lands it.
    const t = tracks([
      ...Array(8).fill([300, 120]),
      [360, 100, "Long"],
      [240, 171, "Closer"],
      [300, 104, "Close tempo"],
      [300, 180, "Far tempo"],
    ] as [number, number?, string?][]);
    const st = s("t9");
    const m = model(course, st);
    const r = closerReport(t, computeSegments(t, st, m), st, m)!;
    expect(r.delta).toBeCloseTo(60, 6);
    expect(r.suggestion!.text).toBe("Swap “Long” ↔ “Close tempo”");
    expect(r.suggestion!.after).toBeCloseTo(0, 6);
  });

  it("only suggests fixes that improve things", () => {
    const t = tracks([2715, 300]);
    const st = s("t1");
    const m = model(course, st);
    const r = closerReport(t, computeSegments(t, st, m), st, m)!;
    expect(r.delta).toBeCloseTo(15, 6);
    expect(r.suggestion).toBeUndefined();
  });

  it("accounts for crossfade and corral time", () => {
    const t = tracks(Array(10).fill(300));
    const st = settings({ closerKey: "t9", closerTargetFromEnd: 1000, crossfadeSec: 10, startOffsetSec: 60 });
    const m = model(course, st);
    const r = closerReport(t, computeSegments(t, st, m), st, m)!;
    // Closer plays at 9 × 290 = 2610 s on the playlist clock, 2550 s on the race clock.
    expect(r.delta).toBeCloseTo(2550 - 2700, 6);
  });
});

describe("autoRamp", () => {
  it("sorts slow to fast, puts unknown tempos first, and lands the closer", () => {
    const t = tracks([[300, 160], [300], [300, 100], [300, 140], [300, 120], [300, 171], [300, 130], [300, 110], [300, 150], [300, 90]]);
    const st = settings({ closerKey: "t5", closerTargetFromEnd: 1000 });
    const m = model(course, st);
    const out = autoRamp(t, st, m);
    expect(out).toHaveLength(10);
    expect(out[0].bpm).toBeUndefined();
    const known = out.filter((x) => x.bpm && x.key !== "t5").map((x) => x.bpm!);
    expect(known).toEqual([...known].sort((a, b) => a - b));
    const r = closerReport(out, computeSegments(out, st, m), st, m)!;
    expect(r.status).toBe("perfect");
  });

  it("works without a closing track", () => {
    const t = tracks([[300, 150], [300, 90]]);
    expect(autoRamp(t, settings(), model(course, settings())).map((x) => x.bpm)).toEqual([90, 150]);
  });
});

describe("moveTrack", () => {
  it("moves without mutating", () => {
    const t = tracks([1, 2, 3]);
    expect(moveTrack(t, 0, 2).map((x) => x.key)).toEqual(["t1", "t2", "t0"]);
    expect(t.map((x) => x.key)).toEqual(["t0", "t1", "t2"]);
  });
});

describe("playlistStats", () => {
  it("measures the silence at the end of a short playlist", () => {
    const st = settings({ startOffsetSec: 120 });
    const t = tracks(Array(9).fill(300));
    const segs = computeSegments(t, st, model(course, st));
    const stats = playlistStats(t, segs, st, model(course, st));
    expect(stats.totalPlay).toBe(2700);
    expect(stats.shortBy).toBe(3000 - (2700 - 120));
  });

  it("averages opening and closing tempo and counts phases", () => {
    const st = settings({ startOffsetSec: 300 });
    const t = tracks([[300, 80], [300, 100], [300, 100], [300, 110], [300, 120], [300, 130], [300, 140], [300, 150], [300, 160], [300, 170], [300, 180], [300, 60]]);
    const segs = computeSegments(t, st, model(course, st));
    const stats = playlistStats(t, segs, st, model(course, st));
    expect(stats.corralSongs).toBe(1);
    expect(stats.postSongs).toBe(1);
    expect(stats.raceSongs).toBe(10);
    expect(stats.openingBpm).toBe(103); // 100, 100, 110
    expect(stats.closingBpm).toBe(170); // 160, 170, 180
    expect(stats.shortBy).toBe(0);
  });
});

describe("landmarkHits", () => {
  it("finds the song playing at each landmark", () => {
    const st = settings();
    const t = tracks(Array(10).fill(300));
    const segs = computeSegments(t, st, model(course, st));
    const hits = landmarkHits(
      [
        { d: 5100, name: "Halfway", emoji: "", vibe: "" },
        { d: 99999, name: "Nowhere", emoji: "", vibe: "" },
      ],
      segs,
    );
    expect(hits[0].segment!.track.key).toBe("t5");
    expect(hits[1].segment).toBeUndefined();
  });
});
