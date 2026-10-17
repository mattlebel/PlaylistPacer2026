import { describe, expect, it } from "vitest";
import { parseTrackCsv } from "@/lib/csv";

const EXPORTIFY = [
  '"Track URI","Track Name","Artist Name(s)","Album Name","Duration (ms)","Tempo"',
  '"spotify:track:3n3Ppam7vgaVa1iaRUc9Lp","Mr. Brightside","The Killers","Hot Fuss","222075","148.03"',
  '"spotify:track:0VjIjW4GlUZAMYd2vXMi3b","Blinding Lights","The Weeknd","After Hours","200040","171.005"',
  '"spotify:track:1lCRw5FEZ1gPDNPzy1K4zW","Can\'t Hold Us - feat. Ray Dalton","Macklemore & Ryan Lewis, Ray Dalton","The Heist","258342",""',
].join("\r\n");

describe("parseTrackCsv", () => {
  it("reads Exportify exports", () => {
    const t = parseTrackCsv(EXPORTIFY);
    expect(t).toHaveLength(3);
    expect(t[0]).toMatchObject({
      title: "Mr. Brightside",
      artist: "The Killers",
      durationSec: 222,
      bpm: 148,
      spotifyId: "3n3Ppam7vgaVa1iaRUc9Lp",
      uri: "spotify:track:3n3Ppam7vgaVa1iaRUc9Lp",
    });
    expect(t[2].artist).toBe("Macklemore & Ryan Lewis, Ray Dalton");
    expect(t[2].bpm).toBeUndefined();
  });

  it("reads hand-made CSVs with m:ss durations and quoted commas", () => {
    const t = parseTrackCsv('title,artist,length,bpm\n"Run, Boy, Run",Woodkid,3:35,162\nUnwritten,Natasha Bedingfield,4:19,\n');
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ title: "Run, Boy, Run", durationSec: 215, bpm: 162 });
    expect(t[0].uri).toBeUndefined();
    expect(t[1].durationSec).toBe(259);
  });

  it("handles escaped quotes", () => {
    const t = parseTrackCsv('name,duration\n"The ""Real"" Slim Shady",284000\n');
    expect(t[0].title).toBe('The "Real" Slim Shady');
    expect(t[0].durationSec).toBe(284);
  });

  it("ignores implausible tempos", () => {
    const t = parseTrackCsv("title,duration,tempo\nA,200,0\nB,200,999\n");
    expect(t.map((x) => x.bpm)).toEqual([undefined, undefined]);
  });

  it("explains what's missing", () => {
    expect(() => parseTrackCsv("artist,album\nX,Y\n")).toThrow(/title and a duration/);
    expect(() => parseTrackCsv("")).toThrow(/Empty CSV/);
  });
});
