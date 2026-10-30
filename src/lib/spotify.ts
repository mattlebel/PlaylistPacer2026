"use client";



/**
 * Spotify via Authorization Code + PKCE, entirely in the browser (no client secret).
 * Used by the runner on race morning to save the "Don't peek" playlist.
 */
const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "";
// Only the runner logs in, and only to save the race-day playlist.
const SCOPES = ["playlist-modify-private", "playlist-modify-public"].join(" ");
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

const RETURN_KEY = "kd.spotify.return";

/** Where to send the runner after Spotify login (set before redirecting). */
export function takeReturnPath() {
  const p = sessionStorage.getItem(RETURN_KEY) ?? "/";
  sessionStorage.removeItem(RETURN_KEY);
  return p;
}

export async function startSpotifyLogin(returnPath = window.location.pathname + window.location.hash) {
  sessionStorage.setItem(RETURN_KEY, returnPath);
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

interface PlaylistSong {
  title: string;
  artist: string;
  uri?: string;
}

/** Finds the closest Spotify track for a song that was picked from the built-in list or typed in. */
async function findTrack(s: PlaylistSong): Promise<string | null> {
  const artist = s.artist.split(/,|&| feat\.? /i)[0].trim();
  const q = encodeURIComponent(`track:${s.title} artist:${artist}`);
  const r = await api<{ tracks?: { items?: ({ uri: string } | null)[] } }>(`/search?type=track&limit=1&q=${q}`);
  return r.tracks?.items?.find((t) => t?.uri)?.uri ?? null;
}

/**
 * Save songs, in order, to Spotify. With `existingId`, that playlist's songs are replaced, so a
 * playlist already downloaded on the runner's phone just updates; otherwise (or if it's gone) a new
 * private playlist is made. Songs without a Spotify link are looked up by title and artist first.
 * Returns the playlist's link and id, and any songs it couldn't find.
 */
export async function savePlaylist(name: string, description: string, songs: PlaylistSong[], existingId?: string) {
  const uris: string[] = [];
  const missing: PlaylistSong[] = [];
  for (const s of songs) {
    const uri = s.uri ?? (await findTrack(s).catch(() => null));
    if (uri) uris.push(uri);
    else missing.push(s);
  }
  if (!uris.length) throw new Error("Couldn't find any of these songs on Spotify.");

  if (existingId) {
    try {
      // PUT replaces everything with the first 100; the rest are added after.
      await api(`/playlists/${existingId}/items`, { method: "PUT", body: JSON.stringify({ uris: uris.slice(0, 100) }) });
      for (let i = 100; i < uris.length; i += 100) {
        await api(`/playlists/${existingId}/items`, { method: "POST", body: JSON.stringify({ uris: uris.slice(i, i + 100) }) });
      }
      return { url: `https://open.spotify.com/playlist/${existingId}`, id: existingId, missing, updated: true };
    } catch (e) {
      // Deleted or no longer ours: make a fresh one. A signed-out session still needs to be reported.
      if (!spotifyConnected()) throw e;
    }
  }

  const pl = await api<{ id: string; external_urls: { spotify: string } }>("/me/playlists", {
    method: "POST",
    body: JSON.stringify({ name, description, public: false }),
  });
  for (let i = 0; i < uris.length; i += 100) {
    await api(`/playlists/${pl.id}/items`, { method: "POST", body: JSON.stringify({ uris: uris.slice(i, i + 100) }) });
  }
  return { url: pl.external_urls.spotify, id: pl.id, missing, updated: false };
}
