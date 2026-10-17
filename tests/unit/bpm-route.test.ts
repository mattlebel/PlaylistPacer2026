import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/bpm/route";

const ID_A = "3n3Ppam7vgaVa1iaRUc9Lp";
const ID_B = "0VjIjW4GlUZAMYd2vXMi3b";
const req = (ids: string) => new NextRequest(`http://localhost/api/bpm?ids=${ids}`);

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/bpm", () => {
  it("maps ReccoBeats tempos back to Spotify ids", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [
            { id: "uuid-1", href: `https://open.spotify.com/track/${ID_A}`, tempo: 148.03 },
            { id: "uuid-2", href: `https://open.spotify.com/track/${ID_B}`, tempo: 171.4 },
            { id: "uuid-3", href: "https://example.com/nope", tempo: 99 },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(req(`${ID_A},${ID_B},not-an-id`));
    expect(await res.json()).toEqual({ bpm: { [ID_A]: 148, [ID_B]: 171 } });
    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.reccobeats.com/v1/audio-features?ids=${ID_A},${ID_B}`);
  });

  it("skips the upstream call when no ids are valid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await (await GET(req("bad,ids"))).json()).toEqual({ bpm: {} });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("degrades to no tempos when the service fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 503 })));
    expect(await (await GET(req(ID_A))).json()).toEqual({ bpm: {}, error: "upstream 503" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    expect(await (await GET(req(ID_A))).json()).toEqual({ bpm: {}, error: "unreachable" });
  });
});
