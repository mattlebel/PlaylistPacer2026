"use client";

import { motion } from "motion/react";
import { fmtDist } from "@/lib/format";
import { useKD } from "@/lib/store";
import { GoalInput } from "./GoalBar";

const FEATURES = [
  { e: "👻", t: "Ghost pacing", d: "Import last year's race from Strava and replay how you actually ran it — slowing on the bridges and all — scaled to your new goal.", c: "text-lilac" },
  { e: "📈", t: "BPM ramp", d: "Easy tempo early, fast songs late. One tap sorts slow → fast and keeps your finisher where it belongs.", c: "text-hot" },
  { e: "🎯", t: "Kick lander", d: "Pick your finishing song and where it should start. See if it lands early or late, and fix it in one click.", c: "text-acid" },
  { e: "🗺️", t: "Landmark radar", d: "Know what's playing on the Queensboro Bridge, First Ave, Harlem Hill and the boardwalk.", c: "text-ice" },
  { e: "▶️", t: "Course preview", d: "Watch a runner dot move along the course while each song plays.", c: "text-tang" },
  { e: "🧠", t: "Real-race math", d: "Crossfade, corral wait, hill-adjusted or negative-split pacing, and your watch's extra 0.3 miles.", c: "text-sun" },
];

export function Hero({ onCourse, onPlaylist }: { onCourse(): void; onPlaylist(): void }) {
  const course = useKD((s) => s.course);
  const tracks = useKD((s) => s.tracks);
  const playlistName = useKD((s) => s.playlistName);
  const units = useKD((s) => s.settings.units);
  const loadDemo = useKD((s) => s.loadDemo);

  return (
    <div className="space-y-16 pt-8 sm:pt-12">
      <section className="mx-auto max-w-4xl text-center">
        <motion.h1
          className="font-display text-[12vw] font-black uppercase leading-[0.9] tracking-tight sm:text-[6.5rem]"
          initial="h"
          animate="s"
          variants={{ s: { transition: { staggerChildren: 0.1 } } }}
        >
          {[
            ["time the ", "drop.", "outline-text"],
            ["own the ", "kick.", "text-acid"],
          ].map(([lead, word, cls]) => (
            <motion.span
              key={word}
              className="block"
              variants={{ h: { y: 30, opacity: 0 }, s: { y: 0, opacity: 1 } }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
            >
              {lead}
              <span className={cls}>{word}</span>
            </motion.span>
          ))}
        </motion.h1>
        <p className="mx-auto mt-7 max-w-2xl text-lg text-paper/75">
          Map your race playlist onto the actual course. Know what&apos;s playing on the Queensboro Bridge, ramp the
          tempo as the miles go by, and land your finishing song on the last half mile.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
        <StepCard
          n="01"
          title="Course"
          color="bg-ice"
          done={!!course}
          detail={course ? `${course.name} · ${fmtDist(course.distance, units, 1)} ${units}` : "NYC classics, GPX, or Strava"}
          cta={course ? "Change" : "Pick a course"}
          onClick={onCourse}
        />
        <StepCard
          n="02"
          title="Playlist"
          color="bg-hot"
          done={tracks.length > 0}
          detail={tracks.length ? `${playlistName} · ${tracks.length} songs` : "Spotify, Exportify CSV, or a sample mix"}
          cta={tracks.length ? "Change" : "Add a playlist"}
          onClick={onPlaylist}
        />
        <div className="stk flex flex-col bg-acid p-6">
          <div className="flex items-center justify-between">
            <span className="font-display text-4xl font-black">03</span>
            <span className="text-2xl">⏱️</span>
          </div>
          <div className="mt-3 font-display text-xl font-black uppercase">Goal time</div>
          <div className="mt-3 rounded-2xl bg-ink p-2 text-paper">
            <GoalInput />
          </div>
          <p className="mt-3 text-sm font-semibold">h:mm:ss — the time you&apos;re training for.</p>
        </div>
      </section>

      <section className="text-center">
        <button className="btn bg-hot px-7 py-4 text-sm sm:text-base" onClick={loadDemo}>
          Try the NYC Marathon demo
        </button>
        <p className="mt-3 text-sm text-paper/50">No login needed. 65-song sample mix, 26.2 miles, sub-4 goal.</p>
      </section>

      <section className="mx-auto max-w-6xl">
        <h2 className="mb-7 text-center font-display text-3xl font-black uppercase sm:text-4xl">What it does</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <motion.div
              key={f.t}
              className="panel p-6"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
            >
              <div className="text-3xl">{f.e}</div>
              <div className={`mt-3 font-display text-lg font-black uppercase ${f.c}`}>{f.t}</div>
              <p className="mt-2 leading-snug text-paper/75">{f.d}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StepCard({
  n,
  title,
  color,
  done,
  detail,
  cta,
  onClick,
}: {
  n: string;
  title: string;
  color: string;
  done: boolean;
  detail: string;
  cta: string;
  onClick(): void;
}) {
  return (
    <button onClick={onClick} className={`stk group flex flex-col p-6 text-left transition hover:-translate-y-0.5 ${color}`}>
      <div className="flex items-center justify-between">
        <span className="font-display text-4xl font-black">{n}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-full border-2 border-black text-base ${done ? "bg-acid" : "bg-paper"}`}>
          {done ? "✓" : "→"}
        </span>
      </div>
      <div className="mt-3 font-display text-xl font-black uppercase">{title}</div>
      <p className="mt-2 min-h-12 font-semibold leading-snug">{detail}</p>
      <span className="mt-4 inline-flex w-fit rounded-full border-2 border-black bg-paper px-4 py-1.5 font-display text-xs font-black uppercase transition group-hover:bg-ink group-hover:text-paper">
        {cta}
      </span>
    </button>
  );
}
