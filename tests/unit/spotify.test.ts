// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { savePlaylist, spotifyConnected, spotifyTrackUrl, takeReturnPath } from "@/lib/spotify";

const TOKEN_KEY = "kd.spotify.token";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ access_token: "tok", refresh_token: "ref", expires_at: Date.now() + 3600_000 }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe("savePlaylist", () => {
  it("creates a private playlist and adds tracks in order, 100 at a time", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        if (url.endsWith("/me/playlists")) return json({ id: "NEW", external_urls: { spotify: "https://open.spotify.com/playlist/NEW" } });
        return json({ snapshot_id: "x" });
      }),
    );
    const songs = Array.from({ length: 150 }, (_, i) => ({ title: `Song ${i}`, artist: "X", uri: `spotify:track:${i}` }));
    expect(await savePlaylist("Don't peek", "desc", songs)).toEqual({ url: "https://open.spotify.com/playlist/NEW", missing: [] });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ name: "Don't peek", description: "desc", public: false });
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    const batches = calls.slice(1).map((c) => JSON.parse(String(c.init.body)).uris as string[]);
    expect(batches.map((b) => b.length)).toEqual([100, 50]);
    expect(batches[0][0]).toBe("spotify:track:0");
    expect(calls[1].url).toContain("/playlists/NEW/items");
  });

  it("refuses an empty playlist", async () => {
    await expect(savePlaylist("x", "y", [])).rejects.toThrow(/Couldn't find any/);
  });

  it("looks up songs without a Spotify link by title and artist, keeping course order", async () => {
    const searches: string[] = [];
    let added: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.includes("/search?")) {
          const q = decodeURIComponent(url.split("q=")[1]);
          searches.push(q);
          return json({ tracks: { items: q.includes("Nope") ? [] : [{ uri: "spotify:track:FOUND" }] } });
        }
        if (url.endsWith("/me/playlists")) return json({ id: "NEW", external_urls: { spotify: "u" } });
        added = JSON.parse(String(init.body)).uris;
        return json({});
      }),
    );
    const res = await savePlaylist("x", "y", [
      { title: "Empire State of Mind", artist: "JAY-Z", uri: "spotify:track:A" },
      { title: "Juice", artist: "Lizzo & Friends" },
      { title: "Nope", artist: "Nobody" },
    ]);
    expect(searches[0]).toBe("track:Juice artist:Lizzo");
    expect(added).toEqual(["spotify:track:A", "spotify:track:FOUND"]);
    expect(res.missing).toEqual([{ title: "Nope", artist: "Nobody" }]);
  });

  it("refreshes an expired token first", async () => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ access_token: "old", refresh_token: "ref", expires_at: Date.now() - 1000 }));
    const urls: string[] = [];
    const auth: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        urls.push(url);
        if (url.includes("accounts.spotify.com/api/token")) {
          expect(String(init.body)).toContain("grant_type=refresh_token");
          return json({ access_token: "new", expires_in: 3600 });
        }
        auth.push((init.headers as Record<string, string>).Authorization);
        return json({ id: "P", external_urls: { spotify: "u" } });
      }),
    );
    await savePlaylist("x", "y", [{ title: "a", artist: "b", uri: "spotify:track:1" }]);
    expect(urls[0]).toContain("accounts.spotify.com/api/token");
    expect(auth.every((a) => a === "Bearer new")).toBe(true);
    expect(JSON.parse(localStorage.getItem(TOKEN_KEY)!).refresh_token).toBe("ref");
  });

  it("logs out on 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 401)));
    await expect(savePlaylist("x", "y", [{ title: "a", artist: "b", uri: "spotify:track:1" }])).rejects.toThrow(/expired/);
    expect(spotifyConnected()).toBe(false);
  });
});

describe("helpers", () => {
  it("links tracks and remembers where to return after login", () => {
    expect(spotifyTrackUrl("abc")).toBe("https://open.spotify.com/track/abc");
    expect(takeReturnPath()).toBe("/");
    sessionStorage.setItem("kd.spotify.return", "/r/abc/manage#key=k");
    expect(takeReturnPath()).toBe("/r/abc/manage#key=k");
    expect(takeReturnPath()).toBe("/");
  });
});
