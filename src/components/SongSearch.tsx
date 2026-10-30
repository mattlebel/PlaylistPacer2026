"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { searchSongs } from "@/lib/client/api";
import { suggestSongs } from "@/lib/popularSongs";
import { mileInSentence } from "@/lib/race";
import { songKey } from "@/lib/songKey";
import type { Song } from "@/lib/types";
import { SpotifyIcon } from "./brand";
import { SpotifyPlayer } from "./SpotifyPlayer";
import { usePreview } from "./usePreview";

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
export function SongSearch({
  onPick,
  inputId,
  taken,
}: {
  onPick(song: Song): void;
  inputId?: string;
  /** Songs already on the course (by songKey) and their mile: shown greyed out, can't be picked. */
  taken?: Map<string, number>;
}) {
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
  // ▶ previews; with a mouse, resting on a result for half a second opens Spotify's player too.
  const preview = usePreview();
  const hover = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopHover = () => {
    if (hover.current) clearTimeout(hover.current);
    hover.current = null;
  };
  useEffect(() => stopHover, []);
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
  const takenAt = (s: Song) => taken?.get(songKey(s));

  const pick = (s: Song) => {
    stopHover();
    preview.stop();
    seq.current++;
    setQ("");
    setRemote([]);
    setBusy(false);
    setActive(0);
    onPick(s);
  };

  const status = busy ? (
    "Searching…"
  ) : err ? (
    err
  ) : typing && !options.length && configured !== null ? (
    "No matches. Try different words."
  ) : options.length ? (
    <strong className="font-semibold text-chalk">
      <span className="[@media(pointer:fine)]:hidden">Tap</span>
      <span className="hidden [@media(pointer:fine)]:inline">Click</span> a song to pick it ↓
    </strong>
  ) : (
    ""
  );

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
          if (preview.busy) preview.stop();
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
            if (takenAt(options[current]) === undefined) pick(options[current]);
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
        <ul id={listId} className="-mx-3 mt-1 max-h-80 space-y-1.5 overflow-y-auto px-3 py-2" role="listbox" aria-label="Search results">
          {options.map((s, i) => {
            const on = takenAt(s);
            const playing = preview.playing(s);
            const embed = preview.embedFor(s);
            const showing = !!embed;
            return (
              <Fragment key={`${s.spotifyId ?? s.title}-${s.artist}`}>
              <li
                // The whole row picks the song (▶ and the Spotify link do their own thing). The row under
                // the pointer, or chosen with the arrow keys, glows.
                onClick={() => on === undefined && pick(s)}
                onMouseEnter={() => {
                  if (on === undefined) setActive(i);
                  stopHover();
                  // Phones fire this on tap too; hover previews are for a mouse only.
                  if (s.spotifyId && !preview.busy && !preview.embedFor(s) && window.matchMedia("(hover: hover) and (pointer: fine)").matches)
                    hover.current = setTimeout(() => preview.showEmbed(s), 500);
                }}
                onMouseLeave={stopHover}
                className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ring-2 transition-[box-shadow,background-color] duration-150 ${
                  on !== undefined
                    ? "cursor-not-allowed opacity-50 ring-transparent"
                    : i === current
                      ? "cursor-pointer bg-ink/35 ring-pink shadow-[0_0_14px_rgb(247_211_216/0.5)]"
                      : "cursor-pointer ring-transparent hover:bg-ink/35 hover:shadow-[0_0_14px_rgb(247_211_216/0.5)] hover:ring-pink"
                }`}>
                <button
                  type="button"
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === current}
                  aria-disabled={on !== undefined}
                  disabled={on !== undefined}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left disabled:cursor-not-allowed"
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
                      {on !== undefined ? `Already on ${mileInSentence(on)}` : s.artist}
                    </span>
                  </span>
                </button>
                {s.spotifyId && (
                  <button
                    type="button"
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border text-[12px] ${
                      playing || showing ? "border-chalk bg-chalk text-ink" : "border-pink/30 hover:border-pink"
                    }`}
                    aria-label={`Preview ${s.title}`}
                    aria-pressed={playing || showing}
                    onClick={(e) => {
                      e.stopPropagation();
                      stopHover();
                      preview.toggle(s);
                    }}
                  >
                    {preview.loading(s) ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink border-t-transparent" /> : playing ? "❚❚" : "▶"}
                  </button>
                )}
              </li>
              {showing && (
                // Right under the song, so it's on screen on a phone.
                <li role="presentation" className="px-1 pb-1" ref={(el) => el?.scrollIntoView({ block: "nearest" })}>
                  <div className="label mb-1.5">Preview · {s.title}</div>
                  <SpotifyPlayer id={s.spotifyId!} title={`Preview ${s.title} on Spotify`} autoPlay={embed.auto} />
                </li>
              )}
              </Fragment>
            );
          })}
        </ul>
      )}
    </div>
  );
}
