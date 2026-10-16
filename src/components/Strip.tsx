"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { fmtClock, toUnits } from "@/lib/format";
import { pointAt } from "@/lib/geo";
import type { Plan } from "@/lib/usePlan";

const H = 250;
const BAND_Y = 26;
const BAND_H = 46;
const ELE_TOP = 96;
const ELE_BOT = 212;

/** The hero viz: elevation profile with every song painted onto the miles it covers. */
export function Strip({
  plan,
  selectedKey,
  onSelect,
  runnerD,
}: {
  plan: Plan;
  selectedKey: string | null;
  onSelect(key: string | null): void;
  runnerD?: number | null;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(900);
  const [hover, setHover] = useState<number | null>(null);
  const uid = useId().replace(/:/g, "");

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { course, segments, settings, model } = plan;
  const D = course.distance;
  const u = settings.units;
  const padL = 8;
  const padR = 8;
  const x = (d: number) => padL + (d / D) * (W - padL - padR);

  const prof = useMemo(() => {
    const pts = course.points;
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of pts) {
      lo = Math.min(lo, p.ele);
      hi = Math.max(hi, p.ele);
    }
    if (hi - lo < 30) {
      const mid = (hi + lo) / 2;
      lo = mid - 15;
      hi = mid + 15;
    }
    const stride = Math.max(1, Math.floor(pts.length / 600));
    const sample = pts.filter((_, i) => i % stride === 0 || i === pts.length - 1);
    return { lo, hi, sample };
  }, [course]);

  const y = (e: number) => ELE_BOT - ((e - prof.lo) / (prof.hi - prof.lo)) * (ELE_BOT - ELE_TOP);

  const linePath = prof.sample.map((p, i) => `${i ? "L" : "M"}${x(p.d).toFixed(1)},${y(p.ele).toFixed(1)}`).join("");
  const areaPath = `${linePath}L${x(D)},${ELE_BOT}L${x(0)},${ELE_BOT}Z`;

  const race = segments.filter((s) => s.phase === "race" && s.endD > s.startD);
  const totalUnits = toUnits(D, u);
  const tickStep = totalUnits > 30 ? 5 : totalUnits > 14 ? 2 : totalUnits > 4 ? 1 : 0.5;
  const ticks: number[] = [];
  for (let k = 0; k <= totalUnits + 1e-6; k += tickStep) ticks.push(k);

  const kickX = x(Math.max(0, D - settings.kickTargetFromEnd));
  const hoverSeg = hover != null ? race.find((s) => hover >= s.startD && hover <= s.endD) : undefined;

  return (
    <div ref={wrap} className="relative w-full select-none">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block"
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          setHover(Math.max(0, Math.min(D, ((e.clientX - r.left - padL) / (W - padL - padR)) * D)));
        }}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Course elevation with songs mapped to distance"
      >
        <defs>
          <clipPath id={`clip-${uid}`}>
            <path d={areaPath} />
          </clipPath>
          <pattern id={`hatch-${uid}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="4" height="8" fill="#ff3da5" opacity="0.35" />
          </pattern>
        </defs>

        {/* kick zone */}
        <rect x={kickX} y={BAND_Y - 18} width={x(D) - kickX} height={ELE_BOT - BAND_Y + 18} fill={`url(#hatch-${uid})`} />
        <text x={x(D) - 4} y={BAND_Y - 6} textAnchor="end" className="fill-hot font-display text-[10px] font-black uppercase">
          kick zone
        </text>

        {/* elevation painted by song */}
        <g clipPath={`url(#clip-${uid})`}>
          <rect x={0} y={ELE_TOP - 10} width={W} height={ELE_BOT} fill="#201e29" />
          {race.map((s) => (
            <rect
              key={s.track.key}
              x={x(s.startD)}
              y={ELE_TOP - 10}
              width={Math.max(0.5, x(s.endD) - x(s.startD))}
              height={ELE_BOT}
              fill={s.color}
              opacity={selectedKey ? (s.track.key === selectedKey ? 0.95 : 0.18) : 0.55}
            />
          ))}
        </g>
        <path d={linePath} fill="none" stroke="#fff3d6" strokeWidth={2} />

        {/* song bands */}
        {race.map((s) => {
          const x0 = x(s.startD);
          const w = Math.max(1, x(s.endD) - x0);
          const sel = s.track.key === selectedKey;
          const isKick = s.track.key === settings.kickKey;
          return (
            <g key={s.track.key} onClick={() => onSelect(sel ? null : s.track.key)} className="cursor-pointer">
              <rect
                x={x0 + 0.5}
                y={sel ? BAND_Y - 6 : BAND_Y}
                width={w - 1}
                height={sel ? BAND_H + 6 : BAND_H}
                rx={6}
                fill={s.color}
                stroke="#000"
                strokeWidth={sel ? 3 : 2}
                opacity={selectedKey && !sel ? 0.45 : 1}
              />
              {w > 46 && (
                <foreignObject x={x0 + 4} y={BAND_Y + 3} width={w - 8} height={BAND_H - 6} pointerEvents="none">
                  <div className="flex h-full flex-col justify-center overflow-hidden leading-tight text-ink">
                    <span className="truncate text-[11px] font-black">
                      {isKick ? "⚡ " : ""}
                      {s.track.title}
                    </span>
                    {w > 70 && <span className="truncate font-mono text-[9px] font-bold opacity-70">{s.track.bpm ? `${s.track.bpm} bpm` : "— bpm"}</span>}
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}

        {/* landmarks */}
        {course.landmarks.map((l) => (
          <g key={l.name}>
            <line x1={x(l.d)} x2={x(l.d)} y1={BAND_Y + BAND_H + 4} y2={y(pointAt(course, l.d).ele)} stroke="#fff3d6" strokeOpacity={0.35} strokeDasharray="2 3" />
            <text x={x(l.d)} y={BAND_Y + BAND_H + 20} textAnchor="middle" fontSize={14}>
              <title>{l.name}</title>
              {l.emoji}
            </text>
          </g>
        ))}

        {/* axis */}
        <line x1={x(0)} x2={x(D)} y1={ELE_BOT} y2={ELE_BOT} stroke="#fff3d6" strokeOpacity={0.3} />
        {ticks.map((k) => {
          const tx = x(Math.min(D, (k / totalUnits) * D));
          return (
            <g key={k}>
              <line x1={tx} x2={tx} y1={ELE_BOT} y2={ELE_BOT + 5} stroke="#fff3d6" strokeOpacity={0.5} />
              <text x={tx} y={ELE_BOT + 18} textAnchor="middle" className="fill-paper/60 font-mono text-[10px]">
                {k}
              </text>
            </g>
          );
        })}
        <text x={x(D)} y={ELE_BOT + 34} textAnchor="end" className="fill-paper/40 font-mono text-[10px] uppercase">
          {u}
        </text>

        {/* cursor */}
        {hover != null && (
          <line x1={x(hover)} x2={x(hover)} y1={BAND_Y - 8} y2={ELE_BOT} stroke="#d4ff3a" strokeWidth={1.5} />
        )}
        {runnerD != null && (
          <g>
            <line x1={x(runnerD)} x2={x(runnerD)} y1={BAND_Y - 12} y2={ELE_BOT} stroke="#d4ff3a" strokeWidth={3} />
            <circle cx={x(runnerD)} cy={y(pointAt(course, runnerD).ele)} r={7} fill="#d4ff3a" stroke="#000" strokeWidth={3} />
          </g>
        )}
      </svg>

      {hover != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-xl border-2 border-black bg-paper px-2.5 py-1.5 text-xs text-ink shadow-[3px_3px_0_#000]"
          style={{ left: Math.min(W - 190, Math.max(0, x(hover) + 10)), width: 180 }}
        >
          <div className="font-mono font-bold">
            {toUnits(hover, u).toFixed(2)} {u} · {fmtClock(model.timeAt(hover))}
          </div>
          <div className="truncate font-bold">{hoverSeg ? `♪ ${hoverSeg.track.title}` : "🔇 silence"}</div>
          <div className="font-mono text-[10px] opacity-70">elev {Math.round(pointAt(course, hover).ele)} m</div>
        </div>
      )}
    </div>
  );
}
