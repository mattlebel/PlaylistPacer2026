"use client";

import { motion } from "motion/react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, ApiError, type Registry as RegistryData } from "@/lib/client/api";
import { editKeys, rememberEditKey } from "@/lib/client/keys";
import { confetti } from "@/lib/confetti";
import { MILES, mileByN, mileLabel, RACE } from "@/lib/race";
import { spotifyTrackUrl } from "@/lib/spotify";
import type { Song } from "@/lib/types";
import { SpotifyIcon } from "./brand";
import { ChipStack } from "./ChipStack";
import { CourseMap, type CourseMapHandle, type MarkerState } from "./CourseMap";
import { SongSearch } from "./SongSearch";
import { Modal, Toast } from "./ui";

type MileData = RegistryData["miles"][number];
type Entry = MileData["songs"][number];

const first = (n: string) => n.trim().split(/\s+/)[0];
const POLL_MS = 8000;
const SEARCH_ID = "song-search";

const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

export function Registry() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<RegistryData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [held, setHeld] = useState<Song | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hot, setHot] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [howto, setHowto] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [mine, setMine] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const courseMap = useRef<CourseMapHandle>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<RegistryData>(`/api/races/${id}`));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't load this race.");
    }
  }, [id]);

  useEffect(() => {
    // First load, plus things only this browser knows: your name, your songs, and whether you've seen the intro.
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
    const saved = store.get("pp.name") ?? "";
    setName(saved);
    setMine(editKeys());
    // The welcome popup also asks for your name, so show it until we have one.
    if (!store.get("pp.howto") || !saved.trim()) setHowto(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [load]);

  // Live map: pick up everyone else's songs while the page is open.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && !dragging) load();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [load, dragging]);

  const markers = useMemo<MarkerState[]>(
    () => (data?.miles ?? []).map((m) => ({ count: m.songs.length, hot: hot === m.n, selected: open === m.n })),
    [data, hot, open],
  );

  const saveName = (v: string) => {
    setName(v);
    store.set("pp.name", v);
  };

  const closeHowto = () => {
    setHowto(false);
    store.set("pp.howto", "1");
    document.getElementById(SEARCH_ID)?.focus({ preventScroll: true });
  };

  const pickSong = (s: Song) => {
    setHeld(s);
    // On a phone the map is above the search box: bring it into view so there's somewhere to drag to.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      // Wait a frame so the tray has rendered, then scroll the map to the top of the screen.
      requestAnimationFrame(() => {
        const el = mapRef.current;
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 8, behavior: "smooth" });
      });
    }
  };

  const add = async (mile: number, song: Song) => {
    if (!data || busy) return false;
    if (!name.trim()) {
      setToast(`Add your name first, so ${first(data.runnerName)} knows who picked it.`);
      setHowto(true);
      return false;
    }
    const target = data.miles.find((m) => m.n === mile);
    if (target && target.songs.length >= data.perMile) {
      setToast(`${mileLabel(mile)} is full. Try a mile nearby!`);
      return false;
    }
    setBusy(true);
    try {
      const res = await api<{ id: string; editKey: string }>(`/api/races/${id}/plants`, {
        method: "POST",
        body: JSON.stringify({ mile, song, name: name.trim() }),
      });
      rememberEditKey(res.id, res.editKey);
      setMine(editKeys());
      setHeld(null);
      setToast(`Added to ${mileLabel(mile)} · ${mileByN(mile)?.title}`);
      confetti();
      await load();
      return true;
    } catch (e) {
      const ae = e instanceof ApiError ? e : null;
      setToast(ae?.message ?? "Couldn't add your song. Try again.");
      if (ae?.code === "song_taken") setHeld(null);
      if (ae?.code === "mile_full") load();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const remove = async (entry: Entry) => {
    const key = mine[entry.id];
    if (!key) return;
    try {
      await api(`/api/plants/${entry.id}`, { method: "DELETE", key: { header: "x-edit-key", value: key } });
      setToast("Removed your song.");
      await load();
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "Couldn't remove it. Try again.");
    }
  };

  if (err) return <p className="pt-10 text-lg">{err}</p>;
  if (!data) return <p className="pt-10 text-pink/60">Loading…</p>;

  const runner = first(data.runnerName);
  const withRoom = data.miles.filter((m) => m.songs.length < data.perMile).length;
  const openMile = open === null ? null : data.miles.find((m) => m.n === open)!;

  return (
    <div className="space-y-8 pt-2">
      <section className="max-w-3xl">
        <div className="label">
          {RACE.name} · {RACE.dateLabel}
        </div>
        <h1 className="mt-2 font-display text-[clamp(2.4rem,6vw,4.5rem)] font-extrabold leading-[0.95] tracking-tight [text-wrap:balance]">
          Help {runner} soundtrack 26.2
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-blush">
          {data.open ? (
            <>
              Search for a song, drag it onto a mile, and {runner} hears it right there on race day. Each mile holds{" "}
              {data.perMile} songs, first come, first served.
            </>
          ) : (
            <>Adding songs is closed. {runner} is heading to the start! Here&apos;s the soundtrack everyone built.</>
          )}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px]">
          <span className="flex items-center gap-2" title="This map updates on its own">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
            </span>
            LIVE
          </span>
          <span>
            {data.total} {data.total === 1 ? "song" : "songs"} on the course
          </span>
          <span>
            {withRoom} of {MILES.length} miles with room
          </span>
          <button className="underline underline-offset-4 hover:text-chalk" onClick={() => setHowto(true)}>
            How it works
          </button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div ref={mapRef} className="panel scroll-mt-2 overflow-hidden lg:order-2">
          <CourseMap ref={courseMap} markers={markers} perMile={data.perMile} dragging={dragging} onSelect={setOpen} className="h-[60dvh] min-h-[380px] lg:h-[700px]" />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 font-mono text-[10px] uppercase text-pink/80">
            <span className="flex items-center gap-2">
              <ChipStack count={2} max={data.perMile} size="sm" /> songs on a mile
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-butter">★</span> landmark
            </span>
            <span className="normal-case">Tap a mile to see its songs.</span>
          </div>
        </div>

        <aside className="panel space-y-5 p-5 lg:order-1 lg:sticky lg:top-4 lg:self-start">
          {data.open ? (
            <>
              <div>
                <h2 className="font-display text-2xl font-bold">Add a song</h2>
                <p className="mt-1 text-sm text-blush">Pick one, then drag it onto the map.</p>
              </div>
              <div>
                <label htmlFor="your-name" className="label mb-2 block">
                  Your name
                </label>
                <input
                  id="your-name"
                  className="field"
                  value={name}
                  maxLength={40}
                  autoComplete="given-name"
                  placeholder={`So ${runner} knows who picked it`}
                  onChange={(e) => saveName(e.target.value)}
                />
              </div>
              <SongSearch onPick={pickSong} inputId={SEARCH_ID} />
              {held && (
                <HeldSong
                  key={held.spotifyId ?? held.title}
                  song={held}
                  miles={data.miles}
                  perMile={data.perMile}
                  busy={busy}
                  onDragState={(d) => {
                    setDragging(d);
                    if (!d) {
                      setHot(null);
                      courseMap.current?.dragEnd();
                    }
                  }}
                  onMove={(x, y) => courseMap.current?.dragAt(x, y)}
                  onHover={setHot}
                  onDrop={(n) => add(n, held)}
                  onDiscard={() => setHeld(null)}
                />
              )}
            </>
          ) : (
            <div>
              <h2 className="font-display text-2xl font-bold">Adding is closed</h2>
              <p className="mt-1 text-sm text-blush">Songs locked in at 6am on race morning so {runner} could download the playlist.</p>
            </div>
          )}
        </aside>
      </div>

      <section>
        <h2 className="mb-1 font-display text-3xl font-bold tracking-tight">Every mile</h2>
        <p className="mb-5 text-blush">You can drop songs here too.</p>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Miles along the course">
          {data.miles.map((m) => (
            <MileRow key={m.n} mile={m} perMile={data.perMile} runner={runner} hot={hot === m.n} dragging={dragging} onOpen={() => setOpen(m.n)} />
          ))}
        </ol>
      </section>

      {openMile && (
        <MileSheet
          mile={openMile}
          perMile={data.perMile}
          runner={runner}
          isOpen={data.open}
          held={held}
          mine={mine}
          busy={busy}
          onAdd={async (s) => {
            if (await add(openMile.n, s)) setOpen(null);
          }}
          onRemove={remove}
          onClose={() => setOpen(null)}
        />
      )}

      <Modal open={howto} onClose={closeHowto} title="How it works">
        <ol className="space-y-4">
          {[
            ["Find a song", "Search for something that'll get them moving."],
            ["Drag it onto a mile", `Drop it on a marker on ${runner}'s course, like the Queensboro Bridge or mile 20 in the Bronx. Each mile holds ${data.perMile} songs.`],
            [`${runner} hears it out there`, `Every song goes into ${runner}'s race-day playlist in course order. The map updates live, so you can see what everyone picked.`],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pink font-display text-lg font-bold text-ink">{i + 1}</span>
              <div>
                <div className="font-display text-xl font-bold">{t}</div>
                <p className="text-blush">{d}</p>
              </div>
            </li>
          ))}
        </ol>
        <form
          className="mt-6 border-t border-pink/15 pt-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) closeHowto();
          }}
        >
          <label htmlFor="welcome-name" className="font-display text-xl font-bold">
            First, what&apos;s your name?
          </label>
          <p className="mb-3 text-sm text-blush">It shows on the songs you add, like &ldquo;from Sarah&rdquo;.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="welcome-name"
              className="field"
              value={name}
              maxLength={40}
              autoComplete="given-name"
              placeholder="Your first name"
              onChange={(e) => saveName(e.target.value)}
            />
            <button type="submit" className="btn shrink-0 bg-pink px-7 py-3.5 text-base" disabled={!name.trim()}>
              Let&apos;s go
            </button>
          </div>
        </form>
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

