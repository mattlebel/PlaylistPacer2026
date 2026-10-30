import "server-only";

/**
 * Finds a 30-second preview clip for a song, so the ▶ button can play it straight away (the
 * Spotify player in an iframe often won't play on iPhones). Spotify's API stopped returning
 * preview links, so this reads the clip link from the song's public Spotify page, and falls back
 * to Apple's free iTunes search. Results are kept in memory, including "no clip found".
 */
const CACHE_MS = 24 * 3600_000;
const CACHE_MAX = 2000;
const found = new Map<string, { at: number; url: string | null }>();

export function clearPreviewCache() {
  found.clear();
}

const SPOTIFY_CLIP = /https:\/\/p\.scdn\.co\/mp3-preview\/[A-Za-z0-9]+(?:\?[A-Za-z0-9=&_.-]*)?/;

async function fromSpotify(id: string): Promise<string | null> {
  for (const page of [`https://open.spotify.com/track/${id}`, `https://open.spotify.com/embed/track/${id}`]) {
    try {
      const res = await fetch(page, { headers: { "User-Agent": "Mozilla/5.0 (compatible; PlaylistPacer)" }, signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;
      const m = (await res.text()).match(SPOTIFY_CLIP);
      if (m) return m[0].replace(/&amp;/g, "&");
    } catch {
      /* try the next page */
    }
  }
  return null;
}

const simple = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s*[-(\[].*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

async function fromItunes(title: string, artist: string): Promise<string | null> {
  const lead = artist.split(",")[0].trim();
  const term = `${simple(title)} ${lead}`.trim();
  if (!term) return null;
  try {
    const res = await fetch(`https://itunes.apple.com/search?media=music&entity=song&limit=10&term=${encodeURIComponent(term)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { results?: { trackName?: string; artistName?: string; previewUrl?: string }[] };
    const hits = (j.results ?? []).filter((r) => r.previewUrl);
    // Same title and artist, or failing that the same title: never a clip of some other song.
    const t = simple(title);
    const a = simple(lead);
    const hit =
      hits.find((r) => simple(r.trackName ?? "") === t && simple(r.artistName ?? "").includes(a)) ??
      hits.find((r) => simple(r.trackName ?? "") === t);
    return hit?.previewUrl ?? null;
  } catch {
    return null;
  }
}

export async function findPreview(song: { spotifyId?: string; title: string; artist: string }): Promise<string | null> {
  const key = song.spotifyId ?? `${simple(song.title)}|${simple(song.artist)}`;
  const hit = found.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.url;
  const url = (song.spotifyId ? await fromSpotify(song.spotifyId) : null) ?? (await fromItunes(song.title, song.artist));
  if (found.size >= CACHE_MAX) found.delete(found.keys().next().value!);
  found.set(key, { at: Date.now(), url });
  return url;
}
