"use client";

import { toPng } from "html-to-image";
import { useMemo, useRef, useState } from "react";
import { fmtClock, fmtPace, toUnits } from "@/lib/format";
import { savePlaylist, spotifyConnected } from "@/lib/spotify";
import { useKD } from "@/lib/store";
import type { Plan } from "@/lib/usePlan";
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
        `⚡ ${plan.course.name} — ${fmtClock(plan.model.goal, true)}`,
        `Race-ordered by Playlist Pacer. Kick: ${plan.kick?.segment.track.title ?? "—"}`,
        [...race, ...plan.segments.filter((s) => s.phase === "post").map((s) => s.track)],
      );
      notify("💚 Saved to Spotify!");
      window.open(url, "_blank");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Share your plan" accent="var(--color-sun)" wide>
      <div className="grid gap-6 md:grid-cols-[1fr_auto]">
        <div className="overflow-hidden rounded-2xl">
          <div className="origin-top-left" style={{ width: 540 * 0.75, height: 675 * 0.75 }}>
            <div style={{ transform: "scale(0.75)", transformOrigin: "top left" }}>
              <Poster ref={card} plan={plan} playlistName={playlistName} />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 md:w-56">
          <button className="btn bg-acid px-5 py-3 text-xs" onClick={download} disabled={!!busy}>
            {busy === "png" ? "rendering…" : "⬇️ Download PNG"}
          </button>
          <button className="btn bg-paper px-5 py-3 text-xs" onClick={copyCues}>
            📋 Copy cue sheet
          </button>
          {source === "spotify" && spotifyConnected() && (
            <button className="btn bg-mint px-5 py-3 text-xs" onClick={toSpotify} disabled={!!busy}>
              {busy === "spotify" ? "saving…" : "💚 Save order to Spotify"}
            </button>
          )}
          <p className="text-xs text-paper/50">
            Story-sized poster for the &apos;gram, r/runnyc, or your run club group chat. The cue sheet is plain text with every
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
    `🎧 ${playlistName}`,
    "",
  ];
  for (const s of plan.segments) {
    if (s.phase !== "race") continue;
    const kick = s.track.key === plan.settings.kickKey ? "⚡ " : "   ";
    lines.push(`${kick}${toUnits(s.startD, u).toFixed(2).padStart(5)} ${u}  ${fmtClock(s.raceStart, true)}  ${s.track.title} — ${s.track.artist}`);
  }
  lines.push("", "made with Playlist Pacer");
  return lines.join("\n");
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
    const W = 460, H = 300;
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

  const kick = plan.kick;
  const ramp = plan.stats.openingBpm && plan.stats.closingBpm ? `${plan.stats.openingBpm}→${plan.stats.closingBpm}` : "—";

  return (
    <div ref={ref} className="relative overflow-hidden bg-ink p-7 text-paper" style={{ width: 540, height: 675, fontFamily: "var(--font-sans)" }}>
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-hot/40 blur-3xl" />
      <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-ice/30 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <span className="font-display text-sm font-black uppercase tracking-tight">Playlist <span className="text-acid">Pacer</span></span>
        <span className="rounded-full border-2 border-black bg-acid px-3 py-0.5 font-display text-[10px] font-black text-ink">RACE PLAYLIST PLAN</span>
      </div>
      <div className="relative mt-4 font-display text-[40px] font-black uppercase leading-[0.9]">{plan.course.name}</div>
      <div className="relative mt-1 truncate text-sm text-paper/60">🎧 {playlistName}</div>
      <svg width={w} height={h} className="relative mx-auto mt-3 block">
        {paths.map((p, i) => (
          <g key={i}>
            <path d={p.d} stroke="#000" strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
        {paths.map((p, i) => (
          <path key={`c${i}`} d={p.d} stroke={p.color} strokeWidth={6} fill="none" strokeLinejoin="round" />
        ))}
      </svg>
      <div className="relative mt-3 grid grid-cols-4 gap-2">
        {[
          ["goal", fmtClock(plan.model.goal, true)],
          ["pace", fmtPace(plan.model.goal / plan.course.distance, u).replace(`/${u}`, "")],
          ["songs", String(plan.stats.raceSongs)],
          ["bpm", ramp],
        ].map(([k, v], i) => (
          <div
            key={k}
            className="rounded-2xl border-2 border-black px-2 py-2 text-ink"
            style={{ background: ["#d4ff3a", "#ff3da5", "#3ddcff", "#b69cff"][i] }}
          >
            <div className="font-display text-[9px] font-black uppercase">{k}</div>
            <div className="font-display text-[15px] font-black tabular-nums leading-tight">{v}</div>
          </div>
        ))}
      </div>
      {kick && (
        <div className="relative mt-4 rounded-2xl border-2 border-black bg-paper px-4 py-3 text-ink">
          <div className="font-display text-[10px] font-black uppercase">⚡ the kick drops at {u} {toUnits(kick.segment.startD, u).toFixed(1)}</div>
          <div className="truncate font-display text-lg font-black">{kick.segment.track.title}</div>
        </div>
      )}
      <div className="absolute inset-x-7 bottom-5 flex justify-between font-mono text-[10px] text-paper/50">
        <span>time the drop. own the kick.</span>
        <span>{toUnits(plan.course.distance, u).toFixed(1)} {u}</span>
      </div>
    </div>
  );
}
