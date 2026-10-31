"use client";

import { AnimatePresence, motion } from "motion/react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, ApiError, type Registry as RegistryData } from "@/lib/client/api";
import { deviceId, editKeys, rememberEditKey } from "@/lib/client/keys";
import { confetti } from "@/lib/confetti";
import { COURSE_NOTES, COURSE_NOTES_CREDIT } from "@/lib/courseNotes";
import { etaAtMile, finishEta, fmtPace, fmtTimeOfDay, MILES, mileByN, mileInSentence, mileLabel, RACE, startHhmm, waveLabel } from "@/lib/race";
import { songKey } from "@/lib/songKey";
import { cheer, cowbell, roar, setSoundOn, soundOn, welcome } from "@/lib/sounds";
import type { Song } from "@/lib/types";
import { SpotifyIcon } from "./brand";
import { faq } from "@/lib/faq";
import { wrap } from "@/lib/wrapped";
import { Bib } from "./Bib";
import { Wrapped } from "./Wrapped";
import { LogoMark } from "./Logo";
import { DragOntoAMile, FindASong, HearItOutThere } from "./HowItWorks";
import { ChipStack } from "./ChipStack";
import { CourseMap, type CourseMapHandle, type MarkerState } from "./CourseMap";
import { SongSearch } from "./SongSearch";
import { PreviewButton, SpotifyPlayer } from "./SpotifyPlayer";
import { holdingPreview, holdPreview, releasePreview, usePreview } from "./usePreview";
import { Modal, Toast } from "./ui";

type MileData = RegistryData["miles"][number];
type Entry = MileData["songs"][number];

