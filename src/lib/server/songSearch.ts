import "server-only";
import type { Song } from "../types";

/**
 * Song search for friends, who don't log in to Spotify. Uses the app's own credentials
 * (client-credentials flow). Development-mode apps get at most 10 results per search.
 */
export const songSearchConfigured = () =>
  !!(process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);

let cached: { token: string; expires: number } | null = null;

async function appToken() {
  if (cached && Date.now() < cached.expires) return cached.token;
  const basic = Buffer.from(`${process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify token ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, expires: Date.now() + (j.expires_in - 60) * 1000 };
  return cached.token;
}

interface SpTrack {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album?: { images?: { url: string; width?: number }[] };
}

export function toSong(t: SpTrack): Song {
  const imgs = t.album?.images ?? [];
  return {
    title: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    spotifyId: t.id,
    uri: t.uri,
    art: (imgs.find((i) => (i.width ?? 0) <= 320) ?? imgs.at(-1))?.url,
    durationSec: Math.round(t.duration_ms / 1000),
  };
}

/**
 * Recent searches, so friends typing the same thing ("mr brightside") don't each cost a Spotify call.
 * Kept in memory for a few hours; the oldest entries drop off once it's full.
 */
const CACHE_MS = 6 * 3600_000;
const CACHE_MAX = 1000;
const recent = new Map<string, { at: number; songs: Song[] }>();

export function clearSearchCache() {
  recent.clear();
}

export async function searchSongs(q: string): Promise<Song[]> {
  const query = q.trim().slice(0, 100);
  if (query.length < 2) return [];
  const key = query.toLowerCase().replace(/\s+/g, " ");
  const hit = recent.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.songs;
  const songs = await spotifySearch(query);
  recent.delete(key);
  recent.set(key, { at: Date.now(), songs });
  if (recent.size > CACHE_MAX) recent.delete(recent.keys().next().value!);
  return songs;
}

async function spotifySearch(query: string): Promise<Song[]> {
  const url = `https://api.spotify.com/v1/search?type=track&limit=10&q=${encodeURIComponent(query)}`;
  let res = await fetch(url, { headers: { Authorization: `Bearer ${await appToken()}` } });
  if (res.status === 401) {
    cached = null;
    res = await fetch(url, { headers: { Authorization: `Bearer ${await appToken()}` } });
  }
  if (!res.ok) throw new Error(`Spotify search ${res.status}`);
  const j = (await res.json()) as { tracks?: { items?: (SpTrack | null)[] } };
  return (j.tracks?.items ?? []).filter((t): t is SpTrack => !!t?.id).map(toSong);
}
