"use client";

import { useState } from "react";
import { fmtClock, fmtPace, fromUnits, parseClock, toUnits } from "@/lib/format";
import { rescaleCourse } from "@/lib/geo";
import { useKD } from "@/lib/store";
import type { PaceStrategy } from "@/lib/types";
import type { Plan } from "@/lib/usePlan";
import { Segmented } from "./ui";

export function GoalInput({ compact = false }: { compact?: boolean }) {
  const goal = useKD((s) => s.settings.goalSec);
  // Re-key on external changes so the draft text resets.
  return <GoalField key={goal} goal={goal} compact={compact} />;
}

function GoalField({ goal, compact }: { goal: number; compact: boolean }) {
  const set = useKD((s) => s.set);
  const [text, setText] = useState(fmtClock(goal, true));
  const [bad, setBad] = useState(false);

  const commit = () => {
    const v = parseClock(text);
    if (v && v >= 300) {
      set({ goalSec: v });
      setBad(false);
    } else setBad(true);
  };

  return (
    <div className="flex items-center gap-2">
      <button className="grid h-9 w-9 place-items-center rounded-full border border-pink/30 font-semibold hover:border-pink hover:text-chalk" onClick={() => set({ goalSec: Math.max(300, goal - 60) })} aria-label="One minute faster">
        −
      </button>
      <input
        aria-label="Goal time (h:mm:ss)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={`w-[7.2ch] rounded-xl border bg-ink-3 text-center font-display font-bold tabular-nums tracking-tight outline-none transition focus:border-pink ${
          compact ? "py-1 text-2xl" : "py-2 text-4xl sm:text-5xl"
        } ${bad ? "border-coral text-coral" : "border-pink/25"}`}
      />
      <button className="grid h-9 w-9 place-items-center rounded-full border border-pink/30 font-semibold hover:border-pink hover:text-chalk" onClick={() => set({ goalSec: goal + 60 })} aria-label="One minute slower">
        +
      </button>
    </div>
  );
}

const STRATS: { value: PaceStrategy; label: string; title: string }[] = [
  { value: "even", label: "Even", title: "Same pace the whole way" },
  { value: "negative", label: "Negative split", title: "Start conservative, finish fast" },
  { value: "hills", label: "Hill-smart", title: "Slower up, faster down (grade-adjusted)" },
  { value: "ghost", label: "Ghost", title: "Replay how you actually ran this course, scaled to your goal" },
];

export function GoalBar({ plan }: { plan: Plan }) {
  const set = useKD((s) => s.set);
  const s = plan.settings;
  const avgPace = s.goalSec / plan.course.distance;

  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <div>
        <div className="label mb-1">goal time</div>
        <GoalInput compact />
      </div>
      <div>
        <div className="label mb-1">avg pace</div>
        <div data-testid="avg-pace" className="font-display text-2xl font-bold tabular-nums tracking-tight text-chalk">{fmtPace(avgPace, s.units)}</div>
      </div>
      <div>
        <div className="label mb-1">pacing</div>
        <Segmented
          label="pacing strategy"
          size="sm"
          value={s.strategy}
          onChange={(v) => set({ strategy: v })}
          options={STRATS.map((o) => ({
            ...o,
            disabled: o.value === "ghost" && !plan.course.hasTimes,
            title: o.value === "ghost" && !plan.course.hasTimes ? "Import a Strava activity (or GPX with timestamps) to unlock" : o.title,
          }))}
        />
      </div>
    </div>
  );
}

export function NerdSettings({ plan }: { plan: Plan }) {
  const set = useKD((st) => st.set);
  const setCourse = useKD((st) => st.setCourse);
  const s = plan.settings;
  const u = s.units;
  const official = (m: number) => setCourse(rescaleCourse(plan.course, m));

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {s.strategy === "negative" && (
        <Slider
          label="Negative split"
          value={Math.round(s.negativeSplit * 100)}
          min={1}
          max={10}
          suffix="% faster 2nd half"
          onChange={(v) => set({ negativeSplit: v / 100 })}
        />
      )}
      <Slider
        label="Closing track starts"
        value={Number(toUnits(s.closerTargetFromEnd, u).toFixed(2))}
        min={0.1}
        max={u === "mi" ? 3 : 5}
        step={0.05}
        suffix={`${u} from the finish`}
        onChange={(v) => set({ closerTargetFromEnd: fromUnits(v, u) })}
      />
      <Slider
        label="Crossfade"
        value={s.crossfadeSec}
        min={0}
        max={12}
        suffix="s (match your Spotify setting)"
        onChange={(v) => set({ crossfadeSec: v })}
      />
      <Slider
        label="Hit play"
        value={Math.round(s.startOffsetSec / 30) / 2}
        min={0}
        max={25}
        step={0.5}
        suffix="min before you cross the mat"
        onChange={(v) => set({ startOffsetSec: v * 60 })}
      />
      <div>
        <div className="label mb-2">Official distance</div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            key={`${plan.course.distance}-${u}`}
            className="field w-24 py-1.5 font-mono"
            defaultValue={toUnits(plan.course.distance, u).toFixed(2)}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v > 0.5) official(fromUnits(v, u));
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            aria-label={`Official distance in ${u}`}
          />
          <span className="text-sm text-pink/60">{u}</span>
          {[
            ["5K", 5000],
            ["10K", 10000],
            ["Half", 21097.5],
            ["Full", 42195],
          ].map(([l, m]) => (
            <button key={l} className="chip text-pink/60 hover:text-chalk" onClick={() => official(m as number)}>
              {l}
            </button>
          ))}
        </div>
        {Math.abs(plan.course.measuredDistance - plan.course.distance) > 50 && (
          <p className="mt-1 text-xs text-pink/40">
            GPS measured {toUnits(plan.course.measuredDistance, u).toFixed(2)} {u}. Watches usually read a little long — that&apos;s normal.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <div className="label mb-2">Units</div>
          <Segmented label="units" size="sm" value={u} onChange={(v) => set({ units: v })} options={[{ value: "mi", label: "mi" }, { value: "km", label: "km" }]} />
        </div>
        <div>
          <div className="label mb-2">Colors</div>
          <Segmented
            label="color mode"
            size="sm"
            value={s.colorMode}
            onChange={(v) => set({ colorMode: v })}
            options={[
              { value: "bpm", label: "BPM heat" },
              { value: "rainbow", label: "Rainbow" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  onChange(v: number): void;
}) {
  return (
    <label className="block">
      <div className="label mb-1">{label}</div>
      <div className="mb-1 text-sm">
        <span className="font-display text-xl font-bold text-chalk">{value}</span> <span className="text-pink/60">{suffix}</span>
      </div>
      <input type="range" className="w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