const first = (n: string) => n.trim().split(/\s+/)[0];
const POLL_MS = 8000;
const SEARCH_ID = "song-search";
const SHEET_SEARCH_ID = "sheet-search";
/** Spots left on the course before "These miles have room" shows up. */
const NEEDS_FROM = 15;

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
  // Phones: search over the whole screen, opened from the floating search bar.
  const [sheet, setSheet] = useState(false);
  const phone = usePhone();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastActions, setToastActions] = useState<{ label: string; onClick(): void }[] | null>(null);
  // The song you just dropped, flying from your finger into its marker.
  const [flight, setFlight] = useState<{ song: Song; from: { x: number; y: number }; to: { x: number; y: number }; key: string } | null>(null);
  // Server time minus this device's time, so countdowns and "2 min ago" match the server.
  const [offset, setOffset] = useState(0);
  // A new song somewhere on the course: the line charges up to that mile.
  const [charge, setCharge] = useState<{ n: number; key: number } | null>(null);
  const prevCounts = useRef<Map<number, number> | null>(null);
  const [name, setName] = useState("");
  const [mine, setMine] = useState<Record<string, string>>({});
  const [sound, setSound] = useState(true);
  const [busy, setBusy] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  // Whether the search box is on screen. When it isn't (phones), a floating button brings it back.
  const [panelVisible, setPanelVisible] = useState(true);
  const courseMap = useRef<CourseMapHandle>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<RegistryData>(`/api/races/${id}`);
      const prev = prevCounts.current;
      const grown = prev && r.miles.find((m) => m.songs.length > (prev.get(m.n) ?? 0));
      if (grown) setCharge({ n: grown.n, key: Date.now() });
      prevCounts.current = new Map(r.miles.map((m) => [m.n, m.songs.length]));
      setOffset(new Date(r.now).getTime() - Date.now());
      setData(r);
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
    setSound(soundOn());
    // The welcome popup also asks for your name, so show it until we have one.
    if (!store.get("pp.howto") || !saved.trim()) setHowto(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [load]);

  // Watch the search box itself: once it's off screen, phones get a way back to it.
  const searchShown =
    !!data?.open &&
    data.total < MILES.length * data.perMile &&
    data.miles.reduce((n, m) => n + m.songs.filter((e) => mine[e.id]).length, 0) < data.maxPerPerson;
  useEffect(() => {
    const el = document.getElementById(SEARCH_ID);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setPanelVisible(e.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [searchShown]);

  // Live map: pick up everyone else's songs while the page is open.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && !dragging) load();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [load, dragging]);

  // Put back, or gone some other way: stop its preview.
  useEffect(() => {
    if (!held) releasePreview();
  }, [held]);

  const taken = useMemo(() => new Map((data?.miles ?? []).flatMap((m) => m.songs.map((e) => [songKey(e.song), m.n] as const))), [data]);

  const say = (message: string | null, actions: { label: string; onClick(): void }[] | null = null) => {
    setToast(message);
    setToastActions(actions);
  };

  const markers = useMemo<MarkerState[]>(
    () => (data?.miles ?? []).map((m) => ({ count: m.songs.length, hot: hot === m.n, selected: open === m.n })),
    [data, hot, open],
  );

  const saveName = (v: string) => {
    setName(v);
    store.set("pp.name", v);
  };

  const closeHowto = () => {
    // Friends must give a name before they start: it's how the runner knows who picked each song.
    if (!store.get("pp.name")?.trim()) return;
    setHowto(false);
    store.set("pp.howto", "1");
    document.getElementById(SEARCH_ID)?.focus({ preventScroll: true });
  };

  const pickSong = (s: Song) => {
    setHeld(s);
    // Hear it while you drag it to a mile (started inside the tap, which phones need).
    if (soundOn()) void holdPreview(s);
    // On a phone the map is above the search box: bring it into view so there's somewhere to drag to.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      // Wait a frame so the tray has rendered, then scroll the map to the top of the screen.
      requestAnimationFrame(() => {
        const el = mapRef.current;
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 8, behavior: "smooth" });
      });
    }
  };

  /** Brings the search box back into view and puts the cursor in it, ready for the next song. */
  const toSearch = () => {
    // Focus inside the tap itself: iPhones only bring up the keyboard then.
    document.getElementById(SEARCH_ID)?.focus({ preventScroll: true });
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /** Opens the full-screen search over the map, keyboard up. */
  const openSheet = () => {
    // The sheet is always on the page (just out of sight), so its box can take focus inside this tap.
    if (sheetRef.current) sheetRef.current.inert = false;
    document.getElementById(SHEET_SEARCH_ID)?.focus({ preventScroll: true });
    setSheet(true);
  };

  /** `from`: where the song was let go (a drag), so it can fly into the marker from there. */
  const add = async (mile: number, song: Song, from?: { x: number; y: number }) => {
    if (!data || busy) return false;
    if (!name.trim()) {
      say(`Add your name first, so ${first(data.runnerName)} knows who picked it.`);
      setHowto(true);
      return false;
    }
    // Songs this device already has on the course.
    const mineSoFar = data.miles.reduce((n, m) => n + m.songs.filter((e) => mine[e.id]).length, 0);
    if (mineSoFar >= data.maxPerPerson) {
      say(`You've added ${data.maxPerPerson} songs, the most one person can add. Thanks!`);
      setHeld(null);
      return false;
    }
    const target = data.miles.find((m) => m.n === mile);
    if (target && target.songs.length >= data.perMile) {
      say(`${mileLabel(mile)} is full. Try a mile nearby!`);
      return false;
    }
    setBusy(true);
    try {
      const res = await api<{ id: string; editKey: string }>(`/api/races/${id}/plants`, {
        method: "POST",
        body: JSON.stringify({ mile, song, name: name.trim(), device: deviceId() }),
      });
      rememberEditKey(res.id, res.editKey);
      setMine(editKeys());
      setHeld(null);
      navigator.vibrate?.(35); // a little buzz on phones that support it (Android)
      if (holdingPreview()) {
        // The song fades out as the crowd roars.
        releasePreview(1400);
        roar(0.05);
      } else {
        releasePreview();
        cowbell(2);
        cheer(0.25);
      }
      // Ready for the next one: on a computer, the cursor goes straight back to the search box.
      if (window.matchMedia("(min-width: 1024px)").matches) document.getElementById(SEARCH_ID)?.focus({ preventScroll: true });
      const target = document.querySelector(`.maplibregl-marker [data-drop-mile="${mile}"]`)?.getBoundingClientRect();
      if (from && target?.width && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setFlight({ song, from, to: { x: target.left + target.width / 2, y: target.top + target.height / 2 }, key: res.id });
      }
      const last = mineSoFar + 1 >= data.maxPerPerson;
      say(`Added to ${mileLabel(mile)} · ${mileByN(mile)?.title}${last ? `. That's your ${data.maxPerPerson}! 🙌` : ""}`, [
        ...(last
          ? []
          : [{ label: "＋ Add another", onClick: () => (window.matchMedia("(min-width: 1024px)").matches ? document.getElementById(SEARCH_ID)?.focus() : toSearch()) }]),
        { label: "Share", onClick: () => share(song, mile) },
        { label: "Undo", onClick: () => undo(res.id, res.editKey, song) },
      ]);
      confetti();
      await load();
      return true;
    } catch (e) {
      const ae = e instanceof ApiError ? e : null;
      say(ae?.message ?? "Couldn't add your song. Try again.");
      if (ae?.code === "song_taken" || ae?.code === "person_limit") setHeld(null);
      if (ae?.code === "mile_full") load();
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** Takes a song you just added back off the course and puts it back in your hand. */
  const undo = async (plantId: string, editKey: string, song: Song) => {
    try {
      await api(`/api/plants/${plantId}`, { method: "DELETE", key: { header: "x-edit-key", value: editKey } });
      setHeld(song);
      say("Took it back. Drop it somewhere else.");
      await load();
    } catch (e) {
      say(e instanceof ApiError ? e.message : "Couldn't undo that. Try again.");
    }
  };

  const remove = async (entry: Entry) => {
    const key = mine[entry.id];
    if (!key) return;
    try {
      await api(`/api/plants/${entry.id}`, { method: "DELETE", key: { header: "x-edit-key", value: key } });
      say("Removed your song.");
      await load();
    } catch (e) {
      say(e instanceof ApiError ? e.message : "Couldn't remove it. Try again.");
    }
  };

  /** "I put Mr. Brightside on Matt's Queensboro Bridge…" with the link, through the phone's share sheet or the clipboard. */
  const share = async (song: Song, mile: number) => {
    if (!data) return;
    const runnerFirst = first(data.runnerName);
    const url = `${window.location.origin}/r/${data.id}`;
    const text = `I put “${song.title}” on ${runnerFirst}'s ${mileInSentence(mile)} (${mileByN(mile)?.title}) of the NYC Marathon 🎵 Add a song for them:`;
    try {
      if (navigator.share) await navigator.share({ title: `Help ${runnerFirst} soundtrack his NYC Marathon`, text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        say("Copied. Paste it into a text or group chat.");
      }
    } catch {
      /* closed the share sheet */
    }
  };

  if (err) return <p className="pt-10 text-lg">{err}</p>;
  if (!data) return <p className="pt-10 text-pink/60">Loading…</p>;
  const start = new Date(data.startTime);
  const finished = new Date(data.now) >= finishEta(start, data.paceSec);
  const eta = (n: number) => fmtTimeOfDay(etaAtMile(start, data.paceSec, n));

  const runner = first(data.runnerName);
  const withRoom = data.miles.filter((m) => m.songs.length < data.perMile).length;
  const capacity = MILES.length * data.perMile;
  const myCount = data.miles.reduce((n, m) => n + m.songs.filter((e) => mine[e.id]).length, 0);
  // This device has added as many songs as one person can.
  const atLimit = myCount >= data.maxPerPerson;
  // Miles that most need a song: empty ones first (landmarks before the rest), then the emptiest with room.
  // Only once the course is nearly full, when finding a mile with room gets hard.
  const left = capacity - data.total;
  const needs = (left > NEEDS_FROM ? [] : data.miles)
    .filter((m) => m.songs.length < data.perMile)
    .sort((a, b) => a.songs.length - b.songs.length || Number(!!mileByN(b.n)?.landmark) - Number(!!mileByN(a.n)?.landmark) || a.n - b.n)
    .slice(0, 3);
  const openMile = open === null ? null : data.miles.find((m) => m.n === open)!;
  const label = (
    <div className="label">
      {RACE.name} · {RACE.dateLabel}
    </div>
  );
  const intro = data.open ? (
    <>
      Search for a song, drag it onto a mile, and {runner} hears it right there on race day.
      <span className="hidden lg:inline">
        {" "}
        Add up to {data.maxPerPerson} songs: each mile holds {data.perMile}, first come, first served.
      </span>
    </>
  ) : (
    // Race day, by the server's clock: before the start, out on the course, then done.
    <>
      {new Date(data.now) < start
        ? `Adding songs is closed. ${runner} is heading to the start! Here's the soundtrack everyone built.`
        : !finished
          ? `${runner} is out on the course right now, with the soundtrack everyone built.`
          : `${runner} ran the NYC Marathon to the soundtrack you all built. Here's the recap.`}
    </>
  );
  const progress = (
    <div className="max-w-xl">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-chalk">
          {data.total} of {capacity} spots filled
        </span>
        {data.open && data.total < capacity && <span className="text-pink/70">{capacity - data.total} to go. Keep them coming!</span>}
      </div>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-ink/40"
        role="progressbar"
        aria-label="Spots filled on the course"
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={data.total}
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-pink via-butter to-mint"
          initial={false}
          animate={{ width: `${Math.max(2, (data.total / capacity) * 100)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
  const stats = (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px]">
      {data.open && (
        <span className="flex items-center gap-2" title="This map updates on its own">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
          </span>
          LIVE
        </span>
      )}
      <span>
        {data.total} {data.total === 1 ? "song" : "songs"} on the course
      </span>
      {data.open && (
        <span>
          {withRoom} of {MILES.length} miles with room
        </span>
      )}
      {data.open && <Countdown closesAt={data.closesAt} offset={offset} />}
      {data.open && (
        <button className="underline underline-offset-4 hover:text-chalk" onClick={() => setHowto(true)}>
          How it works
        </button>
      )}
      <a href="#faq-title" className="underline underline-offset-4 hover:text-chalk">
        FAQ
      </a>
      <button
        className="underline underline-offset-4 hover:text-chalk"
        aria-pressed={sound}
        title="Cowbells and cheers when you add a song"
        onClick={() => {
          setSoundOn(!sound);
          setSound(!sound);
          if (sound) releasePreview();
          if (!sound) cowbell(1);
        }}
      >
        {sound ? "🔔 Sound on" : "🔕 Sound off"}
      </button>
    </div>
  );
  const ticker = (
    <div className="lg:hidden">
      <Activity recent={data.recent} runner={runner} offset={offset} />
    </div>
  );
  const bib = (size: "2xs" | "xs" | "sm" | "md" | "lg", className = "") =>
    data.bib ? (
      <Bib number={data.bib} name={runner} wave={waveLabel(startHhmm(start))} start={fmtTimeOfDay(start)} size={size} className={className} />
    ) : null;
  const raceLine = <RaceLine runner={runner} start={start} paceSec={data.paceSec} bib={data.bib} />;

  // The bib is the hero, kept small so the song search sits high on the page.
  const hero = (
    <section className="grid items-center gap-x-10 gap-y-4 lg:grid-cols-[auto_minmax(0,1fr)]">
      <div className="hidden lg:block">{bib("sm", "-rotate-[3deg]")}</div>
      <div className="space-y-3">
        {label}
        <div className="flex items-center gap-4">
          <div className="shrink-0 lg:hidden">{bib("xs", "-rotate-[3deg]")}</div>
          <h1 className="font-display text-[clamp(1.9rem,3.6vw,2.9rem)] font-extrabold leading-[1] tracking-tight [text-wrap:balance]">
            {data.open ? `Help ${runner} soundtrack his NYC Marathon` : `${runner}'s NYC Marathon soundtrack`}
          </h1>
        </div>
        <p className="max-w-2xl text-[13px] leading-snug text-blush lg:text-[15px] lg:leading-relaxed">{intro}</p>
        {/* Start, finish and live tracking: until the race is over. */}
        {!finished && <div className="hidden lg:block">{raceLine}</div>}
        {progress}
        {stats}
        {ticker}
      </div>
    </section>
  );


  return (
    // Room at the bottom on phones for the floating "Add a song" bar.
    <div className="space-y-8 pb-20 pt-2 lg:pb-0">
      {hero}
      {/* Once adding closes: a recap of everything everyone added. */}
      {!data.open && <Wrapped stats={wrap(data.miles, data.runnerName, data.paceSec)} runner={runner} label="Race recap · wrapped" />}

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div ref={mapRef} className="panel order-2 scroll-mt-2 overflow-hidden">
          <CourseMap ref={courseMap} charge={charge} markers={markers} perMile={data.perMile} dragging={dragging} onSelect={setOpen} className="h-[60dvh] min-h-[380px] lg:h-[700px]" />
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

        <div className="order-1 space-y-6 lg:self-start">
        <aside ref={panelRef} className="panel scroll-mt-4 space-y-5 p-5">
          {data.open && data.total >= capacity ? (
            <div>
              <h2 className="font-display text-2xl font-bold">Every spot is taken 🎉</h2>
              <p className="mt-1 text-sm text-blush">
                All {capacity} spots on {runner}&apos;s course have a song. Tap any mile to see what&apos;s there
                {myCount ? `, including your ${myCount} ${myCount === 1 ? "pick" : "picks"}` : ""}.
              </p>
            </div>
          ) : data.open && atLimit ? (
            <div>
              <h2 className="font-display text-2xl font-bold">That&apos;s your {data.maxPerPerson} 🙌</h2>
              <p className="mt-1 text-sm text-blush">
                You&apos;ve added {myCount} songs, the most one person can add, so everyone gets a turn. Thanks for building {runner}&apos;s
                soundtrack! To swap one, tap its mile, remove it, and add another.
              </p>
            </div>
          ) : data.open ? (
            <>
              <div>
                <h2 className="font-display text-2xl font-bold">{myCount ? "Add another song" : "Add a song"}</h2>
                <p className="mt-1 text-sm text-blush">
                  {myCount ? (
                    <>
                      You&apos;ve added <strong className="text-chalk">{myCount}</strong> {myCount === 1 ? "song" : "songs"}
                      {myCount >= 3 ? " 🔥" : ""}. Keep them coming: you can add {data.maxPerPerson - myCount} more.
                    </>
                  ) : (
                    `Pick one, then drag it onto the map. Add up to ${data.maxPerPerson}.`
                  )}
                </p>
              </div>
              <SongSearch onPick={pickSong} inputId={SEARCH_ID} taken={taken} />
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
                  onDrop={(n, at) => add(n, held, at)}
                  onDiscard={() => setHeld(null)}
                />
              )}
              {!held && needs.length > 0 && (
                <div>
                  <div className="label mb-2">{needs[0].songs.length === 0 ? "These miles still need a song" : "These miles have room"}</div>
                  <ul className="space-y-1.5">
                    {needs.map((m) => (
                      <li key={m.n}>
                        <button
                          className="flex w-full items-center gap-3 rounded-xl bg-ink/20 px-3 py-2 text-left text-sm hover:bg-ink/35"
                          onClick={() => setOpen(m.n)}
                          aria-label={`Add a song to ${mileLabel(m.n)}, ${mileByN(m.n)?.title}`}
                        >
                          <ChipStack count={m.songs.length} max={data.perMile} size="sm" />
                          <span className="min-w-0 flex-1 truncate">
                            <span className="font-mono text-[10px] uppercase text-pink/70">{mileLabel(m.n)}</span>{" "}
                            <span className="font-semibold">{mileByN(m.n)?.title}</span>
                            {mileByN(m.n)?.landmark && <span className="text-butter"> ★</span>}
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-chalk">+ Add</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div>
              <h2 className="font-display text-2xl font-bold">Adding is closed</h2>
              <p className="mt-1 text-sm text-blush">Songs locked in at 6am on race morning so {runner} could download the playlist.</p>
            </div>
          )}
        </aside>
        <Feed recent={data.recent} runner={runner} offset={offset} onOpen={setOpen} />
        </div>
      </div>

      <section aria-labelledby="faq-title" className="scroll-mt-6">
        <h2 id="faq-title" className="font-display text-2xl font-bold">
          Questions friends asked
        </h2>
        <div className="mt-4 grid items-start gap-x-6 gap-y-2 lg:grid-cols-2">
          {faq({ runner, paceSec: data.paceSec, perMile: data.perMile, maxPerPerson: data.maxPerPerson, bib: data.bib, open: data.open }).map((f) => (
            <details key={f.q} className="group rounded-2xl bg-ink/25 px-4 py-3 open:bg-ink/35">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 font-semibold text-chalk [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden className="mt-0.5 shrink-0 text-pink/70 transition group-open:rotate-45">
                  ＋
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-blush">{f.a}</p>
            </details>
          ))}
        </div>
      </section>


      {openMile && (
        <MileSheet
          mile={openMile}
          eta={eta(openMile.n)}
          taken={taken}
          perMile={data.perMile}
          runner={runner}
          isOpen={data.open}
          atLimit={atLimit}
          maxPerPerson={data.maxPerPerson}
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

      <Modal
        // Once adding closes there's nothing to set up: friends go straight to the recap.
        open={howto && data.open}
        onClose={closeHowto}
        title="How it works"
        narrow
        dismissable={!!name.trim()}
        heading={
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            {data.bib && (
              <>
                <div className="shrink-0 sm:hidden">{bib("2xs", "-rotate-[4deg]")}</div>
                <div className="hidden shrink-0 sm:block">{bib("xs", "-rotate-[4deg]")}</div>
              </>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-display text-sm font-bold tracking-tight text-pink/90">
                <LogoMark size={20} /> playlist pacer
              </div>
              <h2 className="mt-1.5 font-display text-2xl font-bold leading-none tracking-tight sm:text-3xl">How it works</h2>
              <p className="mt-1.5 text-sm leading-snug text-blush">
                Add songs to {runner}&apos;s NYC Marathon playlist.
              </p>
            </div>
          </div>
        }
      >
        <ol className="space-y-3 sm:space-y-4">
          {(
            [
              ["Find a song", `One that'll get ${runner} moving.`, `Search Spotify for something that'll get ${runner} moving.`, <FindASong key="1" />],
              [
                "Drag it onto a mile",
                `Each mile holds ${data.perMile}. First come, first served.`,
                `Drop it on a marker on ${runner}'s course, like the Queensboro Bridge or mile 20 in the Bronx. Each mile holds ${data.perMile} songs, first come, first served.`,
                <DragOntoAMile key="2" />,
              ],
              [
                `${runner} hears it out there`,
                "Right at that mile, on race day.",
                `Every song goes into ${runner}'s race-day playlist in course order. Add up to ${data.maxPerPerson} of your own: there are ${capacity} spots to fill.`,
                <HearItOutThere key="3" />,
              ],
            ] as const
          ).map(([t, short, long, art], i) => (
            <li key={t} className="flex items-center gap-3 sm:gap-4">
              {art}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-pink font-display text-sm font-bold text-ink">{i + 1}</span>
                  <span className="font-display text-lg font-bold leading-tight sm:text-xl">{t}</span>
                </div>
                <p className="mt-0.5 text-sm leading-snug text-blush">
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{long}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
        {/* What the live feed looks like, so it's clear other people are already doing this. */}
        <div className="mt-4 hidden rounded-2xl bg-ink/25 px-3 pb-1.5 pt-3 sm:block" aria-label="Live feed preview">
          <FeedLabel />
          {data.recent.length ? (
            <FeedTicker recent={data.recent} runner={runner} offset={offset} />
          ) : (
            <p className="px-2 py-1 text-sm text-pink/60">No songs yet. Yours could be the first!</p>
          )}
        </div>
        <form
          className="sticky -bottom-5 z-10 -mx-5 -mb-5 mt-4 border-t border-pink/15 bg-ink-2 px-5 pb-5 pt-4 sm:-bottom-7 sm:-mx-7 sm:-mb-7 sm:mt-5 sm:px-7 sm:pb-7"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            welcome();
            closeHowto();
          }}
        >
          <div className="label mb-1 text-mint">Get started</div>
          <label htmlFor="welcome-name" className="block font-display text-xl font-bold">
            First, what&apos;s your name?
          </label>
          <p className="mb-3 text-sm text-blush">So {runner} knows who picked each song.</p>
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

      <Toast message={toast} actions={toastActions} onDone={() => say(null)} />
      <SearchBar
        show={phone && data.open && data.total < capacity && !atLimit && !held && !panelVisible && !open && !howto && !toast && !sheet}
        label={myCount ? "Add another song" : "Add a song"}
        left={capacity - data.total}
        onClick={openSheet}
      />
      {phone && data.open && (
        <SearchSheet ref={sheetRef} open={sheet} label={myCount ? "Add another song" : "Add a song"} taken={taken} onClose={() => setSheet(false)} onPick={(s) => {
          setSheet(false);
          (document.activeElement as HTMLElement | null)?.blur();
          pickSong(s);
        }} />
      )}
      {flight &&
        createPortal(
          <motion.div
            key={flight.key}
            aria-hidden
            className="pointer-events-none fixed left-0 top-0 z-[80] flex max-w-[240px] items-center gap-2 rounded-full bg-pink py-1 pl-1 pr-3 text-ink shadow-[0_14px_30px_rgb(8_10_40/0.55)] ring-2 ring-chalk"
            initial={{ x: flight.from.x - 40, y: flight.from.y - 24, scale: 1, opacity: 1 }}
            animate={{ x: flight.to.x - 40, y: flight.to.y - 24, scale: 0.15, opacity: 0.3 }}
            transition={{ duration: 0.5, ease: [0.5, 0, 0.75, 0] }}
            onAnimationComplete={() => setFlight(null)}
            style={{ transformOrigin: "40px 24px" }}
          >
            <ChipFace song={flight.song} small />
          </motion.div>,
          document.body,
        )}
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
  onDrop(n: number, at?: { x: number; y: number }): void;
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
            if (d?.active && d.target !== null) onDrop(d.target, { x: d.lastX, y: d.lastY });
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

/** True on phone-sized screens (where the map sits below the search box). */
function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(max-width: 1023px)");
    const set = () => setPhone(q.matches);
    set();
    q.addEventListener("change", set);
    return () => q.removeEventListener("change", set);
  }, []);
  return phone;
}

/** Phones only: once the search box has scrolled away, a search bar floats at the bottom of the screen. */
function SearchBar({ show, label, left, onClick }: { show: boolean; label: string; left: number; onClick(): void }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
        >
          <button
            onClick={onClick}
            aria-label={label}
            className="flex w-full items-center gap-3 rounded-full bg-chalk py-2 pl-4 pr-2 text-left text-ink shadow-[0_-6px_30px_rgb(8_10_40/0.55)] ring-2 ring-pink"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" aria-hidden>
              <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M13 13l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="min-w-0 flex-1 truncate text-[15px] text-ink/60">Search for a song…</span>
            <span className="shrink-0 rounded-full bg-ink px-3 py-1.5 font-mono text-[10px] uppercase text-pink">{left} left</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Phones: search over the whole screen, so you never leave the map to find a song. */
function SearchSheet({
  ref,
  open,
  label,
  taken,
  onPick,
  onClose,
}: {
  ref: React.Ref<HTMLDivElement>;
  open: boolean;
  label: string;
  taken: Map<string, number>;
  onPick(s: Song): void;
  onClose(): void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <div
      ref={ref}
      inert={!open}
      role="dialog"
      aria-modal
      aria-label={label}
      aria-hidden={!open}
      className={`fixed inset-x-0 top-0 z-[60] flex h-[100dvh] flex-col bg-ink-2 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] transition duration-300 ease-out lg:hidden ${
        open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="font-display text-2xl font-bold">{label}</h2>
        <button onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-pink/30 text-lg" aria-label="Close search">
          ✕
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SongSearch onPick={onPick} inputId={SHEET_SEARCH_ID} taken={taken} />
      </div>
    </div>
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

function MileSheet({
  mile,
  eta,
  taken,
  perMile,
  runner,
  isOpen,
  atLimit,
  maxPerPerson,
  held,
  mine,
  busy,
  onAdd,
  onRemove,
  onClose,
}: {
  mile: MileData;
  eta: string;
  taken: Map<string, number>;
  perMile: number;
  runner: string;
  isOpen: boolean;
  /** This device has added as many songs as one person can. */
  atLimit: boolean;
  maxPerPerson: number;
  held: Song | null;
  mine: Record<string, string>;
  busy: boolean;
  onAdd(song: Song): void;
  onRemove(entry: Entry): void;
  onClose(): void;
}) {
  const info = mileByN(mile.n)!;
  const room = perMile - mile.songs.length;
  const preview = usePreview();
  return (
    <Modal open onClose={onClose} title={`${mileLabel(mile.n)} · ${info.title}`}>
      <div className="flex items-start gap-5">
        <ChipStack count={mile.songs.length} max={perMile} size="lg" className="pt-1" />
        <div className="min-w-0">
          <p className="text-blush">{info.note}</p>
          <p className="mt-1 text-sm text-chalk">
            {runner} {mile.n === 0 ? "starts" : mile.n === 26 ? "starts the final stretch" : "passes here"} around {eta}
          </p>
          <p className="mt-2 font-mono text-[11px] uppercase">
            {mile.songs.length} of {perMile} songs · {room > 0 ? `${room} ${room === 1 ? "spot" : "spots"} open` : "full"}
          </p>
        </div>
      </div>

      <ol className="mt-5 space-y-2">
        {mile.songs.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-ink/25 p-2 pr-3">
            {e.song.art && e.song.spotifyId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.song.art} alt="" className="h-12 w-12 shrink-0 rounded-[4px] object-cover" />
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
              <button
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  preview.playing(e.song) || preview.embedFor(e.song) ? "border-chalk bg-chalk text-ink" : "border-pink/30 hover:border-pink"
                }`}
                aria-label={`${preview.playing(e.song) || preview.embedFor(e.song) ? "Stop preview of" : "Preview"} ${e.song.title}`}
                onClick={() => preview.toggle(e.song)}
              >
                {preview.loading(e.song) ? "Loading…" : preview.playing(e.song) ? "❚❚ Stop" : preview.embedFor(e.song) ? "Hide" : "▶ Preview"}
              </button>
            )}
            {mine[e.id] && isOpen && (
              <button className="shrink-0 text-xs text-pink/60 underline hover:text-pink" onClick={() => onRemove(e)}>
                Remove mine
              </button>
            )}
            {preview.embedFor(e.song) && e.song.spotifyId && (
              <SpotifyPlayer
                id={e.song.spotifyId}
                title={`Preview ${e.song.title} on Spotify`}
                autoPlay={preview.embedFor(e.song)!.auto}
                className="mt-1 basis-full"
              />
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
          {atLimit ? (
            <p className="text-sm text-blush">
              You&apos;ve added {maxPerPerson} songs, the most one person can add. To swap one in here, remove one of yours first.
            </p>
          ) : held ? (
            <button className="btn w-full bg-pink px-6 py-3.5 text-base" disabled={busy} onClick={() => onAdd(held)}>
              Add “{held.title}” here
            </button>
          ) : (
            <>
              <div className="label mb-2">Add a song to {mileInSentence(mile.n)}</div>
              <SongSearch onPick={onAdd} taken={taken} />
            </>
          )}
        </div>
      )}

      <CoachNotes mile={mile.n} />
    </Modal>
  );
}

/** The coach's notes on what's happening around this mile: the first paragraph, with the rest a tap away. */
function CoachNotes({ mile }: { mile: number }) {
  const notes = COURSE_NOTES[mile];
  const [more, setMore] = useState(false);
  if (!notes?.length) return null;
  const shown = more ? notes : notes.slice(0, 1);
  return (
    <section className="mt-6 border-t border-pink/15 pt-5" aria-label="Coach's notes">
      <div className="label mb-2">From the coach</div>
      <div className="space-y-3 text-sm leading-relaxed text-blush/90">
        {shown.map((p) => (
          <p key={p.slice(0, 32)}>{p}</p>
        ))}
      </div>
      {notes.length > 1 && (
        <button className="mt-2 text-sm font-semibold underline underline-offset-4 hover:text-chalk" onClick={() => setMore(!more)}>
          {more ? "Show less" : "Read more"}
        </button>
      )}
      <p className="mt-3 font-mono text-[10px] text-pink/50">{COURSE_NOTES_CREDIT}</p>
    </section>
  );
}

/** "Matt starts at 9:10 AM (Wave 1), runs about 11:00 a mile and should finish around 1:58 PM", plus live tracking. */
function RaceLine({ runner, start, paceSec, bib }: { runner: string; start: Date; paceSec: number; bib?: string }) {
  const wave = waveLabel(startHhmm(start));
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
      <p className="text-blush">
        {runner} starts at {fmtTimeOfDay(start)}
        {wave ? ` (${wave})` : ""}, runs about {fmtPace(paceSec)} a mile, and should finish around {fmtTimeOfDay(finishEta(start, paceSec))}.
      </p>
      {bib && (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a href="https://liveresults.nyrr.org" target="_blank" rel="noreferrer" className="btn btn-ghost px-4 py-2 text-sm">
            Track {runner} live · bib {bib}
          </a>
          <span className="text-xs text-pink/60">Search bib {bib} at liveresults.nyrr.org or in the TCS NYC Marathon app.</span>
        </span>
      )}
    </div>
  );
}

/** Ticks every 30 seconds, on the server's clock. */
function useServerNow(offset: number) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset);
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [offset]);
  return now;
}

/** "Adding closes in 1 day, 4 hrs". */
function Countdown({ closesAt, offset }: { closesAt: string; offset: number }) {
  const now = useServerNow(offset);
  if (now === null) return null;
  const mins = Math.max(0, Math.floor((new Date(closesAt).getTime() - now) / 60_000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  const left = d ? `${d} ${d === 1 ? "day" : "days"}, ${h} ${h === 1 ? "hr" : "hrs"}` : h ? `${h} ${h === 1 ? "hr" : "hrs"}, ${m} min` : `${m} min`;
  return <span className={mins < 180 ? "text-butter" : ""}>Adding closes in {left}</span>;
}

const ago = (ms: number) => {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
};

/** "Sarah added “Juice” to mile 7 · 5 min ago", cycling through the latest few. */
function Activity({ recent, runner, offset }: { recent: RegistryData["recent"]; runner: string; offset: number }) {
  const now = useServerNow(offset);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (recent.length < 2) return;
    const t = setInterval(() => setI((x) => x + 1), 4500);
    return () => clearInterval(t);
  }, [recent.length]);
  if (!recent.length || now === null) return null;
  const r = recent[i % recent.length];
  const who = r.from ?? (r.isRunner ? runner : "Someone");
  return (
    <p className="mt-3 truncate text-sm text-blush" aria-live="polite">
      <span aria-hidden>🎵 </span>
      <strong className="font-semibold text-chalk">{who}</strong> added “{r.title}” to {mileInSentence(r.mile)}
      <span className="text-pink/60"> · {ago(now - new Date(r.at).getTime())}</span>
    </p>
  );
}

/** Desktop: the latest songs in a card beside the map. New ones slide in; click one to open its mile. */
function Feed({ recent, runner, offset, onOpen }: { recent: RegistryData["recent"]; runner: string; offset: number; onOpen(n: number): void }) {
  return (
    <section className="panel hidden p-5 lg:block" aria-label="Live feed">
      <FeedLabel />
      {recent.length === 0 ? <p className="text-sm text-pink/60">No songs yet. Be the first!</p> : <FeedRows recent={recent} runner={runner} offset={offset} onOpen={onOpen} />}
    </section>
  );
}

function FeedLabel() {
  return (
    <div className="label mb-3 flex items-center gap-2">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
      </span>
      <span>
        Live feed <span className="text-pink/60">– see what others are adding</span>
      </span>
    </div>
  );
}

const TICK_MS = 2600;

/** A feed entry as a song, for previews. */
const feedSong = (r: RegistryData["recent"][number]): Song => ({ title: r.title, artist: r.artist, spotifyId: r.spotifyId ?? undefined, art: r.art ?? undefined });

/** Two of the latest songs at a time, rolling through the rest: the welcome popup's peek at the live feed. */
function FeedTicker({ recent, runner, offset }: { recent: RegistryData["recent"]; runner: string; offset: number }) {
  const [i, setI] = useState(0);
  const roll = recent.length > 2;
  useEffect(() => {
    if (!roll || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => n + 1), TICK_MS);
    return () => clearInterval(t);
  }, [roll]);
  const shown = roll ? [recent[i % recent.length], recent[(i + 1) % recent.length]] : recent;
  return (
    <div className="h-[84px] overflow-hidden">
      <FeedRows recent={shown} runner={runner} offset={offset} compact rolling />
    </div>
  );
}

/** The latest songs. `onOpen` makes each one open its mile. */
function FeedRows({
  recent,
  runner,
  offset,
  onOpen,
  compact = false,
  rolling = false,
}: {
  recent: RegistryData["recent"];
  runner: string;
  offset: number;
  onOpen?(n: number): void;
  /** Smaller art, one line each. */
  compact?: boolean;
  /** Songs slide up and out as the next ones roll in. */
  rolling?: boolean;
}) {
  const now = useServerNow(offset);
  const preview = usePreview();
  return (
        <ol className={compact ? "space-y-0.5" : "space-y-1"}>
          <AnimatePresence initial={false} mode={rolling ? "popLayout" : "sync"}>
            {recent.map((r) => (
              <motion.li
                key={r.id}
                layout
                initial={rolling ? { opacity: 0, y: 28 } : { opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={rolling ? { opacity: 0, y: -28 } : { opacity: 0 }}
                transition={{ duration: rolling ? 0.45 : 0.3, ease: "easeOut" }}
              >
                <div className={`flex items-center gap-3 rounded-xl px-2 hover:bg-ink/25 ${compact ? "py-1" : "py-1.5"}`}>
                  {r.art ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.art} alt="" className={`shrink-0 rounded-[4px] object-cover ${compact ? "h-8 w-8" : "h-10 w-10"}`} />
                  ) : (
                    <span aria-hidden className={`grid shrink-0 place-items-center rounded-[4px] bg-ink-3 ${compact ? "h-8 w-8" : "h-10 w-10"}`}>♪</span>
                  )}
                  {(() => {
                    const body = (
                      <>
                        <span className={compact ? "line-clamp-1" : "line-clamp-2"}>
                          <strong className="font-semibold text-chalk">{r.from ?? (r.isRunner ? runner : "Someone")}</strong> added “{r.title}” to{" "}
                          {mileInSentence(r.mile)}
                        </span>
                        {now !== null && <span className={`font-mono text-[10px] text-pink/50 ${compact ? "hidden" : "block"}`}>{ago(now - new Date(r.at).getTime())}</span>}
                      </>
                    );
                    return onOpen ? (
                      <button className="min-w-0 flex-1 text-left text-sm leading-snug" onClick={() => onOpen(r.mile)}>
                        {body}
                      </button>
                    ) : (
                      <div className="min-w-0 flex-1 text-sm leading-snug">{body}</div>
                    );
                  })()}
                  {r.spotifyId && !compact && <PreviewButton song={feedSong(r)} preview={preview} size="sm" />}
                </div>
                {!compact && r.spotifyId && preview.embedFor(feedSong(r)) && (
                  <SpotifyPlayer id={r.spotifyId} title={`Preview ${r.title} on Spotify`} autoPlay={preview.embedFor(feedSong(r))!.auto} className="mt-1" />
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
  );
}
