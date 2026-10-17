"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { rememberManageKey } from "@/lib/client/keys";
import { fmtMile, momentEtas, RACE, RUNNER_MOMENTS, startInstant } from "@/lib/race";
import type { Song } from "@/lib/types";
import { GoalInput } from "./GoalInput";
import { SongPicker } from "./SongPicker";

type Picks = Partial<Record<"start" | "half" | "finish", Song>>;

export function SetupForm() {
  const router = useRouter();
  const [runnerName, setName] = useState("");
  const [runnerEmail, setEmail] = useState("");
  const [goalSec, setGoal] = useState(4 * 3600);
  const [startTime, setStart] = useState<string>(RACE.waves[0].time);
  const [custom, setCustom] = useState(false);
  const [songs, setSongs] = useState<Picks>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const etas = momentEtas(startInstant(startTime), goalSec);
  const ready = runnerName.trim() && songs.start && songs.half && songs.finish;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api<{ id: string; manageKey: string }>("/api/races", {
        method: "POST",
        body: JSON.stringify({ runnerName, runnerEmail: runnerEmail.trim() || undefined, goalSec, startTime, songs }),
      });
      rememberManageKey(res.id, res.manageKey);
      router.push(`/r/${res.id}/manage?new=1#key=${res.manageKey}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't create your race. Try again.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-10 pt-4">
      <div>
        <div className="label">{RACE.name} · {RACE.dateLabel}</div>
        <h1 className="mt-2 font-display text-5xl font-extrabold tracking-tight">Set up your race</h1>
        <p className="mt-3 max-w-[52ch] text-lg text-blush">
          Takes two minutes. You&apos;ll get a link to share, and friends will see your name, the course and estimated times at
          each moment.
        </p>
      </div>

      <section className="panel grid gap-5 p-6 sm:grid-cols-2">
        <div>
          <label htmlFor="runner-name" className="label mb-2 block">Your name</label>
          <input id="runner-name" className="field" placeholder="Matt Lebel" value={runnerName} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={40} />
        </div>
        <div>
          <label htmlFor="runner-email" className="label mb-2 block">Email (optional)</label>
          <input id="runner-email" type="email" className="field" placeholder="you@example.com" value={runnerEmail} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <p className="mt-1 text-xs text-pink/60">We&apos;ll send your private race link so you don&apos;t lose it.</p>
        </div>
        <div>
          <label htmlFor="goal" className="label mb-2 block">Goal time</label>
          <GoalInput id="goal" value={goalSec} onChange={setGoal} />
        </div>
        <div>
          <label htmlFor="wave" className="label mb-2 block">Start wave</label>
          <select
            id="wave"
            className="field"
            value={custom ? "custom" : startTime}
            onChange={(e) => {
              if (e.target.value === "custom") setCustom(true);
              else {
                setCustom(false);
                setStart(e.target.value);
              }
            }}
          >
            {RACE.waves.map((w) => (
              <option key={w.time} value={w.time}>
                {w.label} · {startInstant(w.time).toLocaleTimeString("en-US", { timeZone: RACE.timeZone, hour: "numeric", minute: "2-digit" })}
              </option>
            ))}
            <option value="custom">Another time…</option>
          </select>
          {custom && (
            <input aria-label="Start time" type="time" className="field mt-2" min="07:00" max="12:59" value={startTime} onChange={(e) => e.target.value && setStart(e.target.value)} />
          )}
          <p className="mt-1 text-xs text-pink/60">Approximate wave times. Check your race confirmation.</p>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Your three songs</h2>
          <p className="text-blush">Friends will see these, so nobody plants the same song.</p>
        </div>
        {RUNNER_MOMENTS.map((m, i) => (
          <div key={m.id} className="panel p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-display text-xl font-bold">{m.label}</div>
              <div className="font-mono text-[11px] text-pink/70">
                mile {fmtMile(m.d)} · about {etas[m.id]}
              </div>
            </div>
            <p className="mb-3 text-sm text-blush/90">{m.note}</p>
            <SongPicker
              label={`${["Start", "Halfway", "Finish"][i]} song`}
              value={songs[m.id as keyof Picks]}
              onChange={(s) => setSongs({ ...songs, [m.id]: s })}
            />
          </div>
        ))}
      </section>

      {err && <p role="alert" className="font-semibold text-coral">{err}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn bg-pink px-8 py-4 text-base" disabled={!ready || busy}>
          {busy ? "Creating…" : "Create my share link"}
        </button>
        {!ready && <span className="text-sm text-pink/70">Add your name and all three songs.</span>}
      </div>
    </form>
  );
}
