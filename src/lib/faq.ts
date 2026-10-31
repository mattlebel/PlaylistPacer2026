import { fmtPace } from "./race";

/**
 * Questions friends ask, answered for this runner. Edit the wording here; the page shows them in
 * this order under the map.
 */
export function faq({
  runner,
  paceSec,
  perMile,
  maxPerPerson,
  bib,
  open = true,
}: {
  runner: string;
  paceSec: number;
  perMile: number;
  maxPerPerson: number;
  bib?: string;
  /** Adding is still open. Once it closes, the questions about adding drop off. */
  open?: boolean;
}): { q: string; a: string }[] {
  const mins = Math.round(paceSec / 60);
  const all: { q: string; a: string; adding?: boolean }[] = [
    {
      q: `Will my song play exactly when ${runner} hits my mile?`,
      a: `Close, but not to the second. Every song goes into one Spotify playlist in course order, start to finish, and it plays straight through on ${runner}'s phone. At about ${fmtPace(paceSec)} a mile, each mile is roughly ${mins} minutes, or about ${perMile} songs. If ${runner} runs faster, or some miles have fewer songs, the music drifts a little ahead of the course; if slower, a little behind.`,
    },
    {
      q: `If ${runner} runs a mile faster, does song ${perMile} on that mile get skipped or cut off?`,
      a: `No. Nothing is skipped or cut short: the playlist doesn't jump ahead when ${runner} passes a mile marker. Every song plays all the way through, in order, so the last song on a mile is no worse off than the first. It may just play a bit after the marker instead of right at it.`,
    },
    {
      q: "What order do the songs on a mile play in?",
      a: "The order they were added. The first song dropped on a mile plays first.",
    },
    {
      q: `Does ${runner} get to skip songs?`,
      a: `It's ${runner}'s phone, so technically yes, but the idea is to let it play straight through, start to finish, with no shuffle. Before race morning ${runner} can also remove a song from the private runner page.`,
    },
    {
      adding: true,
      q: "How many songs can I add?",
      a: `Up to ${maxPerPerson}, so everyone gets a turn. Each mile holds ${perMile}, first come, first served. Each song can only be on the course once; songs already picked are greyed out in search.`,
    },
    {
      adding: true,
      q: "Can I change or remove my song?",
      a: `Yes, from the same phone or computer you added it on: tap its mile and choose "Remove mine", then add something else. That works until adding closes.`,
    },
    {
      adding: true,
      q: "When does adding close?",
      a: `6am on race morning (Sunday, November 1), so ${runner} can download the finished playlist before the start.`,
    },
    {
      q: `Will ${runner} know who picked each song?`,
      a: `Yes. Your first name shows on your songs ("from Sarah"), here on the map and on ${runner}'s list.`,
    },
    {
      q: `How can I follow ${runner} on race day?`,
      a: bib
        ? `Search bib ${bib} at liveresults.nyrr.org or in the TCS NYC Marathon app. The time next to each mile here is an estimate at ${runner}'s pace.`
        : `Search ${runner}'s name at liveresults.nyrr.org or in the TCS NYC Marathon app.`,
    },
  ];
  return all.filter((f) => open || !f.adding).map(({ q, a }) => ({ q, a }));
}
