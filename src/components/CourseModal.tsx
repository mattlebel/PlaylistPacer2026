"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadPreset, PRESET_LIST } from "@/lib/courses";
import { fmtClock, fmtDist } from "@/lib/format";
import { buildCourse, rescaleCourse, type RawPoint } from "@/lib/geo";
import { parseGpx } from "@/lib/gpx";
import { useKD } from "@/lib/store";
import type { Course } from "@/lib/types";
import { Modal, Tabs } from "./ui";

export type Tab = "presets" | "gpx" | "strava";

interface StravaStatus {
  configured: boolean;
  connected: boolean;
  athlete: { firstname?: string; profile?: string } | null;
}

interface Run {
  id: string;
  name: string;
  date: string;
  distance: number;
  elapsed: number;
  race: boolean;
}

export function CourseModal({
  tab,
  setTab,
  notify,
}: {
  /** Which tab is showing; false = closed. */
  tab: Tab | false;
  setTab(t: Tab | false): void;
  notify(m: string): void;
}) {
  const open = tab !== false;
  const onClose = () => setTab(false);
  const setCourse = useKD((s) => s.setCourse);
  const units = useKD((s) => s.settings.units);
  const current = useKD((s) => s.course?.id);

  const accept = useCallback(
    (c: Course, goal?: number) => {
      setCourse(c, goal);
      notify(c.hasTimes ? `Ghost pacing on: following how you actually ran “${c.name}”.` : `${c.name} loaded.`);
      onClose();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setCourse, notify],
  );

  return (
    <Modal open={open} onClose={onClose} title="Pick your course" wide>
      <Tabs
        value={tab || "presets"}
        onChange={setTab}
        tabs={[
          { value: "presets", label: "NYC classics" },
          { value: "gpx", label: "Upload GPX" },
          { value: "strava", label: "Strava" },
        ]}
      />
      {tab === "presets" && (
        <div className="grid gap-4 sm:grid-cols-3">
          {PRESET_LIST.map((p, i) => (
            <button
              key={p.id}
              onClick={() => accept(loadPreset(p.id), p.defaultGoal)}
              className="stk group relative flex flex-col items-start p-4 text-left transition hover:-translate-y-0.5"
              style={{
                background: ["var(--color-pink)", "var(--color-sky)", "var(--color-butter)"][i % 3],
              }}
            >
              {current === p.id && (
                <span className="absolute -right-2 -top-3 rounded-full bg-pink px-2 py-0.5 text-[10px] font-extrabold uppercase">
                  current
                </span>
              )}
              <span className="text-4xl">{p.emoji}</span>
              <span className="mt-3 font-display text-lg font-extrabold leading-tight">{p.name}</span>
              <span className="mt-1 font-mono text-xs font-bold">{p.short}</span>
              <span className="mt-2 text-sm leading-snug">{p.blurb}</span>
            </button>
          ))}
          <p className="text-xs text-mute sm:col-span-3">
            Presets are hand-traced: real streets, sketched hills, official distance. Close enough to plan a playlist. For
            exact geometry, upload the race&apos;s GPX.
          </p>
        </div>
      )}
      {tab === "gpx" && <GpxDrop onCourse={(c) => accept(c, c.sourceTime)} />}
      {tab === "strava" && <StravaTab units={units} onCourse={(c) => accept(c, c.sourceTime)} />}
    </Modal>
  );
}

/** If the GPS distance is within 3% of a standard race distance, snap to it (watches over-read). */
const STANDARD = [5000, 8046.72, 10000, 15000, 16093.44, 21097.5, 42195];

function rawToCourse(id: string, name: string, source: Course["source"], raw: RawPoint[]) {
  const c = buildCourse({ id, name, source, raw });
  const snap = STANDARD.find((s) => Math.abs(c.measuredDistance - s) / s < 0.03);
  return snap ? rescaleCourse(c, snap) : c;
}

