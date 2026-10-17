#!/usr/bin/env node
// Turn a race GPX (e.g. your own Strava/Garmin export) into a course file for the app.
//
//   node scripts/import-course.mjs <race.gpx> <out.json> [stepMeters=25]
//
// Keeps only geometry: points resampled every `step` meters as [lat, lon, ele].
// Timestamps, heart rate, cadence and power are dropped, so the output is safe to commit.
import { readFileSync, writeFileSync } from "node:fs";

const [, , input, output, stepArg] = process.argv;
if (!input || !output) {
  console.error("usage: node scripts/import-course.mjs <race.gpx> <out.json> [stepMeters]");
  process.exit(1);
}
const step = Number(stepArg ?? 25);
const xml = readFileSync(input, "utf8");

const raw = [];
const re = /<(?:trkpt|rtept)\s+lat="([-\d.]+)"\s+lon="([-\d.]+)"[^>]*?(?:\/>|>([\s\S]*?)<\/(?:trkpt|rtept)>)/g;
for (const m of xml.matchAll(re)) {
  const ele = m[3]?.match(/<ele>([-\d.]+)<\/ele>/)?.[1];
  raw.push({ lat: Number(m[1]), lon: Number(m[2]), ele: ele === undefined ? null : Number(ele) });
}
if (raw.length < 2) throw new Error("No track points found.");

const R = 6371008.8;
const rad = (x) => (x * Math.PI) / 180;
const hav = (a, b) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

// Drop repeated points (watch standing still), then measure cumulative distance.
const pts = raw.filter((p, i) => i === 0 || p.lat !== raw[i - 1].lat || p.lon !== raw[i - 1].lon);
const cum = [0];
for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + hav(pts[i - 1], pts[i]));
const total = cum.at(-1);

const out = [];
let j = 0;
for (let d = 0; d <= total; d += step) {
  while (j < cum.length - 2 && cum[j + 1] < d) j++;
  const f = (d - cum[j]) / (cum[j + 1] - cum[j] || 1);
  const a = pts[j];
  const b = pts[j + 1];
  const ele = a.ele === null || b.ele === null ? 0 : a.ele + (b.ele - a.ele) * f;
  out.push([+(a.lat + (b.lat - a.lat) * f).toFixed(5), +(a.lon + (b.lon - a.lon) * f).toFixed(5), +ele.toFixed(1)]);
}
const last = pts.at(-1);
out.push([+last.lat.toFixed(5), +last.lon.toFixed(5), +(last.ele ?? 0).toFixed(1)]);

const name = xml.match(/<name>([^<]*)<\/name>/)?.[1] ?? "Course";
writeFileSync(output, JSON.stringify({ name, measuredMeters: Math.round(total), points: out }) + "\n");
console.log(`${name}: ${raw.length} GPS points → ${out.length} course points every ${step} m, ${(total / 1000).toFixed(2)} km measured.`);
