"use client";

import type { Track } from "./types";

/**
 * Spotify via Authorization Code + PKCE, entirely in the browser (no client secret).
 * Since Feb 2026, development-mode apps can only read playlists the user owns or
 * collaborates on, so we list "your playlists" rather than relying on pasted links.
 */
const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "";
const SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-private",
  "playlist-modify-public",
].join(" ");
const TOKEN_KEY = "kd.spotify.token";
const VERIFIER_KEY = "kd.spotify.verifier";
const API = "https://api.spotify.com/v1";

export const spotifyConfigured = () => CLIENT_ID.length > 0;
export const spotifyTrackUrl = (id: string) => `https://open.spotify.com/track/${id}`;
export const spotifyPlaylistUrl = (id: string) => `https://open.spotify.com/playlist/${id}`;
const redirectUri = () => `${window.location.origin}/spotify/callback`;

interface StoredToken {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

function b64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function startSpotifyLogin() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
    redirect_uri: redirectUri(),
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...body }),
  });
  if (!res.ok) throw new Error(`Spotify said no (${res.status}).`);
  const json = await res.json();
  const prev = readToken();
  const tok: StoredToken = {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? prev?.refresh_token,
    expires_at: Date.now() + (json.expires_in - 60) * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tok));
  return tok;
}

export async function finishSpotifyLogin(code: string) {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error("Login session expired — try connecting again.");
  sessionStorage.removeItem(VERIFIER_KEY);
  await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri(), code_verifier: verifier });
}

function readToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredToken) : null;
  } catch {
    return null;
  }
}

export const spotifyConnected = () => !!readToken();
export const spotifyLogout = () => localStorage.removeItem(TOKEN_KEY);

async function accessToken() {
  let tok = readToken();
  if (!tok) throw new Error("Connect Spotify first.");
  if (Date.now() > tok.expires_at && tok.refresh_token) {
    tok = await tokenRequest({ grant_type: "refresh_token", refresh_token: tok.refresh_token });
  }
  return tok.access_token;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 401) {
    spotifyLogout();
    throw new Error("Spotify session expired — reconnect.");
  }
  if (res.status === 403) throw new Error("Spotify blocked that one. Dev-mode apps can only read playlists you own or collaborate on.");
  if (!res.ok) throw Object.assign(new Error(`Spotify error ${res.status}`), { status: res.status });
  return res.status === 204 ? (undefined as T) : res.json();
}

export interface PlaylistSummary {
  id: string;
  name: string;
  image?: string;
  count: number;
  owner: string;
}

interface Paged<T> {
  items: T[];
  next: string | null;
}

interface SpPlaylist {
  id: string;
  name: string;
  images?: { url: string }[] | null;
  owner?: { display_name?: string };
  items?: { total: number };
  tracks?: { total: number };
}

export async function myPlaylists(): Promise<PlaylistSummary[]> {
  const out: PlaylistSummary[] = [];
  let next: string | null = "/me/playlists?limit=50";
  while (next && out.length < 200) {
    const page: Paged<SpPlaylist | null> = await api(next);
    for (const p of page.items) {
      if (!p) continue;
      out.push({
        id: p.id,
        name: p.name,
        image: p.images?.[0]?.url,
        count: p.items?.total ?? p.tracks?.total ?? 0,
        owner: p.owner?.display_name ?? "",
      });
    }
    next = page.next;
  }
  return out;
}

export function playlistIdFromUrl(text: string) {
  const m = text.match(/playlist[/:]([A-Za-z0-9]{10,})/);
  return m ? m[1] : /^[A-Za-z0-9]{16,}$/.test(text.trim()) ? text.trim() : null;
}

interface SpTrack {
  id: string | null;
  uri: string;
  name: string;
  type?: string;
  duration_ms: number;
  is_local?: boolean;
  artists: { name: string }[];
  album?: { images?: { url: string }[] };
}

export async function playlistTracks(id: string): Promise<{ name: string; url: string; tracks: Track[] }> {
  const meta = await api<{ name: string }>(`/playlists/${id}?fields=name`);
  const tracks: Track[] = [];
  // Feb 2026 renamed /tracks -> /items and item.track -> item.item. Accept both.
  let next: string | null = `/playlists/${id}/items?limit=50`;
  let first = true;
  while (next) {
    let page: Paged<{ item?: SpTrack | null; track?: SpTrack | null }>;
    try {
      page = await api(next);
    } catch (e) {
      if (first && (e as { status?: number }).status === 404) {
        next = `/playlists/${id}/tracks?limit=50`;
        first = false;
        continue;
      }
      throw e;
    }
    first = false;
    for (const row of page.items) {
      const t = row.item ?? row.track;
      if (!t || (t.type && t.type !== "track")) continue;
      tracks.push({
        key: `${t.id ?? t.uri}-${tracks.length}`,
        title: t.name,
        artist: t.artists.map((a) => a.name).join(", "),
        durationSec: Math.round(t.duration_ms / 1000),
        spotifyId: t.id ?? undefined,
        uri: t.is_local ? undefined : t.uri,
        art: t.album?.images?.at(-2)?.url ?? t.album?.images?.[0]?.url,
      });
    }
    next = page.next;
  }
  return { name: meta.name, url: spotifyPlaylistUrl(id), tracks };
}

/** Save the arranged order as a brand new private playlist. */
export async function savePlaylist(name: string, description: string, tracks: Track[]) {
  const uris = tracks.map((t) => t.uri).filter((u): u is string => !!u);
  if (!uris.length) throw new Error("None of these songs are on Spotify (sample mix?). Import a real playlist first.");
  const pl = await api<{ id: string; external_urls: { spotify: string } }>("/me/playlists", {
    method: "POST",
    body: JSON.stringify({ name, description, public: false }),
  });
  for (let i = 0; i < uris.length; i += 100) {
    await api(`/playlists/${pl.id}/items`, { method: "POST", body: JSON.stringify({ uris: uris.slice(i, i + 100) }) });
  }
  return pl.external_urls.spotify;
}

/** BPM lookup through our server (ReccoBeats). Best-effort: missing BPMs stay editable. */
export async function lookupBpms(ids: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (let i = 0; i < ids.length; i += 40) {
    try {
      const res = await fetch(`/api/bpm?ids=${ids.slice(i, i + 40).join(",")}`);
      if (res.ok) Object.assign(out, (await res.json()).bpm);
    } catch {
      /* keep going */
    }
  }
  return out;
}
