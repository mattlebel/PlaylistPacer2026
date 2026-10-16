"use client";

import { motion } from "motion/react";
import { fmtDist } from "@/lib/format";
import { useKD } from "@/lib/store";
import { GoalInput } from "./GoalBar";
import { Stamp } from "./ui";

const STICKERS = [
  { text: "no skips", cls: "bg-hot", pos: "left-[2%] top-[6%]", r: -12 },
  { text: "PR szn 🔥", cls: "bg-acid", pos: "right-[4%] top-[2%]", r: 9 },
  { text: "BQ or bust", cls: "bg-ice", pos: "right-[10%] bottom-[18%]", r: -6 },
  { text: "9+1 grindset", cls: "bg-sun", pos: "left-[6%] bottom-[8%]", r: 7 },
];

const FEATURES = [
  { e: "👻", t: "Ghost pacing", d: "Import last year's race from Strava. We replay how you actually ran it — fade on the bridges and all — scaled to your new goal.", c: "bg-lilac" },
  { e: "📈", t: "BPM ramp", d: "Chill at the start, unhinged at the end. One tap sorts slow → fast and keeps your finisher where it belongs.", c: "bg-hot" },
  { e: "🎯", t: "Kick lander", d: "Pick your finishing banger and where it should hit. We tell you if it's early or late, and fix it.", c: "bg-acid" },
  { e: "🗺️", t: "Landmark radar", d: "Know exactly what's playing on the Queensboro Bridge, First Ave, Harlem Hill, the boardwalk.", c: "bg-ice" },
  { e: "▶️", t: "Course flythrough", d: "Watch a runner dot cruise the course while each song plays. Goosebumps guaranteed.", c: "bg-tang" },
  { e: "🧠", t: "Real-runner math", d: "Crossfade, corral wait, hill-adjusted or negative-split pacing, and your watch's extra 0.3.", c: "bg-sun" },
];

