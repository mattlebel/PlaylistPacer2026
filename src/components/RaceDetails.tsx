"use client";

import { useState } from "react";
import { DEFAULT_PACE_SEC, DEFAULT_START, finishEta, fmtPace, fmtTimeOfDay, parsePace, startInstant, WAVES } from "@/lib/race";

/** Wave start, pace per mile and bib: the form state shared by setup and the runner's page. */
export function useRaceDetails(initial?: { startTime?: string; paceSec?: number; bib?: string }) {
  const [startTime, setStart] = useState(initial?.startTime ?? DEFAULT_START);
  const [custom, setCustom] = useState(!!initial?.startTime && !WAVES.some((w) => w.time === initial.startTime));
  const [pace, setPace] = useState(fmtPace(initial?.paceSec ?? DEFAULT_PACE_SEC));
  const [bib, setBib] = useState(initial?.bib ?? "");
  const paceSec = parsePace(pace);
  return {
    startTime,
    setStart,
    custom,
    setCustom,
    pace,
    setPace,
    bib,
    setBib,
    paceSec,
    valid: paceSec !== null && /^\d{0,6}$/.test(bib.trim()),
    values: { startTime, paceSec: paceSec ?? DEFAULT_PACE_SEC, bib: bib.trim() || undefined },
  };
}

export function RaceDetailsFields({ details: d }: { details: ReturnType<typeof useRaceDetails> }) {
  const finish = d.paceSec ? fmtTimeOfDay(finishEta(startInstant(d.startTime), d.paceSec)) : null;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div>
        <label htmlFor="wave" className="label mb-2 block">
          Start wave
        </label>
        <select
          id="wave"
          className="field"
          value={d.custom ? "custom" : d.startTime}
          onChange={(e) => {
            if (e.target.value === "custom") d.setCustom(true);
            else {
              d.setCustom(false);
              d.setStart(e.target.value);
            }
          }}
        >
          {WAVES.map((w) => (
            <option key={w.time} value={w.time}>
              {w.label} · {fmtTimeOfDay(startInstant(w.time))}
            </option>
          ))}
          <option value="custom">Another time…</option>
        </select>
        {d.custom && (
          <input aria-label="Start time" type="time" className="field mt-2" min="07:00" max="12:59" value={d.startTime} onChange={(e) => e.target.value && d.setStart(e.target.value)} />
        )}
      </div>
      <div>
        <label htmlFor="pace" className="label mb-2 block">
          Pace per mile
        </label>
        <input id="pace" className="field font-mono" inputMode="numeric" placeholder="11:00" value={d.pace} onChange={(e) => d.setPace(e.target.value)} />
        <p className={`mt-1 text-xs ${d.paceSec ? "text-pink/60" : "text-coral"}`}>{d.paceSec ? `Finish around ${finish}` : "Use minutes:seconds, like 11:00"}</p>
      </div>
      <div>
        <label htmlFor="bib" className="label mb-2 block">
          Bib number (optional)
        </label>
        <input id="bib" className="field font-mono" inputMode="numeric" maxLength={6} placeholder="13302" value={d.bib} onChange={(e) => d.setBib(e.target.value.replace(/\D/g, ""))} />
        <p className="mt-1 text-xs text-pink/60">So friends can track you live.</p>
      </div>
      <p className="text-xs text-pink/60 sm:col-span-3">Wave times are approximate. Check your race confirmation.</p>
    </div>
  );
}
