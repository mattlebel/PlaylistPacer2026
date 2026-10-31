import { describe, expect, it } from "vitest";
import { fmtDuration, fmtTrack, TYPICAL_SONG_SEC, wrap, type WrapEntry } from "@/lib/wrapped";

const e = (title: string, artist: string, from: string | undefined, sec?: number, art?: string): WrapEntry => ({
  song: { title, artist, durationSec: sec, art },
  from,
  isRunner: from === undefined,
});

describe("race playlist wrapped", () => {
  const miles = [
    { n: 0, songs: [e("Empire State of Mind", "JAY-Z, Alicia Keys", "Sarah", 276, "a"), e("Juice", "Lizzo", "sarah", 195, "b")] },
    { n: 1, songs: [] },
    { n: 15, songs: [e("Mr. Brightside", "The Killers", "Sarah Connor", 222, "c"), e("Run", "Matt's band", undefined, 300, "c")] },
    { n: 20, songs: [e("When You Were Young", "The Killers", "Mom"), e("Bohemian Rhapsody", "Queen", "Mom", 355, "d")] },
  ];
  const w = wrap(miles, "Matt Lebel", 660);

  it("adds up songs, music time (estimating unknown lengths), artists and people", () => {
    expect(w.songs).toBe(6);
    expect(w.seconds).toBe(276 + 195 + 222 + 300 + 355 + TYPICAL_SONG_SEC);
    expect(w.estimated).toBe(true);
    expect(w.artists).toBe(5); // JAY-Z, Lizzo, The Killers, Matt's band, Queen
    expect(w.people).toBe(2); // Sarah and Mom; the runner isn't counted
    expect(w.milesWithSongs).toBe(3);
  });

  it("finds the top artists, the longest track and how much of the race it covers", () => {
    expect(w.topArtists).toEqual([{ name: "The Killers", count: 2 }]);
    expect(w.longest).toEqual({ title: "Bohemian Rhapsody", artist: "Queen", seconds: 355 });
    expect(w.raceSeconds).toBe(Math.round(660 * 26.2));
    expect(w.coverage).toBeCloseTo(w.seconds / w.raceSeconds);
  });

  it("ranks people by songs added, grouped by first name, with the runner marked", () => {
    expect(w.leaderboard).toEqual([
      { name: "Sarah", count: 3, isRunner: false },
      { name: "Mom", count: 2, isRunner: false },
      { name: "Matt", count: 1, isRunner: true },
    ]);
    expect(w.art).toEqual(["a", "b", "c", "d"]);
  });

  it("formats durations", () => {
    expect(fmtDuration(9876)).toBe("2h 45m");
    expect(fmtDuration(47 * 60)).toBe("47m");
    expect(fmtTrack(355)).toBe("5:55");
  });
});
