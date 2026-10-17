// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookupBpms, myPlaylists, playlistIdFromUrl, playlistTracks, savePlaylist, spotifyConnected } from "@/lib/spotify";

const TOKEN_KEY = "kd.spotify.token";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function track(id: string | null, name: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    uri: id ? `spotify:track:${id}` : `spotify:local:${name}`,
    name,
    type: "track",
    duration_ms: 222075,
    artists: [{ name: "The Killers" }, { name: "Guest" }],
    album: { images: [{ url: "big.jpg" }, { url: "medium.jpg" }, { url: "small.jpg" }] },
    ...extra,
  };
}

type Init = { headers: Record<string, string>; body?: unknown };
const initOf = (m: ReturnType<typeof routeFetch>, i: number) => m.mock.calls[i][1] as unknown as Init;

/** Route fetch calls by URL substring. */
function routeFetch(routes: [string, () => Response][]) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return vi.fn(async (url: string, _init?: RequestInit) => {
    const hit = routes.find(([k]) => url.includes(k));
    if (!hit) throw new Error(`unexpected fetch ${url}`);
    return hit[1]();
  });
}

beforeEach(() => {
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ access_token: "tok", refresh_token: "ref", expires_at: Date.now() + 3600_000 }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("playlistIdFromUrl", () => {
  it("reads links, URIs and bare ids", () => {
    expect(playlistIdFromUrl("https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP?si=abc")).toBe("37i9dQZF1DX76Wlfdnj7AP");
    expect(playlistIdFromUrl("spotify:playlist:37i9dQZF1DX76Wlfdnj7AP")).toBe("37i9dQZF1DX76Wlfdnj7AP");
    expect(playlistIdFromUrl("37i9dQZF1DX76Wlfdnj7AP")).toBe("37i9dQZF1DX76Wlfdnj7AP");
    expect(playlistIdFromUrl("https://open.spotify.com/track/abc")).toBeNull();
  });
});

describe("playlistTracks", () => {
  it("reads the 2026 /items shape (item.item) and pages through results", async () => {
    const fetchMock = routeFetch([
      ["fields=name", () => json({ name: "Race Day" })],
      ["/items?limit=50", () => json({ items: [{ item: track("A", "Mr. Brightside") }], next: "https://api.spotify.com/v1/playlists/P/items?offset=50&limit=50" })],
      ["/items?offset=50", () => json({ items: [{ item: { ...track("E", "A Podcast"), type: "episode" } }, { item: null }, { item: track("B", "Blinding Lights") }], next: null })],
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const { name, url, tracks } = await playlistTracks("P");
    expect(name).toBe("Race Day");
    expect(url).toBe("https://open.spotify.com/playlist/P");
    expect(tracks.map((t) => t.title)).toEqual(["Mr. Brightside", "Blinding Lights"]);
    expect(tracks[0]).toMatchObject({ artist: "The Killers, Guest", durationSec: 222, spotifyId: "A", uri: "spotify:track:A", art: "medium.jpg" });
    expect(initOf(fetchMock, 1).headers.Authorization).toBe("Bearer tok");
  });

  it("falls back to the legacy /tracks endpoint and track.track shape", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([
        ["fields=name", () => json({ name: "Old" })],
        ["/items", () => json({ error: "not found" }, 404)],
        ["/tracks", () => json({ items: [{ track: track("C", "Juice") }, { track: track(null, "My Local File", { is_local: true }) }], next: null })],
      ]),
    );
    const { tracks } = await playlistTracks("P");
    expect(tracks.map((t) => t.title)).toEqual(["Juice", "My Local File"]);
    expect(tracks[1].uri).toBeUndefined();
    expect(tracks[1].spotifyId).toBeUndefined();
  });

  it("explains the dev-mode ownership rule on 403", async () => {
    vi.stubGlobal("fetch", routeFetch([["fields=name", () => json({}, 403)]]));
    await expect(playlistTracks("P")).rejects.toThrow(/own or collaborate on/);
  });

  it("logs out on 401", async () => {
    vi.stubGlobal("fetch", routeFetch([["fields=name", () => json({}, 401)]]));
    await expect(playlistTracks("P")).rejects.toThrow(/expired/);
    expect(spotifyConnected()).toBe(false);
  });
});

describe("myPlaylists", () => {
  it("reads both the new items.total and legacy tracks.total counts", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([
        [
          "/me/playlists",
          () =>
            json({
              items: [
                { id: "1", name: "New", images: [{ url: "a.jpg" }], owner: { display_name: "Matt" }, items: { total: 64 } },
                { id: "2", name: "Legacy", images: null, owner: {}, tracks: { total: 12 } },
                null,
              ],
              next: null,
            }),
        ],
      ]),
    );
    expect(await myPlaylists()).toEqual([
      { id: "1", name: "New", image: "a.jpg", count: 64, owner: "Matt" },
      { id: "2", name: "Legacy", image: undefined, count: 12, owner: "" },
    ]);
  });
});

describe("token refresh", () => {
  it("refreshes an expired token before calling the API", async () => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ access_token: "old", refresh_token: "ref", expires_at: Date.now() - 1000 }));
    const fetchMock = routeFetch([
      ["accounts.spotify.com/api/token", () => json({ access_token: "new", expires_in: 3600 })],
      ["/me/playlists", () => json({ items: [], next: null })],
    ]);
    vi.stubGlobal("fetch", fetchMock);
    await myPlaylists();
    expect(fetchMock.mock.calls[0][0]).toContain("accounts.spotify.com/api/token");
    expect(String(initOf(fetchMock, 0).body)).toContain("grant_type=refresh_token");
    expect(initOf(fetchMock, 1).headers.Authorization).toBe("Bearer new");
    expect(JSON.parse(localStorage.getItem(TOKEN_KEY)!).refresh_token).toBe("ref");
  });
});

describe("savePlaylist", () => {
  it("creates a private playlist and adds tracks in batches of 100", async () => {
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : undefined });
        if (url.endsWith("/me/playlists")) return json({ id: "NEW", external_urls: { spotify: "https://open.spotify.com/playlist/NEW" } });
        return json({ snapshot_id: "x" });
      }),
    );
    const many = Array.from({ length: 150 }, (_, i) => ({ key: `k${i}`, title: `T${i}`, artist: "A", durationSec: 200, uri: `spotify:track:${i}` }));
    const link = await savePlaylist("NYC Marathon — 3:59:59", "desc", [...many, { key: "local", title: "L", artist: "A", durationSec: 1 }]);
    expect(link).toBe("https://open.spotify.com/playlist/NEW");
    expect(calls[0].body).toEqual({ name: "NYC Marathon — 3:59:59", description: "desc", public: false });
    expect(calls.slice(1).map((c) => (c.body as { uris: string[] }).uris.length)).toEqual([100, 50]);
    expect(calls[1].url).toContain("/playlists/NEW/items");
  });

  it("refuses a playlist with no Spotify tracks", async () => {
    await expect(savePlaylist("x", "y", [{ key: "a", title: "a", artist: "b", durationSec: 1 }])).rejects.toThrow(/None of these songs/);
  });
});

describe("lookupBpms", () => {
  it("batches ids in 40s and merges results, ignoring failed batches", async () => {
    const ids = Array.from({ length: 85 }, (_, i) => `id${i}`);
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        n++;
        if (n === 2) throw new Error("network");
        return json({ bpm: { [`id${n}`]: 120 + n } });
      }),
    );
    expect(await lookupBpms(ids)).toEqual({ id1: 121, id3: 123 });
    expect(n).toBe(3);
  });
});
