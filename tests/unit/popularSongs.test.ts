import { describe, expect, it } from "vitest";
import { parseTypedSong, POPULAR_SONGS, suggestSongs } from "@/lib/popularSongs";
import { songKey } from "@/lib/server/repo";

describe("built-in song list", () => {
  it("is a few hundred songs with no repeats", () => {
    expect(POPULAR_SONGS.length).toBeGreaterThan(300);
    const keys = POPULAR_SONGS.map(songKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of POPULAR_SONGS) {
      expect(s.title.trim()).toBe(s.title);
      expect(s.artist.length).toBeGreaterThan(0);
    }
  });

  it("suggests as you type, best match first", () => {
    expect(suggestSongs("brights")[0]).toEqual({ title: "Mr. Brightside", artist: "The Killers" });
    expect(suggestSongs("eye of")[0].title).toBe("Eye of the Tiger");
    expect(suggestSongs("lizzo").map((s) => s.title)).toEqual(expect.arrayContaining(["Juice", "Good as Hell"]));
    expect(suggestSongs("beyonce").length).toBeGreaterThan(2); // accents don't matter
    expect(suggestSongs("empire jay")[0].title).toBe("Empire State of Mind");
    expect(suggestSongs("killers bright")[0].title).toBe("Mr. Brightside");
  });

  it("caps results and ignores tiny or unmatched queries", () => {
    expect(suggestSongs("the")).toHaveLength(8);
    expect(suggestSongs("a")).toEqual([]);
    expect(suggestSongs("zzzz qqqq")).toEqual([]);
  });
});

describe("typing a song that isn't on the list", () => {
  it("reads 'Song – Artist' and 'Song by Artist'", () => {
    expect(parseTypedSong("Juice - Lizzo")).toEqual({ title: "Juice", artist: "Lizzo" });
    expect(parseTypedSong("Juice – Lizzo")).toEqual({ title: "Juice", artist: "Lizzo" });
    expect(parseTypedSong("  Born to Run   by  Bruce Springsteen ")).toEqual({ title: "Born to Run", artist: "Bruce Springsteen" });
    expect(parseTypedSong("Stand By Me by Ben E. King")).toEqual({ title: "Stand By Me", artist: "Ben E. King" });
    expect(parseTypedSong("Stand By Me - Ben E. King")).toEqual({ title: "Stand By Me", artist: "Ben E. King" });
    expect(parseTypedSong("Mr. Brightside - Remastered by The Killers")).toEqual({ title: "Mr. Brightside - Remastered", artist: "The Killers" });
  });

  it("needs an artist", () => {
    expect(parseTypedSong("Juice")).toBeNull();
    expect(parseTypedSong("Juice -")).toBeNull();
  });
});
