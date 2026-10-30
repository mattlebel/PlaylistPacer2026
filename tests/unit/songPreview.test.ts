import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ID = "3n3Ppam7vgaVa1iaRUc9Lp";
const CLIP = "https://p.scdn.co/mp3-preview/abc123def456?cid=xyz";
const json = (body: unknown) => new Response(JSON.stringify(body));
const html = (body: string, status = 200) => new Response(body, { status });

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

const load = () => import("@/lib/server/songPreview");

describe("song preview clips", () => {
  it("reads the clip link from the song's Spotify page, once", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe(`https://open.spotify.com/track/${ID}`);
      return html(`<meta property="og:audio" content="${CLIP.replace("&", "&amp;")}" />`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { findPreview } = await load();
    const song = { spotifyId: ID, title: "Mr. Brightside", artist: "The Killers" };
    expect(await findPreview(song)).toBe(CLIP);
    expect(await findPreview(song)).toBe(CLIP);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to iTunes, matching the title and artist", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("open.spotify.com")) return html("no clip here");
      expect(url).toContain("term=mr%20brightside%20The%20Killers");
      return json({
        results: [
          { trackName: "Mr. Brightside (Cover)", artistName: "Someone Else", previewUrl: "https://audio/wrong.m4a" },
          { trackName: "Mr. Brightside", artistName: "The Killers", previewUrl: "https://audio/right.m4a" },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { findPreview } = await load();
    expect(await findPreview({ spotifyId: ID, title: "Mr. Brightside - Remastered 2024", artist: "The Killers, Someone" })).toBe("https://audio/right.m4a");
  });

  it("never plays some other song, and remembers when there's no clip", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("itunes") ? json({ results: [{ trackName: "Different Song", artistName: "The Killers", previewUrl: "https://audio/x.m4a" }] }) : html("", 404),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { findPreview } = await load();
    expect(await findPreview({ spotifyId: ID, title: "Mr. Brightside", artist: "The Killers" })).toBeNull();
    const calls = fetchMock.mock.calls.length;
    expect(await findPreview({ spotifyId: ID, title: "Mr. Brightside", artist: "The Killers" })).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("survives network errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    const { findPreview } = await load();
    expect(await findPreview({ title: "Juice", artist: "Lizzo" })).toBeNull();
  });
});