export function GpxDrop({ onCourse }: { onCourse(c: Course): void }) {
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const handle = async (file?: File) => {
    if (!file) return;
    setErr(null);
    try {
      const { name, points } = parseGpx(await file.text());
      onCourse(rawToCourse(`gpx-${Date.now()}`, name, "gpx", points));
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div>
      <button
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle(e.dataTransfer.files[0]);
        }}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-[3px] border-dashed p-10 text-center transition ${
          drag ? "scale-[1.02] border-pink bg-pink/10" : "border-pink/25 hover:border-pink/60"
        }`}
      >
                <span className="font-display text-lg font-extrabold">Drop a .gpx here</span>
        <span className="text-sm text-pink/60">or tap to browse. Activity GPX with timestamps unlocks ghost pacing.</span>
      </button>
      <input ref={input} type="file" accept=".gpx,application/gpx+xml" hidden onChange={(e) => handle(e.target.files?.[0])} />
      {err && <p className="mt-3 font-bold text-coral">{err}</p>}
    </div>
  );
}

function StravaTab({ onCourse, units }: { onCourse(c: Course): void; units: "mi" | "km" }) {
  const [status, setStatus] = useState<StravaStatus | null>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/strava/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false, connected: false, athlete: null }));
  }, []);

  useEffect(() => {
    if (!status?.connected) return;
    fetch("/api/strava/activities")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setRuns([...j.runs].sort((a: Run, b: Run) => Number(b.race) - Number(a.race)));
      })
      .catch((e) => setErr(e.message));
  }, [status?.connected]);

  const importRef = async (ref: string) => {
    setBusy(ref);
    setErr(null);
    try {
      const r = await fetch(`/api/strava/import?url=${encodeURIComponent(ref)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      onCourse(rawToCourse(`strava-${j.kind}-${Date.now()}`, j.name, j.kind === "route" ? "strava-route" : "strava-activity", j.points));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const parsed = url.match(/(activities|routes)\/(\d+)/);
  const exportUrl = parsed ? `https://www.strava.com/${parsed[1]}/${parsed[2]}/export_gpx` : null;

  if (!status) return <p className="animate-pulse text-pink/60">checking Strava…</p>;

  return (
    <div className="space-y-5">
      {status.connected ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink/20 p-3">
          <span className="font-bold">
            Connected{status.athlete?.firstname ? ` as ${status.athlete.firstname}` : ""}
          </span>
          <button
            className="text-sm text-pink/60 underline hover:text-pink"
            onClick={async () => {
              await fetch("/api/strava/logout", { method: "POST" });
              setStatus({ ...status, connected: false });
              setRuns(null);
            }}
          >
            disconnect
          </button>
        </div>
      ) : status.configured ? (
        <a href="/api/strava/login" className="btn bg-pink px-6 py-3 text-sm">
          Connect Strava
        </a>
      ) : null}

      <div>
        <label htmlFor="strava-url" className="mb-2 block font-mono text-xs uppercase tracking-wider text-pink/70">
          Paste a Strava activity or route link
        </label>
        <div className="flex gap-2">
          <input
            id="strava-url"
            className="field font-mono text-sm"
            placeholder="https://www.strava.com/activities/1234567890"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          {status.connected && (
            <button className="btn bg-pink px-5 text-xs" disabled={!url || !!busy} onClick={() => importRef(url)}>
              {busy === url ? "…" : "Import"}
            </button>
          )}
        </div>
        {!status.connected && exportUrl && (
          <div className="mt-3 rounded-2xl border-2 border-pink/15 p-4 text-sm">
            <p className="mb-3">
              No API needed: grab the GPX straight from Strava (you&apos;ll need to be logged in there), then drop it below.
            </p>
            <a href={exportUrl} target="_blank" rel="noreferrer" className="btn bg-pink px-4 py-2 text-xs">
              Download GPX from Strava
            </a>
          </div>
        )}
        {!status.configured && (
          <p className="mt-2 text-xs text-mute">
            Strava API isn&apos;t set up on this server (it needs a Strava subscription + an API app). Links still work via GPX
            export.
          </p>
        )}
      </div>

      {!status.connected && <GpxDrop onCourse={onCourse} />}

      {runs && (
        <div>
          <h3 className="mb-2 font-mono text-xs uppercase tracking-wider text-pink/70">Your recent runs</h3>
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {runs.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => importRef(`activities/${r.id}`)}
                  disabled={!!busy}
                  className="flex w-full items-center gap-3 rounded-2xl border-2 border-pink/10 bg-ink-3 px-3 py-2 text-left transition hover:border-peach"
                >
                  <span className={`w-12 shrink-0 font-mono text-[10px] uppercase ${r.race ? "text-pink" : "text-pink/40"}`}>{r.race ? "race" : "run"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{r.name}</span>
                    <span className="font-mono text-xs text-pink/60">
                      {new Date(r.date).toLocaleDateString()} · {fmtDist(r.distance, units)} {units} · {fmtClock(r.elapsed)}
                    </span>
                  </span>
                  {busy === `activities/${r.id}` ? <span className="animate-pulse">…</span> : <span className="text-pink/40">→</span>}
                </button>
              </li>
            ))}
            {!runs.length && <li className="text-pink/60">No runs with GPS yet.</li>}
          </ul>
        </div>
      )}
      {err && <p className="font-bold text-coral">{err}</p>}
    </div>
  );
}
