"use client";

import { motion } from "motion/react";
import { confetti } from "@/lib/confetti";
import { fmtClock, toUnits } from "@/lib/format";
import { autoRamp, moveTrack } from "@/lib/plan";
import { useKD } from "@/lib/store";
import type { Plan } from "@/lib/usePlan";

const sleeve = "stk relative overflow-hidden p-5";
const quiet = "panel relative overflow-hidden p-5";

/** The plan's summary, written up like the notes on the back of a record. */
export function LinerNotes({ plan }: { plan: Plan }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-bold">Liner notes</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CloserCard plan={plan} />
        <LengthCard plan={plan} />
        <TempoCard plan={plan} />
        <LandmarkCard plan={plan} />
      </div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="label mb-2">{children}</div>;
}

function CloserCard({ plan }: { plan: Plan }) {
  const reorder = useKD((s) => s.reorder);
  const c = plan.closer;
  const u = plan.settings.units;

  if (!c) {
    return (
      <div className={sleeve} style={{ background: "var(--color-pink)" }}>
        <Label>Closing track</Label>
        <p className="font-display text-2xl font-bold leading-tight">None picked yet</p>
        <p className="mt-2 text-sm">Tap ★ on the song you want playing down the final stretch.</p>
      </div>
    );
  }

  const onTime = c.status === "perfect";
  const headline = onTime ? "Right on time" : `${fmtClock(Math.abs(c.delta))} ${c.status === "late" ? "late" : "early"}`;
  const from = plan.tracks.findIndex((t) => t.key === c.segment.track.key);
  const canMove = c.bestIndex !== from && Math.abs(c.bestDelta) < Math.abs(c.delta) - 2;
  const target = Math.max(0, plan.course.distance - plan.settings.closerTargetFromEnd);

  return (
    <motion.div layout className={sleeve} style={{ background: onTime ? "var(--color-pink)" : "var(--color-coral)" }}>
      <Label>Closing track</Label>
      <motion.p key={headline} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="font-display text-3xl font-extrabold leading-none tracking-tight">
        {headline}
      </motion.p>
      <p className="mt-3 truncate font-semibold">{c.segment.track.title}</p>
      <p className="font-mono text-[11px]">
        {c.segment.phase === "race"
          ? `starts at ${u} ${toUnits(c.segment.startD, u).toFixed(2)} · aim ${toUnits(target, u).toFixed(2)}`
          : c.segment.phase === "post"
            ? "plays after you finish"
            : "plays before the start"}
      </p>
      {!onTime && (
        <div className="mt-4 flex flex-col gap-2">
          {canMove && (
            <button
              className="btn self-start bg-ink px-4 py-2 text-xs text-pink"
              onClick={() => {
                reorder(moveTrack(plan.tracks, from, c.bestIndex));
                if (Math.abs(c.bestDelta) <= 10) confetti();
              }}
            >
              Move it into place ({fmtClock(Math.abs(c.bestDelta))} off)
            </button>
          )}
          {c.suggestion && (
            <button
              className="rounded-xl bg-ink/10 px-3 py-2 text-left text-xs font-medium leading-snug transition hover:bg-ink/20"
              onClick={() => {
                const fix = c.suggestion!;
                reorder(fix.apply(plan.tracks));
                if (Math.abs(fix.after) <= 10) confetti();
              }}
            >
              {c.suggestion.text}: lands {fmtClock(Math.abs(c.suggestion.after))} {c.suggestion.after > 0 ? "late" : "early"}. <u>Apply</u>
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
    <div className={quiet}>
      <Label>Running time</Label>
      <p className={`font-display text-3xl font-extrabold leading-none tracking-tight ${short ? "text-peach" : "text-chalk"}`}>
        {short ? `${fmtClock(stats.shortBy)} short` : `+${fmtClock(spare)}`}
      </p>
      <p className="mt-3 text-sm">
        {short ? `of silence before the finish. Add about ${Math.ceil(stats.shortBy / 210)} more songs.` : "to spare, even if the wall hits."}
      </p>
      <p className="mt-1 font-mono text-[11px] text-pink/70">
        {fmtClock(stats.totalPlay, true)} total · {stats.raceSongs} tracks in the race
        {stats.corralSongs ? ` · ${stats.corralSongs} in the corral` : ""}
      </p>
    </div>
  );
}

function TempoCard({ plan }: { plan: Plan }) {
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
    <div className={quiet}>
      <Label>Tempo</Label>
      <p className="font-display text-3xl font-extrabold leading-none tracking-tight text-chalk">
        {ramp == null ? "— bpm" : ramp >= 0 ? `+${ramp} bpm` : `${ramp} bpm`}
      </p>
      <svg viewBox={`0 0 ${W} ${Hh}`} className="mt-2 h-14 w-full" preserveAspectRatio="none" aria-hidden>
        {pts.length > 1 && <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="#F7D3D8" strokeWidth={2} strokeLinejoin="round" />}
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2} fill="#F7D3D8" />
        ))}
      </svg>
      <p className="font-mono text-[11px] text-pink/70">
        {stats.openingBpm ?? "—"} → {stats.closingBpm ?? "—"} bpm ·{" "}
        {ramp == null ? "add BPMs" : ramp > 8 ? "builds to the finish" : ramp < -8 ? "slows toward the finish" : "fairly flat"}
      </p>
      <button className="btn mt-3 bg-pink px-4 py-2 text-xs" onClick={() => reorder(autoRamp(plan.tracks, plan.settings, plan.model))}>
        Sort slow → fast
      </button>
    </div>
  );
}

function LandmarkCard({ plan }: { plan: Plan }) {
  const select = useKD((s) => s.select);
  return (
    <div className={`${quiet} md:col-span-2 xl:col-span-1`}>
      <Label>At the landmarks</Label>
      {plan.hits.length ? (
        <ul className="max-h-52 space-y-2 overflow-y-auto pr-1 text-sm">
          {plan.hits.map(({ landmark, segment }) => (
            <li key={landmark.name}>
              <button className="flex w-full items-start gap-2 text-left hover:text-chalk" onClick={() => segment && select(segment.track.key)} title={landmark.vibe}>
                <span className="w-12 shrink-0 pt-0.5 font-mono text-[10px] text-pink/60">
                  {toUnits(landmark.d, plan.settings.units).toFixed(1)}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold leading-tight">{landmark.name}</span>
                  <span className="block truncate text-xs text-pink/70">{segment ? segment.track.title : "nothing playing"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-pink/75">No landmarks on custom courses yet. Hover the course chart to see what&apos;s playing anywhere.</p>
      )}
    </div>
  );
}
