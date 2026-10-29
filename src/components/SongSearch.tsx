"use client";

import { useEffect, useId, useRef, useState } from "react";
import { searchSongs } from "@/lib/client/api";
import { spotifyTrackUrl } from "@/lib/spotify";
import type { Song } from "@/lib/types";
import { SpotifyIcon } from "./brand";

// Ask the server once per page whether Spotify search is available.
let configuredCheck: Promise<boolean> | null = null;
const searchAvailable = () =>
  (configuredCheck ??= searchSongs("")
    .then((r) => r.configured)
    .catch(() => true));

/** Search Spotify (through our server) or, if search isn't configured, type the song in. Picking hands the song back and clears the box. */
export function SongSearch({ onPick, inputId }: { onPick(song: Song): void; inputId?: string }) {
  const autoId = useId();
  const id = inputId ?? autoId;
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [configured, setConfigured] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [manual, setManual] = useState({ title: "", artist: "" });
  const seq = useRef(0);

  useEffect(() => {
    let live = true;
    searchAvailable().then((ok) => live && setConfigured(ok));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const n = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await searchSongs(q);
        if (n !== seq.current) return;
        setConfigured(r.configured);
        setResults(r.results);
        setErr(r.error ?? null);
      } catch {
        if (n === seq.current) setErr("Search isn't working right now. Try again in a moment.");
      } finally {
        if (n === seq.current) setBusy(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (s: Song) => {
    seq.current++;
    setQ("");
    setResults([]);
    setBusy(false);
    setManual({ title: "", artist: "" });
    onPick(s);
  };

  if (!configured) {
    const ready = manual.title.trim() && manual.artist.trim();
    return (
      <div>
        <p className="mb-2 text-sm text-blush">Type the song and artist.</p>
        <div className="grid gap-2">
          <input id={id} aria-label="Song title" className="field" placeholder="Song title" value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} />
          <input aria-label="Artist" className="field" placeholder="Artist" value={manual.artist} onChange={(e) => setManual({ ...manual, artist: e.target.value })} />
          <button
            type="button"
            className="btn bg-pink px-5 py-2.5 text-sm"
            disabled={!ready}
            onClick={() => pick({ title: manual.title.trim(), artist: manual.artist.trim() })}
          >
            Use this song
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <input
        id={id}
        className="field"
        aria-label="Search for a song"
        placeholder="Search for a song or artist"
        value={q}
        autoComplete="off"
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-pink/60">
        <span>{busy ? "Searching…" : (err ?? (q.trim().length >= 2 && !results.length ? "No matches yet" : ""))}</span>
        <span className="inline-flex items-center gap-1.5">
          <SpotifyIcon size={14} /> Search by Spotify
        </span>
      </div>
      {results.length > 0 && (
        <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1" role="listbox" aria-label="Search results">
          {results.map((s) => (
            <li key={s.spotifyId ?? s.title} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-ink/25">
              <button type="button" role="option" aria-selected={false} className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => pick(s)}>
                {s.art ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.art} alt="" className="h-10 w-10 shrink-0 rounded-[4px] object-cover" />
                ) : (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[4px] bg-ink-3">♪</span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-semibold" title={s.title}>
                    {s.title}
                  </span>
                  <span className="block truncate text-sm text-pink/70" title={s.artist}>
                    {s.artist}
                  </span>
                </span>
              </button>
              {s.spotifyId && (
                <a href={spotifyTrackUrl(s.spotifyId)} target="_blank" rel="noreferrer" className="shrink-0 p-1 text-pink/70 hover:text-chalk" aria-label={`Play ${s.title} on Spotify`}>
                  <SpotifyIcon size={18} />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
