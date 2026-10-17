"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { loadPreset, PRESET_LIST } from "./courses";
import { DEMO_CLOSER_TITLE, DEMO_PLAYLIST_NAME, demoTracks } from "./demo";
import { METERS_PER_MILE } from "./geo";
import type { Course, PlanSettings, Track } from "./types";

interface State {
  course: Course | null;
  tracks: Track[];
  playlistName: string;
  playlistSource: "demo" | "spotify" | "csv" | null;
  settings: PlanSettings;
  selectedKey: string | null;
  setCourse(c: Course, goal?: number): void;
  setTracks(t: Track[], name: string, source: State["playlistSource"]): void;
  reorder(t: Track[]): void;
  updateTrack(key: string, patch: Partial<Track>): void;
  removeTrack(key: string): void;
  set(patch: Partial<PlanSettings>): void;
  select(key: string | null): void;
  loadDemo(): void;
}

const DEFAULTS: PlanSettings = {
  goalSec: 4 * 3600 - 1,
  units: "mi",
  strategy: "even",
  negativeSplit: 0.03,
  crossfadeSec: 0,
  startOffsetSec: 60,
  closerKey: null,
  closerTargetFromEnd: 0.5 * METERS_PER_MILE,
  colorMode: "bpm",
};

export const useKD = create<State>()(
  persist(
    (set, get) => ({
      course: null,
      tracks: [],
      playlistName: "",
      playlistSource: null,
      settings: DEFAULTS,
      selectedKey: null,
      setCourse: (course, goal) =>
        set((st) => ({
          course,
          settings: {
            ...st.settings,
            goalSec: goal ?? st.settings.goalSec,
            strategy: course.hasTimes ? "ghost" : st.settings.strategy === "ghost" ? "even" : st.settings.strategy,
          },
        })),
      setTracks: (tracks, playlistName, playlistSource) =>
        set((st) => ({
          tracks,
          playlistName,
          playlistSource,
          settings: { ...st.settings, closerKey: tracks.at(-1)?.key ?? null },
        })),
      reorder: (tracks) => set({ tracks }),
      updateTrack: (key, patch) => set((st) => ({ tracks: st.tracks.map((t) => (t.key === key ? { ...t, ...patch } : t)) })),
      removeTrack: (key) =>
        set((st) => ({
          tracks: st.tracks.filter((t) => t.key !== key),
          settings: st.settings.closerKey === key ? { ...st.settings, closerKey: null } : st.settings,
        })),
      set: (patch) => set((st) => ({ settings: { ...st.settings, ...patch } })),
      select: (selectedKey) => set({ selectedKey }),
      loadDemo: () => {
        window.scrollTo({ top: 0 });
        const preset = PRESET_LIST[0];
        const tracks = demoTracks();
        set({
          course: loadPreset(preset.id),
          tracks,
          playlistName: DEMO_PLAYLIST_NAME,
          playlistSource: "demo",
          settings: {
            ...DEFAULTS,
            units: get().settings.units,
            closerKey: tracks.find((t) => t.title === DEMO_CLOSER_TITLE)?.key ?? null,
          },
        });
      },
    }),
    {
      name: "playlistpacer.v2",
      partialize: ({ course, tracks, playlistName, playlistSource, settings }) => ({
        course,
        tracks,
        playlistName,
        playlistSource,
        settings,
      }),
    },
  ),
);