/* ---------- the song you're holding ---------- */

/** Where a drag would land: a row you're over, or the nearest map marker within reach. */
function dropTargetAt(x: number, y: number): number | null {
  const els = [...document.querySelectorAll<HTMLElement>("[data-drop-mile]")];
  let best: { n: number; d: number } | null = null;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    const n = Number(el.dataset.dropMile);
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return n;
    const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
    if (el.closest(".maplibregl-marker") && d < 44 && (!best || d < best.d)) best = { n, d };
  }
  return best?.n ?? null;
}

function HeldSong({
  song,
  miles,
  perMile,
  busy,
  onDragState,
  onHover,
  onMove,
  onDrop,
  onDiscard,
}: {
  song: Song;
  miles: MileData[];
  perMile: number;
  busy: boolean;
  onDragState(dragging: boolean): void;
  onHover(n: number | null): void;
  onMove(x: number, y: number): void;
  onDrop(n: number): void;
  onDiscard(): void;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [choice, setChoice] = useState("");
  const drag = useRef<{ x: number; y: number; lastX: number; lastY: number; active: boolean; target: number | null; tick: ReturnType<typeof setInterval> | 0 } | null>(null);

  // Markers move under a still pointer while the map zooms or pans, so keep checking what's underneath.
  const retarget = () => {
    const d = drag.current;
    if (!d?.active) return;
    const t = dropTargetAt(d.lastX, d.lastY);
    if (t !== d.target) {
      d.target = t;
      onHover(t);
    }
  };

  const end = () => {
    if (drag.current?.tick) clearInterval(drag.current.tick);
    drag.current = null;
    setPos(null);
    onDragState(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="fixed inset-x-3 bottom-3 z-40 rounded-2xl bg-ink-2 p-3 shadow-[0_18px_50px_rgb(8_10_40/0.55)] ring-1 ring-pink/30 lg:static lg:inset-auto lg:z-auto lg:bg-ink/30 lg:shadow-none"
    >
      <div className="flex items-center gap-3">
        <div
          role="button"
          tabIndex={-1}
          aria-label={`Drag ${song.title} onto a mile`}
          className={`flex min-w-0 flex-1 cursor-grab touch-none select-none items-center gap-3 rounded-full bg-pink py-1.5 pl-1.5 pr-4 text-ink shadow-[0_8px_20px_rgb(8_10_40/0.4)] active:cursor-grabbing ${
            pos ? "opacity-30" : "animate-[nudge_2.4s_ease-in-out_infinite]"
          }`}
          onPointerDown={(e) => {
            if (busy || e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, active: false, target: null, tick: 0 };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            if (!d.active && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
            if (!d.active) {
              d.active = true;
              d.tick = setInterval(retarget, 120);
              onDragState(true);
            }
            d.lastX = e.clientX;
            d.lastY = e.clientY;
            setPos({ x: e.clientX, y: e.clientY });
            onMove(e.clientX, e.clientY);
            retarget();
          }}
          onPointerUp={() => {
            retarget();
            const d = drag.current;
            end();
            if (d?.active && d.target !== null) onDrop(d.target);
          }}
          onPointerCancel={end}
        >
          <ChipFace song={song} />
        </div>
        <button type="button" onClick={onDiscard} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-pink/70 hover:text-chalk" aria-label="Put this song back">
          ✕
        </button>
      </div>
      <p className="mt-2 px-1 text-sm font-semibold text-chalk">
        <span className="lg:hidden">Drag it onto a mile on the map ↑</span>
        <span className="hidden lg:inline">Drag it onto a mile on the map →</span>
      </p>
      <div className="mt-2 flex gap-2">
        <select aria-label="Or choose a mile" className="field py-2 text-sm" value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">Or choose a mile…</option>
          {miles.map((m) => (
            <option key={m.n} value={m.n} disabled={m.songs.length >= perMile}>
              {mileLabel(m.n)} · {mileByN(m.n)?.title}
              {m.songs.length >= perMile ? " (full)" : ` (${perMile - m.songs.length} left)`}
            </option>
          ))}
        </select>
        <button type="button" className="btn shrink-0 bg-pink px-4 py-2 text-sm" disabled={choice === "" || busy} onClick={() => onDrop(Number(choice))}>
          Add
        </button>
      </div>
      {pos &&
        createPortal(
          <div
            aria-hidden
            className="pointer-events-none fixed z-[80] flex max-w-[260px] -translate-x-1/2 -translate-y-[130%] items-center gap-2 rounded-full bg-pink py-1 pl-1 pr-3 text-ink shadow-[0_14px_30px_rgb(8_10_40/0.55)] ring-2 ring-chalk"
            style={{ left: pos.x, top: pos.y }}
          >
            <ChipFace song={song} small />
          </div>,
          document.body,
        )}
    </motion.div>
  );
}

function ChipFace({ song, small = false }: { song: Song; small?: boolean }) {
  return (
    <>
      {song.art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={song.art} alt="" draggable={false} className={`${small ? "h-8 w-8" : "h-11 w-11"} shrink-0 rounded-[4px] object-cover`} />
      ) : (
        <span className={`${small ? "h-8 w-8" : "h-11 w-11"} grid shrink-0 place-items-center rounded-full bg-ink text-pink`}>♪</span>
      )}
      <span className="min-w-0 flex-1 leading-tight">
        <span className={`block truncate font-bold ${small ? "text-sm" : ""}`}>{song.title}</span>
        <span className="block truncate text-xs opacity-70">{song.artist}</span>
      </span>
      {song.spotifyId && <SpotifyIcon size={small ? 14 : 16} />}
    </>
  );
}

/* ---------- miles ---------- */

const fromLine = (songs: Entry[], runner: string) => {
  const names = songs.map((s) => (s.isRunner ? runner : (s.from ?? "a friend")));
  return names.length ? `from ${[...new Set(names)].join(", ")}` : "";
};

function MileRow({
  mile,
  perMile,
  runner,
  hot,
  dragging,
  onOpen,
}: {
  mile: MileData;
  perMile: number;
  runner: string;
  hot: boolean;
  dragging: boolean;
  onOpen(): void;
}) {
  const info = mileByN(mile.n)!;
  const full = mile.songs.length >= perMile;
  return (
    <li className="min-w-0">
      <button
        type="button"
        data-drop-mile={mile.n}
        onClick={onOpen}
        aria-label={`${mileLabel(mile.n)}, ${info.title}: ${mile.songs.length} of ${perMile} songs`}
        className={`flex w-full items-center gap-4 rounded-2xl p-4 text-left transition ${
          hot ? "scale-[1.02] bg-ink/50 ring-2 ring-butter" : full ? "bg-ink/10" : "bg-ink/20 hover:bg-ink/30"
        } ${dragging && full && !hot ? "opacity-40" : ""}`}
      >
        <ChipStack count={mile.songs.length} max={perMile} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] uppercase text-pink/70">{mileLabel(mile.n)}</span>
            {info.landmark && <span className="text-[10px] text-butter">★</span>}
            {full && <span className="font-mono text-[10px] uppercase text-chalk">full</span>}
          </span>
          <span className="block truncate font-display text-lg font-bold">{info.title}</span>
          <span className="block truncate text-sm text-pink/70">{fromLine(mile.songs, runner) || info.note}</span>
        </span>
      </button>
    </li>
  );
}

function MileSheet({
  mile,
  perMile,
  runner,
  isOpen,
  held,
  mine,
  busy,
  onAdd,
  onRemove,
  onClose,
}: {
  mile: MileData;
  perMile: number;
  runner: string;
  isOpen: boolean;
  held: Song | null;
  mine: Record<string, string>;
  busy: boolean;
  onAdd(song: Song): void;
  onRemove(entry: Entry): void;
  onClose(): void;
}) {
  const info = mileByN(mile.n)!;
  const room = perMile - mile.songs.length;
  return (
    <Modal open onClose={onClose} title={`${mileLabel(mile.n)} · ${info.title}`}>
      <div className="flex items-start gap-5">
        <ChipStack count={mile.songs.length} max={perMile} size="lg" className="pt-1" />
        <div className="min-w-0">
          <p className="text-blush">{info.note}</p>
          <p className="mt-2 font-mono text-[11px] uppercase">
            {mile.songs.length} of {perMile} songs · {room > 0 ? `${room} ${room === 1 ? "spot" : "spots"} open` : "full"}
          </p>
        </div>
      </div>

      <ol className="mt-5 space-y-2">
        {mile.songs.map((e) => (
          <li key={e.id} className="flex items-center gap-3 rounded-xl bg-ink/25 p-2 pr-3">
            {e.song.art && e.song.spotifyId ? (
              <a href={spotifyTrackUrl(e.song.spotifyId)} target="_blank" rel="noreferrer" aria-label={`Play ${e.song.title} on Spotify`} className="h-12 w-12 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.song.art} alt="" className="h-full w-full rounded-[4px] object-cover" />
              </a>
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[4px] bg-ink-3">♪</span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold" title={e.song.title}>
                {e.song.title}
              </div>
              <div className="truncate text-sm text-pink/70">
                {e.song.artist} · {e.isRunner ? `${runner}'s pick` : `from ${e.from ?? "a friend"}`}
              </div>
            </div>
            {e.song.spotifyId && (
              <a href={spotifyTrackUrl(e.song.spotifyId)} target="_blank" rel="noreferrer" className="shrink-0 p-1 text-pink/70 hover:text-chalk" aria-label={`Open ${e.song.title} on Spotify`}>
                <SpotifyIcon size={18} />
              </a>
            )}
            {mine[e.id] && isOpen && (
              <button className="shrink-0 text-xs text-pink/60 underline hover:text-pink" onClick={() => onRemove(e)}>
                Remove mine
              </button>
            )}
          </li>
        ))}
        {Array.from({ length: Math.max(0, room) }, (_, i) => (
          <li key={`open-${i}`} className="rounded-xl border border-dashed border-pink/25 p-3 text-center text-sm text-pink/50">
            Open spot
          </li>
        ))}
      </ol>

      {isOpen && room > 0 && (
        <div className="mt-6 border-t border-pink/15 pt-5">
          {held ? (
            <button className="btn w-full bg-pink px-6 py-3.5 text-base" disabled={busy} onClick={() => onAdd(held)}>
              Add “{held.title}” here
            </button>
          ) : (
            <>
              <div className="label mb-2">Add a song to {mile.n === 0 ? "the start" : `mile ${mile.n}`}</div>
              <SongSearch onPick={onAdd} />
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
