import type { Song } from "./types";

/**
 * Duplicate detection key. Based on title + lead artist so different releases of the same
 * song ("Mr. Brightside", "Mr. Brightside - Remastered") still count as a duplicate.
 */
export function songKey(s: Pick<Song, "title" | "artist">) {
  const title = s.title
    .toLowerCase()
    .replace(/\s+-\s+.*$/, "")
    .replace(/[([].*?[)\]]/g, "")
    .replace(/\b(feat|ft)\.?\s.*$/, "");
  const artist = s.artist.toLowerCase().split(/,|&| and | feat\.? | x /)[0];
  const clean = (x: string) => x.normalize("NFKD").replace(/[^a-z0-9]/g, "");
  return `${clean(title)}|${clean(artist)}`;
}
