"use client";

import { motion } from "motion/react";
import { fmtDist } from "@/lib/format";
import { useKD } from "@/lib/store";
import { GoalInput } from "./GoalBar";

// Illustrative sleeve for the hero: what the NYC demo plan looks like.
const SIDE_A = [
  ["0.0", "Empire State of Mind"],
  ["0.4", "N.Y. State of Mind"],
  ["2.1", "Dancing Queen"],
  ["5.6", "Uptown Funk"],
  ["8.3", "Juice"],
  ["10.4", "Levitating"],
  ["11.6", "Good as Hell"],
  ["12.6", "Titanium"],
];
const SIDE_B = [
  ["13.4", "Run the World (Girls)"],
  ["15.2", "Mr. Brightside"],
  ["16.2", "Dog Days Are Over"],
  ["18.1", "Shake It Off"],
  ["20.0", "Can't Hold Us"],
  ["22.8", "HUMBLE."],
  ["24.4", "Blinding Lights"],
  ["25.7", "'Till I Collapse"],
];

const FEATURES = [
  { t: "Ghost pacing", d: "Import last year's race from Strava and replay how you actually ran it, slowing on the bridges and all, scaled to your new goal." },
  { t: "Tempo that builds", d: "Sort slow to fast in one tap. Easy openers early, your fastest songs late, and your closing track stays put." },
  { t: "A closer that lands", d: "Pick your closing track and where it should start. See if it lands early or late, and fix it in one click." },
  { t: "Landmark radar", d: "Know what's playing on the Queensboro Bridge, First Ave, Harlem Hill and the Coney Island boardwalk." },
  { t: "Play the course", d: "Watch a runner move along the route while each song plays, before you ever pin on a bib." },
  { t: "Real-race math", d: "Crossfade, corral wait, hill-adjusted or negative-split pacing, and your watch's extra 0.3 miles." },
];

export function Hero({ onCourse, onPlaylist }: { onCourse(): void; onPlaylist(): void }) {
  const course = useKD((s) => s.course);
  const tracks = useKD((s) => s.tracks);
  const playlistName = useKD((s) => s.playlistName);
  const units = useKD((s) => s.settings.units);
  const loadDemo = useKD((s) => s.loadDemo);

  return (
    <div className="mx-auto max-w-6xl space-y-16 pt-6 sm:pt-10">
      <section className="flex flex-wrap items-center gap-12">
        <motion.div
          className="flex min-w-0 flex-[1_1_420px] flex-col gap-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="label">Side A: miles 0–13.1 · Side B: 13.1–26.2</div>
          <h1 className="font-display text-[clamp(3rem,7vw,5.75rem)] font-extrabold leading-[0.92] tracking-[-0.04em] [text-wrap:balance]">
            Your race, sequenced like an album.
          </h1>
          <p className="max-w-[34ch] text-xl leading-relaxed text-blush">
            Put every song on the mile where you need it. Easy openers, a bridge anthem, and a closer that hits on the
            final stretch.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <button className="btn bg-pink px-7 py-4 text-base" onClick={onCourse}>
              Sequence my race
            </button>
            <button className="btn btn-ghost px-7 py-4 text-base" onClick={loadDemo}>
              Play the NYC demo
            </button>
          </div>
        </motion.div>

        <motion.div
          className="flex min-w-0 flex-[1_1_440px] justify-center"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="relative w-full max-w-[500px] pr-[14%]">
            <motion.div
              aria-hidden
              className="absolute right-0 top-[6%] grid aspect-square w-[82%] place-items-center rounded-full"
              style={{ background: "repeating-radial-gradient(circle, #15151d 0 3px, #22222c 3px 5px)" }}
              initial={{ x: -40 }}
              animate={{ x: 0 }}
              transition={{ duration: 0.9, delay: 0.3, ease: "easeOut" }}
            >
              <span className="grid aspect-square w-[32%] place-items-center rounded-full bg-pink font-mono text-[11px] text-ink">33⅓</span>
            </motion.div>
            <div className="relative flex aspect-square flex-col gap-3 rounded-md bg-pink p-6 text-ink shadow-[0_24px_50px_rgb(8_10_40/0.35)] sm:p-7">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">NYC Marathon</span>
                <span className="font-mono text-[11px]">3:59:59</span>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-5">
                {[
                  ["Side A", SIDE_A],
                  ["Side B", SIDE_B],
                ].map(([side, list]) => (
                  <div key={side as string} className="flex min-w-0 flex-col gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-ground">{side as string}</span>
                    {(list as string[][]).map(([mi, title], i) => (
                      <div key={title} className="flex min-w-0 gap-2 text-[13px] sm:text-sm">
                        <span className="pt-0.5 font-mono text-[10px] opacity-60">{mi}</span>
                        <span className={`truncate ${side === "Side B" && i === 7 ? "font-bold" : ""}`}>{title}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="border-t border-ink/25 pt-2 font-mono text-[10px]">64 tracks · 98 → 171 bpm · closer at mile 25.7</div>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <TrackCard
          n={1}
          title="Pick the course"
          done={!!course}
          detail={course ? `${course.name} · ${fmtDist(course.distance, units, 1)} ${units}` : "NYC classics built in, GPX upload, or last year's race from Strava."}
          cta={course ? "Change course" : "Choose a course"}
          onClick={onCourse}
        />
        <TrackCard
          n={2}
          title="Load the playlist"
          done={tracks.length > 0}
          detail={tracks.length ? `${playlistName} · ${tracks.length} songs` : "Pull any of your Spotify playlists, or import an Exportify CSV."}
          cta={tracks.length ? "Change playlist" : "Add a playlist"}
          onClick={onPlaylist}
        />
        <div className="panel flex flex-col gap-3 p-6">
          <span className="label">Track 3</span>
          <h3 className="font-display text-2xl font-bold tracking-tight">Set your goal</h3>
          <GoalInput />
          <p className="text-sm text-blush">h:mm:ss, the time you&apos;re training for.</p>
        </div>
      </section>

      <section>
        <h2 className="mb-5 font-display text-3xl font-bold tracking-tight">What&apos;s on the record</h2>
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div key={f.t} className="flex gap-4">
              <span className="pt-1 font-mono text-[11px] text-pink/60">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="font-display text-lg font-bold">{f.t}</h3>
                <p className="mt-1 leading-relaxed text-blush/90">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TrackCard({
  n,
  title,
  done,
  detail,
  cta,
  onClick,
}: {
  n: number;
  title: string;
  done: boolean;
  detail: string;
  cta: string;
  onClick(): void;
}) {
  return (
    <button onClick={onClick} className="panel group flex flex-col gap-3 p-6 text-left transition hover:bg-ink/30">
      <span className="label flex items-center justify-between">
        Track {n}
        {done && <span className="rounded-full bg-pink px-2 py-0.5 text-ink opacity-100">done</span>}
      </span>
      <h3 className="font-display text-2xl font-bold tracking-tight">{title}</h3>
      <p className="min-h-12 leading-snug text-blush">{detail}</p>
      <span className="mt-1 font-semibold underline decoration-pink/40 underline-offset-4 group-hover:decoration-pink">{cta} →</span>
    </button>
  );
}
