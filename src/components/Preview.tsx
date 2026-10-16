"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BeatBox } from "@/lib/beat";
import { confetti } from "@/lib/confetti";
import { fmtClock, toUnits } from "@/lib/format";
import { loadEmbedApi, type EmbedController } from "@/lib/spotifyEmbed";
import type { Landmark } from "@/lib/types";
import type { Plan } from "@/lib/usePlan";
import { CourseMap } from "./CourseMap";
import { Strip } from "./Strip";
import { Segmented } from "./ui";

/** Fly the course: each song gets a few seconds, the runner moves through its miles. */
export function Preview({ plan, onClose }: { plan: Plan; onClose(): void }) {
  const race = useMemo(() => plan.segments.filter((s) => s.phase === "race" && s.endD > s.startD), [plan.segments]);
  const [idx, setIdx] = useState(0);
  const [prog, setProg] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [secs, setSecs] = useState<"4" | "7" | "12">("7");
  const [muted, setMuted] = useState(false);
  const [toast, setToast] = useState<Landmark | null>(null);
  const [done, setDone] = useState(false);

  const beat = useRef<BeatBox | null>(null);
  const embedBox = useRef<HTMLDivElement>(null);
  const embed = useRef<EmbedController | null>(null);
  const seenLandmarks = useRef(new Set<string>());
  const hasSpotify = race.some((s) => s.track.uri);

  const seg = race[idx];
  const runnerD = seg ? seg.startD + (seg.endD - seg.startD) * prog : plan.course.distance;
  const u = plan.settings.units;

  // Audio engines.
  useEffect(() => {
    beat.current = new BeatBox();
    if (hasSpotify) {
      loadEmbedApi()
        .then((api) => {
          if (!embedBox.current) return;
          const first = race.find((s) => s.track.uri)!.track.uri!;
          api.createController(embedBox.current, { uri: first, width: "100%", height: 80 }, (c) => (embed.current = c));
        })
        .catch(() => {});
    }
    return () => {
      beat.current?.close();
      embed.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Song change → switch audio.
  useEffect(() => {
    if (!seg) return;
    const b = beat.current;
    if (seg.track.uri && embed.current) {
      b?.stop();
      embed.current.loadUri(seg.track.uri, false, 45);
      if (playing) embed.current.play();
    } else if (b) {
      embed.current?.pause();
      b.bpm = seg.track.bpm ?? 120;
      if (playing) b.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  useEffect(() => {
    if (!playing) {
      beat.current?.stop();
      embed.current?.pause();
    } else if (seg) {
      if (seg.track.uri && embed.current) embed.current.resume();
      else beat.current?.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  useEffect(() => {
    if (beat.current) beat.current.muted = muted;
  }, [muted]);

  // Clock. Refs keep the rAF loop free of side effects inside state updaters.
  const pos = useRef({ idx: 0, prog: 0 });
  useEffect(() => {
    pos.current = { idx, prog };
  }, [idx, prog]);
  useEffect(() => {
    if (!playing || done) return;
    let last = performance.now();
    let raf = 0;
    const per = Number(secs) * 1000;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const { idx: i, prog: p } = pos.current;
      const np = p + dt / per;
      if (np < 1) {
        pos.current = { idx: i, prog: np };
        setProg(np);
      } else if (i + 1 < race.length) {
        pos.current = { idx: i + 1, prog: 0 };
        setIdx(i + 1);
        setProg(0);
      } else {
        setProg(1);
        setDone(true);
        setPlaying(false);
        confetti();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, secs, race.length, done]);

  // Landmark pop-ups.
  useEffect(() => {
    for (const l of plan.course.landmarks) {
      if (runnerD >= l.d && !seenLandmarks.current.has(l.name)) {
        seenLandmarks.current.add(l.name);
        setToast(l);
        const t = setTimeout(() => setToast((x) => (x === l ? null : x)), 3200);
        return () => clearTimeout(t);
      }
    }
  }, [runnerD, plan.course.landmarks]);

  const jump = (d: number) => {
    setDone(false);
    const next = Math.max(0, Math.min(race.length - 1, pos.current.idx + d));
    pos.current = { idx: next, prog: 0 };
    setIdx(next);
    setProg(0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
      if (e.key === "ArrowRight") jump(1);
      if (e.key === "ArrowLeft") jump(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });


  const isKick = seg?.track.key === plan.settings.kickKey;

  return (
    <motion.div className="fixed inset-0 z-50 flex flex-col bg-ink" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="relative min-h-0 flex-1">
        <CourseMap plan={plan} selectedKey={seg?.track.key ?? null} onSelect={() => {}} runnerD={runnerD} follow controls={false} className="absolute inset-0" />

        {/* HUD */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-6">
          <div className="stk bg-acid px-4 py-2" style={{ ["--sh" as string]: "#000" }}>
            <div className="font-display text-[10px] font-black uppercase tracking-widest">{u}</div>
            <div className="font-display text-4xl font-black tabular-nums leading-none sm:text-6xl">{toUnits(runnerD, u).toFixed(1)}</div>
          </div>
          <div className="stk bg-paper px-4 py-2 text-right">
            <div className="font-display text-[10px] font-black uppercase tracking-widest">race clock</div>
            <div className="font-display text-2xl font-black tabular-nums leading-none sm:text-4xl">{fmtClock(plan.model.timeAt(runnerD), true)}</div>
          </div>
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.name}
              className="stk absolute left-1/2 top-28 w-[min(92vw,420px)] -translate-x-1/2 bg-sun px-4 py-3 sm:top-32"
              initial={{ y: -20, opacity: 0, rotate: -3 }}
              animate={{ y: 0, opacity: 1, rotate: 1 }}
              exit={{ y: -20, opacity: 0 }}
            >
              <div className="font-display text-lg font-black uppercase">
                {toast.emoji} {toast.name}
              </div>
              <div className="text-sm font-semibold">{toast.vibe}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {done && (
          <div className="absolute inset-0 grid place-items-center bg-black/50">
            <div className="stk -rotate-2 bg-hot p-8 text-center">
              <div className="font-display text-5xl font-black">🏁 FINISHED</div>
              <p className="mt-2 font-bold">{fmtClock(plan.model.goal, true)} of perfectly timed bangers.</p>
              <div className="mt-4 flex justify-center gap-3">
                <button
                  className="btn bg-paper px-5 py-2 text-xs"
                  onClick={() => {
                    seenLandmarks.current.clear();
                    setDone(false);
                    pos.current = { idx: 0, prog: 0 };
                    setIdx(0);
                    setProg(0);
                    setPlaying(true);
                  }}
                >
                  ↺ again
                </button>
                <button className="btn bg-acid px-5 py-2 text-xs" onClick={onClose}>
                  done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Now playing deck */}
      <div className="border-t-[3px] border-black bg-ink-2 p-3 sm:p-5">
        <div className="mx-auto max-w-6xl">
          <div className="hidden md:block">
            <Strip plan={plan} selectedKey={seg?.track.key ?? null} onSelect={() => {}} runnerD={runnerD} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <motion.div
              key={seg?.track.key}
              initial={{ scale: 0.6, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-[3px] border-black sm:h-20 sm:w-20"
              style={{ background: seg?.color }}
            >
              {seg?.track.art ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={seg.track.art} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full place-items-center text-3xl">{isKick ? "⚡" : "♪"}</span>
              )}
            </motion.div>
            <div className="min-w-0 flex-1">
              {isKick && <div className="font-display text-xs font-black uppercase text-acid">⚡ THE KICK ⚡</div>}
              <div className="truncate font-display text-xl font-black sm:text-2xl">{seg?.track.title}</div>
              <div className="truncate text-sm text-paper/60">
                {seg?.track.artist} · <span className="font-mono">{seg?.track.bpm ?? "?"} bpm</span> · song {idx + 1}/{race.length}
              </div>
            </div>
            <div className={hasSpotify ? "w-full sm:w-72" : "hidden"} ref={embedBox} />
            <div className="flex items-center gap-2">
              <button className="grid h-11 w-11 place-items-center rounded-full border-2 border-paper/20 hover:border-paper" onClick={() => jump(-1)} aria-label="Previous song">
                ⏮
              </button>
              <button className="btn h-14 w-14 bg-acid text-xl" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
                {playing ? "❚❚" : "▶"}
              </button>
              <button className="grid h-11 w-11 place-items-center rounded-full border-2 border-paper/20 hover:border-paper" onClick={() => jump(1)} aria-label="Next song">
                ⏭
              </button>
              <button className="grid h-11 w-11 place-items-center rounded-full border-2 border-paper/20 hover:border-paper" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"}>
                {muted ? "🔇" : "🔊"}
              </button>
            </div>
            <Segmented
              label="seconds per song"
              size="sm"
              value={secs}
              onChange={setSecs}
              options={[
                { value: "4", label: "4s" },
                { value: "7", label: "7s" },
                { value: "12", label: "12s" },
              ]}
            />
            <button className="btn bg-hot px-5 py-2.5 text-xs" onClick={onClose}>
              exit ✕
            </button>
          </div>
          {!hasSpotify && <p className="mt-2 text-xs text-paper/40">🥁 Sample/CSV songs play a synth beat at each song&apos;s BPM — feel the ramp. Import from Spotify for the real tracks.</p>}
        </div>
      </div>
    </motion.div>
  );
}
