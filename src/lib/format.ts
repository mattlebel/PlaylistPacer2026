import { METERS_PER_MILE } from "./geo";
import type { Units } from "./types";

export function fmtClock(sec: number, forceHours = false) {
  const neg = sec < 0;
  let s = Math.round(Math.abs(sec));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const body =
    h > 0 || forceHours
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
  return (neg ? "-" : "") + body;
}

export function parseClock(text: string): number | null {
  const parts = text.trim().split(":").map((p) => p.trim());
  if (!parts.length || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  return parts.map(Number).reduce((acc, v) => acc * 60 + v, 0);
}

export const toUnits = (m: number, u: Units) => (u === "mi" ? m / METERS_PER_MILE : m / 1000);
export const fromUnits = (v: number, u: Units) => (u === "mi" ? v * METERS_PER_MILE : v * 1000);

export function fmtDist(m: number, u: Units, digits = 2) {
  return `${toUnits(m, u).toFixed(digits)}`;
}

/** Pace as m:ss per unit. */
export function fmtPace(secPerMeter: number, u: Units) {
  const perUnit = secPerMeter * (u === "mi" ? METERS_PER_MILE : 1000);
  return `${fmtClock(perUnit)}/${u}`;
}
