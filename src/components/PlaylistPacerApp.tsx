"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { fmtDist } from "@/lib/format";
import { elevationGain } from "@/lib/geo";
import { useKD } from "@/lib/store";
import { usePlan, type Plan } from "@/lib/usePlan";
import { CourseMap } from "./CourseMap";
import { CourseModal, type Tab as CourseTab } from "./CourseModal";
import { DropReport } from "./DropReport";
import { GoalBar, NerdSettings } from "./GoalBar";
import { Hero } from "./Hero";
import { PlaylistModal, type Tab as PlaylistTab } from "./PlaylistModal";
import { Preview } from "./Preview";
import { ShareModal } from "./ShareCard";
import { SongList } from "./SongList";
import { Strip } from "./Strip";
import { Marquee, Toast } from "./ui";

const TICKER = [
  "Queensboro Bridge is silent. your playlist shouldn't be",
  "save a banger for Harlem Hill",
  "9+1 grindset",
  "don't go out too fast (you will)",
  "the Bronx gets one mile. make it count",
  "first ave is a wall of sound",
  "negative split or negative vibes",
  "Gu at mile 6, 12, 18. banger at 20",
  "BQ or bust",
];

export function PlaylistPacerApp() {
  // Plan lives in localStorage, so render it only on the client.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [courseOpen, setCourseOpen] = useState<CourseTab | false>(false);
  const [playlistOpen, setPlaylistOpen] = useState<PlaylistTab | false>(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const plan = usePlan();
  const tracks = useKD((s) => s.tracks);
  const playlistName = useKD((s) => s.playlistName);
  const notify = useCallback((m: string) => setToast(m), []);
  const clearToast = useCallback(() => setToast(null), []);

  // One-time read of OAuth redirect params (?strava=…, ?spotify=…).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const strava = q.get("strava");
    if (strava === "connected") {
      setToast("🧡 Strava connected. Pick a run.");
      setCourseOpen("strava");
    } else if (strava) {
      setToast(
        {
          denied: "Strava connection cancelled.",
          scope: "We need activity access to read your runs — try again and tick the box.",
          "not-configured": "Strava API isn't configured on this server.",
          error: "Strava hiccuped. Try again?",
        }[strava] ?? "Strava: something went sideways.",
      );
    }
    if (q.get("spotify") === "connected") {
      setToast("💚 Spotify connected. Pick a playlist.");
      setPlaylistOpen("spotify");
    }
    if (strava || q.get("spotify")) window.history.replaceState(null, "", "/");
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const ready = mounted && plan && tracks.length > 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <Marquee items={TICKER} className="bg-ink-2 text-acid/80" />

      <header className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="mr-auto flex items-center gap-2.5" aria-label="Playlist Pacer home">
          <span className="grid h-10 w-10 place-items-center rounded-xl border-2 border-black bg-acid text-lg text-ink">▶</span>
          <span className="font-display text-xl font-black uppercase tracking-tight sm:text-2xl">
            Playlist <span className="text-acid">Pacer</span>
          </span>
        </Link>
        {ready && (
          <>
            <button onClick={() => setCourseOpen("presets")} className="chip max-w-56 border-paper/25 py-1.5 text-paper/80 hover:border-ice hover:text-ice">
              🗺️ <span className="truncate">{plan.course.name}</span>
            </button>
            <button onClick={() => setPlaylistOpen("spotify")} className="chip max-w-56 border-paper/25 py-1.5 text-paper/80 hover:border-hot hover:text-hot">
              🎧 <span className="truncate">{playlistName || "playlist"}</span>
            </button>
            <button className="btn bg-acid px-5 py-2.5 text-xs" onClick={() => setPreviewing(true)}>
              ▶ Preview course
            </button>
            <button className="btn bg-sun px-5 py-2.5 text-xs" onClick={() => setShareOpen(true)}>
              Share
            </button>
          </>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 pb-16 sm:px-6">
        {!mounted ? (
          <div className="grid h-[60vh] place-items-center font-display text-xl font-black uppercase text-paper/30">lacing up…</div>
        ) : ready ? (
          <PlanView plan={plan} />
        ) : (
          <Hero onCourse={() => setCourseOpen("presets")} onPlaylist={() => setPlaylistOpen("spotify")} />
        )}
      </main>

      <footer className="border-t-2 border-paper/10 px-6 py-6 text-center text-xs text-paper/40">
        made for the 5am Central Park loop crowd · not affiliated with NYRR, Spotify or Strava · your data stays in your browser
      </footer>

      <CourseModal tab={courseOpen} setTab={setCourseOpen} notify={notify} />
      <PlaylistModal tab={playlistOpen} setTab={setPlaylistOpen} notify={notify} />
      {ready && <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} plan={plan} notify={notify} />}
      <AnimatePresence>{ready && previewing && <Preview plan={plan} onClose={() => setPreviewing(false)} />}</AnimatePresence>
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}

function PlanView({ plan }: { plan: Plan }) {
  const selectedKey = useKD((s) => s.selectedKey);
  const select = useKD((s) => s.select);
  const [nerd, setNerd] = useState(false);
  const u = plan.settings.units;
  const gain = elevationGain(plan.course);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <section className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <GoalBar plan={plan} />
          <button onClick={() => setNerd(!nerd)} className={`chip py-1.5 ${nerd ? "border-acid text-acid" : "border-paper/25 text-paper/70 hover:text-paper"}`} aria-expanded={nerd}>
            ⚙️ nerd settings {nerd ? "▴" : "▾"}
          </button>
        </div>
        <AnimatePresence initial={false}>
          {nerd && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-5 border-t-2 border-paper/10 pt-5">
                <NerdSettings plan={plan} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="min-w-0 space-y-6">
          <section className="panel relative overflow-hidden">
            <CourseMap plan={plan} selectedKey={selectedKey} onSelect={select} className="relative h-[340px] sm:h-[460px]" />
            <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
              <span className="rounded-full border-2 border-black bg-paper px-3 py-1 font-display text-xs font-black uppercase text-ink shadow-[2px_2px_0_#000]">
                {plan.course.name}
              </span>
              <span className="rounded-full border-2 border-black bg-ink px-3 py-1 font-mono text-xs font-bold shadow-[2px_2px_0_#000]">
                {fmtDist(plan.course.distance, u)} {u} · ↗ {Math.round(gain)} m
              </span>
              {plan.course.approximate && (
                <span className="rounded-full border-2 border-black bg-sun px-3 py-1 text-[10px] font-black uppercase text-ink shadow-[2px_2px_0_#000]">
                  ≈ hand-traced
                </span>
              )}
              {plan.settings.strategy === "ghost" && (
                <span className="rounded-full border-2 border-black bg-lilac px-3 py-1 text-[10px] font-black uppercase text-ink shadow-[2px_2px_0_#000]">
                  👻 ghost pacing
                </span>
              )}
            </div>
          </section>

          <section className="panel p-4 sm:p-5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-black uppercase">The strip</h2>
              <span className="text-xs text-paper/50">every song, painted onto the miles it covers · hover to scrub · click to select</span>
            </div>
            <Strip plan={plan} selectedKey={selectedKey} onSelect={select} />
          </section>

          <DropReport plan={plan} />
        </div>

        <aside className="panel flex max-h-none flex-col self-start p-3 sm:p-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)]">
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="font-display text-lg font-black uppercase">Setlist</h2>
            <span className="font-mono text-xs text-paper/50">{plan.tracks.length} songs · drag to reorder</span>
          </div>
          <div className="-mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
            <SongList plan={plan} />
          </div>
        </aside>
      </div>
    </motion.div>
  );
}
