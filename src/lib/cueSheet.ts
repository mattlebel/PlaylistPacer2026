import { fmtClock, fmtPace, toUnits } from "./format";
import type { Plan } from "./usePlan";

/** Plain-text plan: one line per race track with its mile and race clock, plus source credits. */
export function cueSheet(plan: Plan, playlist: { name: string; url?: string | null }) {
  const u = plan.settings.units;
  const lines = [
    `${plan.course.name} — goal ${fmtClock(plan.model.goal, true)} (${fmtPace(plan.model.goal / plan.course.distance, u)})`,
    `Playlist: ${playlist.name}`,
    "",
  ];
  for (const s of plan.segments) {
    if (s.phase !== "race") continue;
    const closer = s.track.key === plan.settings.closerKey ? "★ " : "  ";
    lines.push(`${closer}${toUnits(s.startD, u).toFixed(2).padStart(5)} ${u}  ${fmtClock(s.raceStart, true)}  ${s.track.title} — ${s.track.artist}`);
  }
  lines.push("");
  if (playlist.url) lines.push(`Tracks from Spotify: ${playlist.url}`);
  if (plan.course.source.startsWith("strava")) {
    lines.push(`Course powered by Strava${plan.course.sourceUrl ? ` · View on Strava: ${plan.course.sourceUrl}` : ""}`);
    if (plan.course.device) lines.push(`Recorded on ${plan.course.device}`);
  }
  lines.push("made with Playlist Pacer");
  return lines.join("\n");
}
