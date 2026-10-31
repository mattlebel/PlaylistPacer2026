import type { Song } from "./types";

/**
 * "Wrapped" for a race playlist: totals, top artists, the longest track, how much of the race the
 * music covers, and a leaderboard of who added the most songs (grouped by first name).
 */

export interface WrapEntry {
  song: Song;
  /** Who added it ("from Sarah"); missing for the runner's own picks. */
  from?: string;
  isRunner: boolean;
}

export interface Wrapped {
  songs: number;
  /** Total length of the playlist, in seconds. */
  seconds: number;
  /** Some songs had no length, so `seconds` uses a typical length for them. */
  estimated: boolean;
  artists: number;
  /** People who added songs (not counting the runner). */
  people: number;
  milesWithSongs: number;
  /** The most-picked artists (two songs or more), most first. */
  topArtists: { name: string; count: number }[];
  longest?: { title: string; artist: string; seconds: number };
  /** The race at the runner's pace, in seconds, and how much of it the music covers (can pass 1). */
  raceSeconds: number;
  coverage: number;
  /** Who added the most songs, by first name. */
  leaderboard: { name: string; count: number; isRunner: boolean }[];
  /** Album art for a collage, a few distinct covers. */
  art: string[];
}

/** A typical song length, for songs we don't know the length of. */
export const TYPICAL_SONG_SEC = 210;
const MARATHON_MILES = 26.2;

const firstName = (n: string) => n.trim().split(/\s+/)[0];
const leadArtist = (a: string) => a.split(/,|\bfeat\.|\bft\.|&/i)[0].trim();

export function wrap(miles: { n: number; songs: WrapEntry[] }[], runner: string, paceSec: number): Wrapped {
  const all = miles.flatMap((m) => m.songs);
  let seconds = 0;
  let estimated = false;
  let longest: Wrapped["longest"];
  const artists = new Map<string, { name: string; count: number }>();
  const people = new Map<string, { name: string; count: number; isRunner: boolean; first: number }>();
  const art: string[] = [];

  all.forEach((e, i) => {
    const len = e.song.durationSec;
    if (len) {
      seconds += len;
      if (!longest || len > longest.seconds) longest = { title: e.song.title, artist: e.song.artist, seconds: len };
    } else {
      seconds += TYPICAL_SONG_SEC;
      estimated = true;
    }

    const a = leadArtist(e.song.artist);
    const ak = a.toLowerCase();
    artists.set(ak, { name: artists.get(ak)?.name ?? a, count: (artists.get(ak)?.count ?? 0) + 1 });

    const who = e.isRunner ? firstName(runner) : firstName(e.from ?? "") || "Someone";
    const pk = e.isRunner ? "\u0000runner" : who.toLowerCase();
    const prev = people.get(pk);
    people.set(pk, { name: prev?.name ?? who, count: (prev?.count ?? 0) + 1, isRunner: e.isRunner, first: prev?.first ?? i });

    if (e.song.art && art.length < 9 && !art.includes(e.song.art)) art.push(e.song.art);
  });

  const raceSeconds = Math.round(paceSec * MARATHON_MILES);
  return {
    songs: all.length,
    seconds,
    estimated,
    artists: artists.size,
    people: [...people.values()].filter((p) => !p.isRunner).length,
    milesWithSongs: miles.filter((m) => m.songs.length).length,
    topArtists: [...artists.values()]
      .filter((a) => a.count >= 2)
      .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name))
      .slice(0, 3),
    longest,
    raceSeconds,
    coverage: raceSeconds ? seconds / raceSeconds : 0,
    leaderboard: [...people.values()]
      .sort((x, y) => y.count - x.count || x.first - y.first)
      .map(({ name, count, isRunner }) => ({ name, count, isRunner })),
    art,
  };
}

/** 9,876 seconds → "2h 44m"; under an hour → "47m". */
export function fmtDuration(sec: number) {
  const m = Math.round(sec / 60);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}

/** 355 → "5:55". */
export const fmtTrack = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
