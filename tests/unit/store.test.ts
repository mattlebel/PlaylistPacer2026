// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_CLOSER_TITLE, demoTracks } from "@/lib/demo";
import { useKD } from "@/lib/store";
import { straightCourse } from "./helpers";

beforeEach(() => {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  localStorage.clear();
});

describe("store", () => {
  it("loads the NYC demo with its closing track picked", () => {
    useKD.getState().loadDemo();
    const s = useKD.getState();
    expect(s.course!.id).toBe("nyc-marathon");
    expect(s.tracks).toHaveLength(demoTracks().length);
    expect(s.tracks.find((t) => t.key === s.settings.closerKey)!.title).toBe(DEMO_CLOSER_TITLE);
    expect(s.playlistSource).toBe("demo");
    expect(s.playlistUrl).toBeNull();
  });

  it("defaults the closing track to the last song and remembers the Spotify link", () => {
    const t = demoTracks().slice(0, 3);
    useKD.getState().setTracks(t, "Race Day", "spotify", "https://open.spotify.com/playlist/P");
    const s = useKD.getState();
    expect(s.settings.closerKey).toBe(t[2].key);
    expect(s.playlistUrl).toBe("https://open.spotify.com/playlist/P");
  });

  it("clears the closing track when that song is removed", () => {
    const t = demoTracks().slice(0, 3);
    useKD.getState().setTracks(t, "x", "csv");
    useKD.getState().removeTrack(t[2].key);
    expect(useKD.getState().settings.closerKey).toBeNull();
    expect(useKD.getState().tracks).toHaveLength(2);
  });

  it("switches to ghost pacing for timed courses and back for untimed ones", () => {
    useKD.getState().setCourse(straightCourse(5000, { time: (f) => f * 1500 }), 1500);
    expect(useKD.getState().settings.strategy).toBe("ghost");
    expect(useKD.getState().settings.goalSec).toBe(1500);
    useKD.getState().setCourse(straightCourse(5000));
    expect(useKD.getState().settings.strategy).toBe("even");
  });

  it("persists the plan to localStorage", () => {
    useKD.getState().setTracks(demoTracks().slice(0, 2), "Saved", "csv");
    const saved = JSON.parse(localStorage.getItem("playlistpacer.v2")!);
    expect(saved.state.playlistName).toBe("Saved");
    expect(saved.state).not.toHaveProperty("selectedKey");
  });
});
