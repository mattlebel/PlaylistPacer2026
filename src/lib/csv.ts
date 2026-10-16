import type { Track } from "./types";

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim()));
}

/** Exportify / TuneMyMusic / hand-made CSVs. Needs a title column and a duration column. */
export function parseTrackCsv(text: string): Track[] {
  const [header, ...rows] = parseRows(text);
  if (!header) throw new Error("Empty CSV.");
  const h = header.map((x) => x.trim().toLowerCase());
  const find = (...names: string[]) => h.findIndex((col) => names.some((n) => col === n || col.includes(n)));
  const iTitle = find("track name", "title", "name", "song");
  const iArtist = find("artist name", "artist");
  const iDur = find("duration (ms)", "duration_ms", "duration", "length");
  const iTempo = find("tempo", "bpm");
  const iUri = find("track uri", "spotify uri", "uri");
  const iArt = find("album image url", "image");
  if (iTitle < 0 || iDur < 0) throw new Error("CSV needs at least a title and a duration column.");

  return rows.map((r, i) => {
    const rawDur = (r[iDur] ?? "").trim();
    let durationSec: number;
    if (rawDur.includes(":")) durationSec = rawDur.split(":").map(Number).reduce((a, v) => a * 60 + v, 0);
    else {
      const n = Number(rawDur);
      durationSec = n > 10000 ? Math.round(n / 1000) : n;
    }
    const uri = iUri >= 0 ? r[iUri]?.trim() : undefined;
    const bpm = iTempo >= 0 ? Math.round(Number(r[iTempo])) : undefined;
    return {
      key: `csv-${i}`,
      title: r[iTitle]?.trim() || "Untitled",
      artist: iArtist >= 0 ? (r[iArtist] ?? "").replace(/\\,/g, ",").trim() : "",
      durationSec: durationSec || 200,
      uri: uri?.startsWith("spotify:track:") ? uri : undefined,
      spotifyId: uri?.startsWith("spotify:track:") ? uri.split(":")[2] : undefined,
      bpm: bpm && bpm > 40 && bpm < 250 ? bpm : undefined,
      art: iArt >= 0 ? r[iArt]?.trim() || undefined : undefined,
    };
  });
}
