import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.resetModules();
  process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID = "cid";
  process.env.SPOTIFY_CLIENT_SECRET = "secret";
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SPOTIFY_CLIENT_SECRET;
});

const track = {
  id: "3n3Ppam7vgaVa1iaRUc9Lp",
  uri: "spotify:track:3n3Ppam7vgaVa1iaRUc9Lp",
  name: "Mr. Brightside",
  duration_ms: 222075,
  artists: [{ name: "The Killers" }],
  album: { images: [{ url: "640.jpg", width: 640 }, { url: "300.jpg", width: 300 }, { url: "64.jpg", width: 64 }] },
};

describe("song search", () => {
  it("uses an app token and maps tracks to songs", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("api/token")) {
        expect((init!.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("cid:secret").toString("base64")}`);
        return json({ access_token: "app", expires_in: 3600 });
      }
      expect(url).toMatch(/type=track&limit=10&q=(mr%20brightside|again)$/);
      return json({ tracks: { items: [track, null] } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { searchSongs } = await import("@/lib/server/songSearch");
    expect(await searchSongs("mr brightside")).toEqual([
      { title: "Mr. Brightside", artist: "The Killers", spotifyId: track.id, uri: track.uri, art: "300.jpg", durationSec: 222 },
    ]);
    await searchSongs("again");
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes("api/token"))).toHaveLength(1);
  });

  it("skips tiny queries and retries once on an expired token", async () => {
    let searches = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("api/token")) return json({ access_token: "app", expires_in: 3600 });
        return ++searches === 1 ? json({}, 401) : json({ tracks: { items: [track] } });
      }),
    );
    const { searchSongs } = await import("@/lib/server/songSearch");
    expect(await searchSongs("m")).toEqual([]);
    expect(await searchSongs("mr")).toHaveLength(1);
    expect(searches).toBe(2);
  });

  it("reports when it isn't configured", async () => {
    delete process.env.SPOTIFY_CLIENT_SECRET;
    const { songSearchConfigured } = await import("@/lib/server/songSearch");
    expect(songSearchConfigured()).toBe(false);
  });
});
