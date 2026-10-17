"use client";

import { motion } from "motion/react";
import { confetti } from "@/lib/confetti";
import { fmtClock, toUnits } from "@/lib/format";
import { autoRamp, moveTrack } from "@/lib/plan";
import { useKD } from "@/lib/store";
import type { Plan } from "@/lib/usePlan";

const card = "stk relative overflow-hidden p-5";
const quiet = "panel relative overflow-hidden border-t-4 p-5";

export function DropReport({ plan }: { plan: Plan }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      <KickCard plan={plan} />
      <LengthCard plan={plan} />
      <RampCard plan={plan} />
      <LandmarkCard plan={plan} />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 font-display text-[10px] font-black uppercase tracking-widest opacity-70">{children}</div>;
}

function KickCard({ plan }: { plan: Plan }) {
  const reorder = useKD((s) => s.reorder);
  const k = plan.kick;
  const u = plan.settings.units;

  if (!k) {
    return (
      <div className={card} style={{ background: "var(--color-paper)", ["--sh" as string]: "var(--color-hot)" }}>
        <Label>⚡ the kick</Label>
        <p className="font-display text-xl font-black uppercase leading-tight">no finisher picked</p>
        <p className="mt-2 text-sm">Hit ⚡ on the song you want blasting down the final stretch.</p>
      </div>
    );
  }

  const bg = k.status === "perfect" ? "var(--color-acid)" : "var(--color-hot)";
  const headline =
    k.status === "perfect" ? "LANDED 🎯" : k.status === "late" ? `${fmtClock(Math.abs(k.delta))} LATE` : `${fmtClock(Math.abs(k.delta))} EARLY`;
  const canFix = k.bestIndex !== plan.tracks.findIndex((t) => t.key === k.segment.track.key) && Math.abs(k.bestDelta) < Math.abs(k.delta) - 2;

  return (
    <motion.div layout className={card} style={{ background: bg, ["--sh" as string]: "var(--color-paper)" }}>
      <Label>⚡ the kick</Label>
      <motion.p key={headline} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="font-display text-3xl font-black leading-none">
        {headline}
      </motion.p>
      <p className="mt-3 truncate text-sm font-bold">“{k.segment.track.title}”</p>
      <p className="font-mono text-xs">
        {k.segment.phase === "race"
          ? `drops at ${toUnits(k.segment.startD, u).toFixed(2)} ${u} · target ${toUnits(Math.max(0, plan.course.distance - plan.settings.kickTargetFromEnd), u).toFixed(2)}`
          : k.segment.phase === "post"
            ? "plays after you finish"
            : "plays before the start"}
      </p>
      {k.status !== "perfect" && (
        <div className="mt-3 space-y-2">
          {canFix && (
            <button
              className="btn bg-paper px-4 py-2 text-[11px]"
              onClick={() => {
                const from = plan.tracks.findIndex((t) => t.key === k.segment.track.key);
                reorder(moveTrack(plan.tracks, from, k.bestIndex));
                if (Math.abs(k.bestDelta) <= 10) confetti();
              }}
            >
              🎯 auto-land ({fmtClock(Math.abs(k.bestDelta))} off)
            </button>
          )}
          {k.suggestion && (
            <button
              className="block w-full rounded-xl border-2 border-black bg-ink/10 px-3 py-2 text-left text-xs font-semibold leading-snug transition hover:bg-paper"
              onClick={() => {
                const fix = k.suggestion!;
                reorder(fix.apply(plan.tracks));
                if (Math.abs(fix.after) <= 10) confetti();
              }}
            >
              💡 {k.suggestion.text} → lands {fmtClock(Math.abs(k.suggestion.after))} {k.suggestion.after > 0 ? "late" : "early"}. <u>do it</u>
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

function LengthCard({ plan }: { plan: Plan }) {
  const { stats, model } = plan;
  const short = stats.shortBy > 0;
  const spare = stats.totalPlay - plan.settings.startOffsetSec - model.goal;
  return (
    <div className={quiet} style={{ borderTopColor: short ? "var(--color-tang)" : "var(--color-ice)" }}>
      <Label>⏱ playlist length</Label>
      <p className={`font-display text-3xl font-black leading-none ${short ? "text-tang" : "text-ice"}`}>{short ? `${fmtClock(stats.shortBy)} 🔇` : `+${fmtClock(spare)}`}</p>
      <p className="mt-3 text-sm font-bold">
        {short ? `of silence at the end. Add ~${Math.ceil(stats.shortBy / 210)} more songs.` : "to spare, even if the wall hits."}
      </p>
      <p className="mt-1 font-mono text-xs text-paper/60">
        {fmtClock(stats.totalPlay, true)} total · {stats.raceSongs} race songs
        {stats.corralSongs ? ` · ${stats.corralSongs} corral` : ""}
      </p>
    </div>
  );
}

function RampCard({ plan }: { plan: Plan }) {
  const reorder = useKD((s) => s.reorder);
  const { stats, segments, course } = plan;
  const race = segments.filter((s) => s.phase === "race" && s.track.bpm);
  const W = 220;
  const Hh = 56;
  const bpms = race.map((s) => s.track.bpm!);
  const lo = Math.min(80, ...bpms);
  const hi = Math.max(190, ...bpms);
  const pts = race.map((s) => [((s.startD + s.endD) / 2 / course.distance) * W, Hh - ((s.track.bpm! - lo) / (hi - lo)) * Hh]);
  const ramp = stats.openingBpm && stats.closingBpm ? stats.closingBpm - stats.openingBpm : null;

  return (
    <div className={quiet} style={{ borderTopColor: "var(--color-lilac)" }}>
      <Label>📈 bpm ramp</Label>
      <p className="font-display text-3xl font-black leading-none text-lilac">
        {ramp == null ? "??? bpm" : ramp >= 0 ? `+${ramp} bpm` : `${ramp} bpm`}
      </p>
      <svg viewBox={`0 0 ${W} ${Hh}`} className="mt-2 h-14 w-full" preserveAspectRatio="none" aria-hidden>
        {pts.length > 1 && <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="#b69cff" strokeWidth={2.5} strokeLinejoin="round" />}
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.2} fill="#b69cff" />
        ))}
      </svg>
      <p className="font-mono text-xs text-paper/60">
        {stats.openingBpm ?? "—"} → {stats.closingBpm ?? "—"} · {ramp == null ? "add BPMs" : ramp > 8 ? "slow start, fast finish" : ramp < -8 ? "tempo drops toward the finish" : "pretty flat"}
      </p>
      <button
        className="btn mt-3 bg-paper px-4 py-2 text-[11px]"
        onClick={() => reorder(autoRamp(plan.tracks, plan.settings, plan.model))}
      >
        🪄 auto-ramp
      </button>
    </div>
  );
}

function LandmarkCard({ plan }: { plan: Plan }) {
  const select = useKD((s) => s.select);
  return (
    <div className={`${quiet} md:col-span-2 xl:col-span-1`} style={{ borderTopColor: "var(--color-sun)" }}>
      <Label>📍 now playing at…</Label>
      {plan.hits.length ? (
        <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-1 text-sm">
          {plan.hits.map(({ landmark, segment }) => (
            <li key={landmark.name}>
              <button className="flex w-full items-start gap-2 text-left hover:text-sun" onClick={() => segment && select(segment.track.key)} title={landmark.vibe}>
                <span>{landmark.emoji}</span>
                <span className="min-w-0">
                  <span className="block font-bold leading-tight">{landmark.name}</span>
                  <span className="block truncate text-xs text-paper/60">{segment ? `♪ ${segment.track.title}` : "🔇 nothing"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-paper/70">No landmarks on custom courses (yet). Hover the strip to see what&apos;s playing anywhere.</p>
      )}
    </div>
  );
}
