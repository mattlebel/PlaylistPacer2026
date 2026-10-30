"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { searchSongs } from "@/lib/client/api";
import { suggestSongs } from "@/lib/popularSongs";
import { spotifyTrackUrl } from "@/lib/spotify";
import type { Song } from "@/lib/types";
import { SpotifyIcon } from "./brand";

// Ask the server once per page whether Spotify search is available.
let configuredCheck: Promise<boolean> | null = null;
const searchAvailable = () =>
  (configuredCheck ??= searchSongs("")
    .then((r) => r.configured)
    .catch(() => true));

/**
 * One box for finding a song. Results come from Spotify when it's set up, or from a built-in list
 * of popular running songs when it isn't. Picking hands the song back and clears the box.
 */
export function SongSearch({ onPick, inputId }: { onPick(song: Song): void; inputId?: string }) {
  const autoId = useId();
  const id = inputId ?? autoId;
  const listId = `${id}-list`;
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<Song[]>([]);
  // Unknown until the server answers, so the box doesn't flash built-in suggestions before Spotify's.
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    let live = true;
    searchAvailable().then((ok) => live && setConfigured(ok));
    return () => {
      live = false;
    };
  }, []);

  // Spotify search, debounced. The built-in list needs no network, so it updates on every keystroke.
  useEffect(() => {
    if (!configured || q.trim().length < 2) return;
    const n = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await searchSongs(q);
        if (n !== seq.current) return;
        setConfigured(r.configured);
        setRemote(r.results);
        setErr(r.error ?? null);
      } catch {
        if (n === seq.current) setErr("Search isn't working right now. Try again in a moment.");
      } finally {
        if (n === seq.current) setBusy(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, configured]);

  const typing = q.trim().length >= 2;
  const options = useMemo(() => (!typing ? [] : configured ? remote : configured === false ? suggestSongs(q) : []), [typing, configured, remote, q]);
  const current = Math.min(active, Math.max(0, options.length - 1));

  const pick = (s: Song) => {
    seq.current++;
    setQ("");
    setRemote([]);
    setBusy(false);
    setActive(0);
    onPick(s);
  };

  const status = busy ? "Searching…" : (err ?? (typing && !options.length && configured !== null ? "No matches. Try different words." : ""));

  return (
    <div>
      <input
        id={id}
        className="field"
        role="combobox"
        aria-label="Search for a song"
        aria-expanded={options.length > 0}
        aria-controls={listId}
        aria-activedescendant={options.length ? `${listId}-${current}` : undefined}
        placeholder="Search for a song or artist"
        value={q}
        autoComplete="off"
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          if (e.target.value.trim().length < 2) setRemote([]);
        }}
        onKeyDown={(e) => {
          if (!options.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((current + 1) % options.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((current - 1 + options.length) % options.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(options[current]);
          }
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-pink/60">
        <span>{status}</span>
        {configured && (
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <SpotifyIcon size={14} /> Search by Spotify
          </span>
        )}
      </div>
      {options.length > 0 && (
        <ul id={listId} className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1" role="listbox" aria-label="Search results">
          {options.map((s, i) => (
            <li key={`${s.spotifyId ?? s.title}-${s.artist}`} className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${i === current ? "bg-ink/35" : "hover:bg-ink/25"}`}>
              <button
                type="button"
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === current}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(s)}
              >
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
