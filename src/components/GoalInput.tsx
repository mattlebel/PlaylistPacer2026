"use client";

import { useState } from "react";
import { fmtClock, parseClock } from "@/lib/format";

/** h:mm:ss goal entry with ± one-minute nudges. */
export function GoalInput({ value, onChange, id }: { value: number; onChange(sec: number): void; id?: string }) {
  return <GoalField key={value} value={value} onChange={onChange} id={id} />;
}

function GoalField({ value, onChange, id }: { value: number; onChange(sec: number): void; id?: string }) {
  const [text, setText] = useState(fmtClock(value, true));
  const [bad, setBad] = useState(false);
  const commit = () => {
    const v = parseClock(text);
    if (v && v >= 2 * 3600 && v <= 8 * 3600) {
      setBad(false);
      onChange(v);
    } else setBad(true);
  };
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="grid h-10 w-10 place-items-center rounded-full border border-pink/30 hover:border-pink" onClick={() => onChange(Math.max(7200, value - 60))} aria-label="One minute faster">
        −
      </button>
      <input
        id={id}
        aria-label="Goal time (h:mm:ss)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.target as HTMLInputElement).blur())}
        className={`w-[7ch] rounded-xl border bg-ink-3 py-2 text-center font-display text-3xl font-bold tabular-nums outline-none focus:border-pink ${bad ? "border-coral text-coral" : "border-pink/25"}`}
      />
      <button type="button" className="grid h-10 w-10 place-items-center rounded-full border border-pink/30 hover:border-pink" onClick={() => onChange(Math.min(28800, value + 60))} aria-label="One minute slower">
        +
      </button>
      {bad && <span className="text-sm text-coral">Use h:mm:ss, between 2 and 8 hours</span>}
    </div>
  );
}
