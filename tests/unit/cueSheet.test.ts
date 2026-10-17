import { describe, expect, it } from "vitest";
import { cueSheet } from "@/lib/cueSheet";
import { buildPaceModel } from "@/lib/pace";
import { closerReport, computeSegments, landmarkHits, playlistStats } from "@/lib/plan";
import type { Course } from "@/lib/types";
import type { Plan } from "@/lib/usePlan";
import { settings, straightCourse, tracks } from "./helpers";

function plan(course: Course): Plan {
  const s = settings({ closerKey: "t9", units: "km" });
  const t = tracks(Array(10).fill(300));
  const model = buildPaceModel(course, s);
  const segments = computeSegments(t, s, model);
  return {
    course,
    tracks: t,
    settings: s,
    model,
    segments,
    closer: closerReport(t, segments, s, model),
    hits: landmarkHits(course.landmarks, segments),
    stats: playlistStats(t, segments, s, model),
  };
}

describe("cueSheet", () => {
  it("lists race tracks with distance and race clock, starring the closer", () => {
    const text = cueSheet(plan(straightCourse(10000)), { name: "Race Day" });
    const lines = text.split("\n");
    expect(lines[0]).toBe("Test Course — goal 0:50:00 (5:00/km)");
    expect(lines[1]).toBe("Playlist: Race Day");
    expect(lines[3]).toBe("   0.00 km  0:00:00  Song 0 — Artist");
    expect(lines[12]).toBe("★  9.00 km  0:45:00  Song 9 — Artist");
    expect(text.trim().endsWith("made with Playlist Pacer")).toBe(true);
    expect(text).not.toMatch(/Spotify|Strava/);
  });

  it("credits Spotify, Strava and the recording device", () => {
    const course = { ...straightCourse(10000), source: "strava-activity" as const, sourceUrl: "https://www.strava.com/activities/1", device: "Garmin Forerunner 965" };
    const text = cueSheet(plan(course), { name: "Race Day", url: "https://open.spotify.com/playlist/P" });
    expect(text).toContain("Tracks from Spotify: https://open.spotify.com/playlist/P");
    expect(text).toContain("Course powered by Strava · View on Strava: https://www.strava.com/activities/1");
    expect(text).toContain("Recorded on Garmin Forerunner 965");
  });
});
