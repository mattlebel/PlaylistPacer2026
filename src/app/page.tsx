import Link from "next/link";
import { ChipStack } from "@/components/ChipStack";
import { Shell } from "@/components/Shell";
import { MILES, mileLabel, RACE, SONGS_PER_MILE } from "@/lib/race";

// Illustrative: how full each mile might be a few days before the race.
const SAMPLE = [3, 2, 1, 3, 0, 1, 2, 0, 3, 2, 1, 0, 2, 3, 1, 3, 3, 1, 0, 2, 3, 2, 1, 3, 2, 1, 3];

export default function Home() {
  const total = SAMPLE.reduce((a, b) => a + b, 0);
  return (
    <Shell>
      <section className="flex flex-wrap items-center gap-12 pt-6 sm:pt-12">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-6">
          <div className="label">
            {RACE.name} · {RACE.dateLabel}
          </div>
          <h1 className="font-display text-[clamp(2.75rem,7vw,5.5rem)] font-extrabold leading-[0.93] tracking-[-0.04em] [text-wrap:balance]">
            Your marathon, soundtracked by your people.
          </h1>
          <p className="max-w-[38ch] text-xl leading-relaxed text-blush">
            Generate one link. Friends and family drag songs onto the miles of your course, up to {SONGS_PER_MILE} per mile, and you
            hear them right there on race day.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/new" className="btn bg-pink px-7 py-4 text-base">
              Generate my link
            </Link>
            <a href="#how" className="btn btn-ghost px-7 py-4 text-base">
              How it works
            </a>
          </div>
        </div>

        <div className="flex min-w-0 flex-[1_1_400px] justify-center">
          <div className="w-full max-w-[480px] rounded-md bg-ink/90 p-6 shadow-[0_24px_50px_rgb(8_10_40/0.35)] sm:p-7">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-2xl font-extrabold tracking-tight">Help Matt soundtrack 26.2</span>
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase text-pink/70">{total} songs · live</div>
            <div className="mt-6 flex items-end justify-between gap-[3px]" aria-hidden>
              {SAMPLE.map((c, i) => (
                <ChipStack key={i} count={c} max={SONGS_PER_MILE} size="sm" className="w-full [&>span]:!w-full" />
              ))}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[9px] text-pink/60" aria-hidden>
              <span>start</span>
              <span>13.1</span>
              <span>20</span>
              <span>26.2</span>
            </div>
            <ul className="mt-5 space-y-1.5 border-t border-pink/15 pt-4 text-sm">
              {[
                ["Mile 15", "Queensboro Bridge", "Mr. Brightside", "Sarah"],
                ["Mile 16", "First Avenue", "Dog Days Are Over", "Mom"],
                ["Mile 20", "The Bronx", "Can't Hold Us", "Jules"],
              ].map(([m, place, song, who]) => (
                <li key={m} className="flex items-baseline gap-3">
                  <span className="w-14 shrink-0 font-mono text-[10px] text-pink/60">{m}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {place} · <span className="text-chalk">{song}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] uppercase text-pink/70">{who}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="how" className="mt-20 grid scroll-mt-8 gap-4 md:grid-cols-3">
        {[
          ["Generate your link", "Type your name. You get a link to share and a private one for you. No accounts, for you or anyone else."],
          ["Friends drop songs on miles", `They search for a song and drag it onto a mile marker on the map. Each mile holds ${SONGS_PER_MILE}, and everyone sees the map fill up live.`],
          ["Hear them on the course", "Race morning, save every song to Spotify in course order, download it, and press play at the start."],
        ].map(([t, d], i) => (
          <div key={t} className="panel flex flex-col gap-2 p-6">
            <span className="label">Track {i + 1}</span>
            <h2 className="font-display text-2xl font-bold tracking-tight">{t}</h2>
            <p className="leading-relaxed text-blush">{d}</p>
          </div>
        ))}
      </section>

      <section className="mt-16">
        <h2 className="mb-1 font-display text-3xl font-bold tracking-tight">The big moments</h2>
        <p className="mb-6 text-blush">Every mile gets songs. These are the ones people fight over.</p>
        <ol className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
          {MILES.filter((m) => m.landmark).map((m) => (
            <li key={m.n} className="flex gap-4">
              <span className="w-14 shrink-0 pt-1 font-mono text-[11px] text-pink/60">{mileLabel(m.n)}</span>
              <div>
                <div className="font-semibold">
                  {m.title} <span className="text-butter">★</span>
                </div>
                <div className="text-sm text-blush/90">{m.note}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </Shell>
  );
}