export function Hero({ onCourse, onPlaylist }: { onCourse(): void; onPlaylist(): void }) {
  const course = useKD((s) => s.course);
  const tracks = useKD((s) => s.tracks);
  const playlistName = useKD((s) => s.playlistName);
  const units = useKD((s) => s.settings.units);
  const loadDemo = useKD((s) => s.loadDemo);

  return (
    <div className="space-y-20 pt-6">
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
          {STICKERS.map((s) => (
            <motion.span
              key={s.text}
              className={`absolute ${s.pos}`}
              initial={{ scale: 0, rotate: 0 }}
              animate={{ scale: 1, rotate: s.r }}
              transition={{ type: "spring", delay: 0.4 + STICKERS.indexOf(s) * 0.12 }}
            >
              <span className="block animate-floaty" style={{ ["--r" as string]: `${s.r}deg` }}>
                <Stamp className={`${s.cls} px-4 py-2 text-xs`} rotate={0}>
                  {s.text}
                </Stamp>
              </span>
            </motion.span>
          ))}
        </div>

        <div className="relative mx-auto max-w-5xl text-center">
          <motion.h1
            className="font-display text-[15vw] font-black uppercase leading-[0.82] tracking-tighter sm:text-[9.5rem]"
            initial="h"
            animate="s"
            variants={{ s: { transition: { staggerChildren: 0.08 } } }}
          >
            {[
              ["time the", ""],
              ["drop.", "outline-text"],
              ["own the", ""],
              ["kick.", "text-acid italic"],
            ].map(([w, cls]) => (
              <motion.span
                key={w}
                className={`block ${cls}`}
                variants={{ h: { y: 80, opacity: 0, rotate: -6 }, s: { y: 0, opacity: 1, rotate: 0 } }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
              >
                {w}
              </motion.span>
            ))}
          </motion.h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg text-paper/80 sm:text-xl">
            Map your race playlist onto the actual course. Know what&apos;s playing on the Queensboro Bridge. Ramp the BPM.
            Land your finishing banger on the last half mile. <span className="text-hot">Every. Single. Time.</span>
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
        <StepCard
          n="01"
          title="Course"
          color="bg-ice"
          shadow="var(--color-hot)"
          done={!!course}
          detail={course ? `${course.name} · ${fmtDist(course.distance, units, 1)} ${units}` : "NYC classics, GPX, or Strava"}
          cta={course ? "swap" : "pick a course"}
          onClick={onCourse}
          r={-1.5}
        />
        <StepCard
          n="02"
          title="Playlist"
          color="bg-hot"
          shadow="var(--color-acid)"
          done={tracks.length > 0}
          detail={tracks.length ? `${playlistName} · ${tracks.length} songs` : "Spotify, Exportify CSV, or our sample mix"}
          cta={tracks.length ? "swap" : "bring bangers"}
          onClick={onPlaylist}
          r={1}
        />
        <div className="stk flex flex-col bg-acid p-6" style={{ ["--sh" as string]: "var(--color-ice)", transform: "rotate(-0.5deg)" }}>
          <div className="flex items-center justify-between">
            <span className="font-display text-5xl font-black">03</span>
            <span className="text-3xl">⏱️</span>
          </div>
          <div className="mt-3 font-display text-2xl font-black uppercase">Goal time</div>
          <div className="mt-3 rounded-2xl bg-ink p-2 text-paper">
            <GoalInput />
          </div>
          <p className="mt-3 text-sm font-semibold">h:mm:ss — be honest. or delulu. your call.</p>
        </div>
      </section>

      <section className="text-center">
        <button className="btn animate-floaty bg-hot px-8 py-5 text-base sm:text-lg" style={{ ["--sh" as string]: "var(--color-acid)" }} onClick={loadDemo}>
          ⚡ just show me — load the NYC Marathon demo
        </button>
        <p className="mt-4 text-sm text-paper/50">No login. 65-song sample mix, 26.2 miles, sub-4 goal.</p>
      </section>

      <section className="mx-auto max-w-6xl">
        <h2 className="mb-8 text-center font-display text-4xl font-black uppercase sm:text-6xl">
          what it <span className="outline-text">does</span>
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.t}
              className={`stk ${f.c} p-6`}
              style={{ ["--sh" as string]: "var(--color-paper)" }}
              initial={{ opacity: 0, y: 30, rotate: 0 }}
              whileInView={{ opacity: 1, y: 0, rotate: i % 2 ? 1 : -1 }}
              whileHover={{ rotate: 0, y: -6, scale: 1.02 }}
              viewport={{ once: true, margin: "-60px" }}
            >
              <div className="text-4xl">{f.e}</div>
              <div className="mt-3 font-display text-xl font-black uppercase">{f.t}</div>
              <p className="mt-2 font-medium leading-snug">{f.d}</p>
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
  shadow,
  done,
  detail,
  cta,
  onClick,
  r,
}: {
  n: string;
  title: string;
  color: string;
  shadow: string;
  done: boolean;
  detail: string;
  cta: string;
  onClick(): void;
  r: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`stk group flex flex-col p-6 text-left transition hover:-translate-y-1 ${color}`}
      style={{ ["--sh" as string]: shadow, transform: `rotate(${r}deg)` }}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-5xl font-black">{n}</span>
        <span className={`grid h-10 w-10 place-items-center rounded-full border-[3px] border-black text-lg ${done ? "bg-acid" : "bg-paper"}`}>
          {done ? "✓" : "→"}
        </span>
      </div>
      <div className="mt-3 font-display text-2xl font-black uppercase">{title}</div>
      <p className="mt-2 min-h-12 font-semibold leading-snug">{detail}</p>
      <span className="mt-4 inline-flex w-fit rounded-full border-[3px] border-black bg-paper px-4 py-1.5 font-display text-xs font-black uppercase transition group-hover:bg-ink group-hover:text-paper">
        {cta}
      </span>
    </button>
  );
}
