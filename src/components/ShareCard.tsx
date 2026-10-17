"use client";

import { toPng } from "html-to-image";
import { useMemo, useRef, useState } from "react";
import { fmtClock, fmtPace, toUnits } from "@/lib/format";
import { savePlaylist, spotifyConnected } from "@/lib/spotify";
import { useKD } from "@/lib/store";
import type { Segment } from "@/lib/types";
import type { Plan } from "@/lib/usePlan";
import { LogoMark } from "./Logo";
import { Modal } from "./ui";

export function ShareModal({ open, onClose, plan, notify }: { open: boolean; onClose(): void; plan: Plan; notify(m: string): void }) {
  const card = useRef<HTMLDivElement>(null);
  const playlistName = useKD((s) => s.playlistName);
  const source = useKD((s) => s.playlistSource);
  const [busy, setBusy] = useState<string | null>(null);

  const download = async () => {
    if (!card.current) return;
    setBusy("png");
    try {
      const url = await toPng(card.current, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.href = url;
      a.download = `playlist-pacer-${plan.course.name.toLowerCase().replace(/\W+/g, "-")}.png`;
      a.click();
    } catch {
      notify("Couldn't render the image — try a screenshot instead.");
    } finally {
      setBusy(null);
    }
  };

  const copyCues = async () => {
    await navigator.clipboard.writeText(cueSheet(plan, playlistName));
    notify("Cue sheet copied.");
  };

  const toSpotify = async () => {
    setBusy("spotify");
    try {
      const race = plan.segments.filter((s) => s.phase !== "post").map((s) => s.track);
      const url = await savePlaylist(
        `${plan.course.name} — ${fmtClock(plan.model.goal, true)}`,
        `Race-ordered by Playlist Pacer. Closing track: ${plan.closer?.segment.track.title ?? "—"}`,
        [...race, ...plan.segments.filter((s) => s.phase === "post").map((s) => s.track)],
      );
      notify("Saved to Spotify.");
      window.open(url, "_blank");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Share your plan" wide>
      <div className="grid gap-6 md:grid-cols-[1fr_auto]">
        <div className="overflow-hidden rounded-2xl">
          <div className="origin-top-left" style={{ width: 540 * 0.75, height: 675 * 0.75 }}>
            <div style={{ transform: "scale(0.75)", transformOrigin: "top left" }}>
              <Poster ref={card} plan={plan} playlistName={playlistName} />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 md:w-56">
          <button className="btn bg-pink px-5 py-3 text-xs" onClick={download} disabled={!!busy}>
            {busy === "png" ? "rendering…" : "Download PNG"}
          </button>
          <button className="btn bg-pink px-5 py-3 text-xs" onClick={copyCues}>
            Copy cue sheet
          </button>
          {source === "spotify" && spotifyConnected() && (
            <button className="btn bg-mint px-5 py-3 text-xs" onClick={toSpotify} disabled={!!busy}>
              {busy === "spotify" ? "saving…" : "Save order to Spotify"}
            </button>
          )}
          <p className="text-xs text-pink/50">
            An album-sleeve poster for Instagram, r/runnyc or your run club chat. The cue sheet is plain text with every
            song&apos;s mile marker.
          </p>
        </div>
      </div>
    </Modal>
  );
}

function cueSheet(plan: Plan, playlistName: string) {
  const u = plan.settings.units;
  const lines = [
    `🏁 ${plan.course.name} — goal ${fmtClock(plan.model.goal, true)} (${fmtPace(plan.model.goal / plan.course.distance, u)})`,
    `Playlist: ${playlistName}`,
    "",
  ];
  for (const s of plan.segments) {
    if (s.phase !== "race") continue;
    const closer = s.track.key === plan.settings.closerKey ? "★ " : "  ";
    lines.push(`${closer}${toUnits(s.startD, u).toFixed(2).padStart(5)} ${u}  ${fmtClock(s.raceStart, true)}  ${s.track.title} — ${s.track.artist}`);
  }
  lines.push("", "made with Playlist Pacer");
  return lines.join("\n");
}

/** Pick up to `n` race tracks spread across a side, always keeping the closing track. */
function sampleSide(segs: Segment[], n: number, keep?: string) {
  if (segs.length <= n) return segs;
  const out = new Set<Segment>();
  for (let i = 0; i < n; i++) out.add(segs[Math.round((i * (segs.length - 1)) / (n - 1))]);
  const k = segs.find((s) => s.track.key === keep);
  if (k && !out.has(k)) {
    out.delete([...out][out.size - 1]);
    out.add(k);
  }
  return [...out].sort((x, y) => x.index - y.index);
}

function Poster({ plan, playlistName, ref }: { plan: Plan; playlistName: string; ref: React.Ref<HTMLDivElement> }) {
  const u = plan.settings.units;
  const { paths, w, h } = useMemo(() => {
    const pts = plan.course.points;
    const lat0 = pts.reduce((a, p) => a + p.lat, 0) / pts.length;
    const k = Math.cos((lat0 * Math.PI) / 180);
    const xs = pts.map((p) => p.lon * k);
    const ys = pts.map((p) => -p.lat);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const W = 200, H = 210;
    const s = Math.min(W / (maxX - minX || 1), H / (maxY - minY || 1));
    const ox = (W - (maxX - minX) * s) / 2;
    const oy = (H - (maxY - minY) * s) / 2;
    const P = (i: number) => `${(ox + (xs[i] - minX) * s).toFixed(1)},${(oy + (ys[i] - minY) * s).toFixed(1)}`;
    const race = plan.segments.filter((x) => x.phase === "race");
    const paths = race.map((seg) => {
      const idx: number[] = [];
      pts.forEach((p, i) => p.d >= seg.startD && p.d <= seg.endD && idx.push(i));
      return { color: seg.color, d: idx.length > 1 ? "M" + idx.map(P).join("L") : "" };
    });
    return { paths, w: W, h: H };
  }, [plan]);

  const half = plan.course.distance / 2;
  const race = plan.segments.filter((x) => x.phase === "race");
  const sideA = sampleSide(race.filter((x) => x.startD < half), 10);
  const sideB = sampleSide(race.filter((x) => x.startD >= half), 10, plan.settings.closerKey ?? undefined);
  const ramp = plan.stats.openingBpm && plan.stats.closingBpm ? `${plan.stats.openingBpm} → ${plan.stats.closingBpm}` : "—";

  return (
    <div ref={ref} className="relative overflow-hidden bg-ground p-8 text-pink" style={{ width: 540, height: 675, fontFamily: "var(--font-sans)" }}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <LogoMark size={22} />
          <span className="font-display text-sm font-bold">playlist pacer</span>
        </span>
        <span className="font-mono text-[9px] uppercase tracking-wider opacity-75">{fmtClock(plan.model.goal, true)} · {toUnits(plan.course.distance, u).toFixed(1)} {u}</span>
      </div>
      <div className="mt-6 flex gap-5">
        <div className="min-w-0 flex-1">
          <div className="font-display text-[44px] font-extrabold leading-[0.9] tracking-tight">{plan.course.name}</div>
          <div className="mt-2 truncate text-sm text-blush">{playlistName}</div>
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 font-mono text-[10px]">
            {[
              ["pace", fmtPace(plan.model.goal / plan.course.distance, u)],
              ["tracks", String(plan.stats.raceSongs)],
              ["bpm", ramp],
              ["closer", plan.closer ? `${u} ${toUnits(plan.closer.segment.startD, u).toFixed(1)}` : "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="uppercase opacity-60">{k}</div>
                <div className="mt-0.5 text-[12px] text-chalk">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <svg width={w} height={h} className="shrink-0">
          {paths.map((p, i) => (
            <path key={i} d={p.d} stroke={p.color} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </svg>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6 rounded-md bg-pink p-5 text-ink">
        {[
          ["Side A", sideA],
          ["Side B", sideB],
        ].map(([side, list]) => (
          <div key={side as string} className="flex min-w-0 flex-col gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-ground">{side as string}</span>
            {(list as Segment[]).map((seg) => {
              const isCloser = seg.track.key === plan.settings.closerKey;
              return (
                <div key={seg.track.key} className="flex min-w-0 gap-2 text-[12px]">
                  <span className="w-8 shrink-0 pt-px font-mono text-[9px] opacity-60">{toUnits(seg.startD, u).toFixed(1)}</span>
                  <span className={`truncate ${isCloser ? "font-bold" : ""}`}>
                    {isCloser ? "★ " : ""}
                    {seg.track.title}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="absolute inset-x-8 bottom-6 flex justify-between font-mono text-[9px] opacity-70">
        <span>your race, sequenced like an album</span>
        <span>{race.length} tracks</span>
      </div>
    </div>
  );
}
