import Link from "next/link";
import { Shell } from "@/components/Shell";
import { fmtMile, MOMENTS, RACE } from "@/lib/race";

// Illustrative registry on the sleeve: what friends see when they open your link.
const SAMPLE: Record<string, string> = {
  brooklyn: "Dana",
  "5k": "Mom",
  lafayette: "Priya",
  queensboro: "Sarah",
  "first-ave": "Uncle Ray",
  bronx: "Jules",
  "central-park": "Coach K",
};

export default function Home() {
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
            Pick your start, halfway and finish songs, then share one link. Friends and family each claim a moment on the
            course and plant a song with a short note. You hear their songs out there, and read every note after the finish.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/new" className="btn bg-pink px-7 py-4 text-base">
              Set up my race
            </Link>
            <a href="#how" className="btn btn-ghost px-7 py-4 text-base">
              How it works
            </a>
          </div>
        </div>

        <div className="flex min-w-0 flex-[1_1_400px] justify-center">
          <div className="w-full max-w-[460px] rounded-md bg-pink p-6 text-ink shadow-[0_24px_50px_rgb(8_10_40/0.35)] sm:p-7">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-2xl font-extrabold tracking-tight">Help Matt run 26.2</span>
              <span className="font-mono text-[10px] uppercase">7 of 13 planted</span>
            </div>
            <ol className="mt-4 space-y-1.5 text-sm">
              {MOMENTS.slice(0, 11).map((m) => {
                const who = SAMPLE[m.id];
                return (
                  <li key={m.id} className="flex items-baseline gap-3">
                    <span className="w-9 shrink-0 font-mono text-[10px] opacity-60">{fmtMile(m.d)}</span>
                    <span className="min-w-0 flex-1 truncate">{m.label}</span>
                    <span className={`shrink-0 font-mono text-[10px] uppercase ${m.owner === "runner" ? "text-ground" : who ? "" : "opacity-50"}`}>
                      {m.owner === "runner" ? "Matt's pick" : who ? `claimed by ${who}` : "open"}
                    </span>
                  </li>
                );
              })}
              <li className="pl-12 font-mono text-[10px] opacity-60">+ 5 more moments to the finish</li>
            </ol>
          </div>
        </div>
      </section>

      <section id="how" className="mt-20 grid scroll-mt-8 gap-4 md:grid-cols-3">
        {[
          ["Pick your three", "Choose the songs for your start on the Verrazzano, halfway at the Pulaski Bridge, and the final stretch."],
          ["Share the link", "Friends and family each claim a moment, like the Queensboro Bridge or mile 20 in the Bronx, and plant a song with a note. No accounts."],
          ["Hear them on the course", "Race morning, load the playlist and press play at the start. Songs stay a surprise, and the notes unlock after you finish."],
        ].map(([t, d], i) => (
          <div key={t} className="panel flex flex-col gap-2 p-6">
            <span className="label">Track {i + 1}</span>
            <h2 className="font-display text-2xl font-bold tracking-tight">{t}</h2>
            <p className="leading-relaxed text-blush">{d}</p>
          </div>
        ))}
      </section>

      <section className="mt-16">
        <h2 className="mb-1 font-display text-3xl font-bold tracking-tight">The moments</h2>
        <p className="mb-6 text-blush">Sixteen spots along the five boroughs. Three are yours; your people claim the rest.</p>
        <ol className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
          {MOMENTS.map((m) => (
            <li key={m.id} className="flex gap-4">
              <span className="w-10 shrink-0 pt-1 font-mono text-[11px] text-pink/60">{fmtMile(m.d)}</span>
              <div>
                <div className="font-semibold">
                  {m.label}
                  {m.owner === "runner" && <span className="label ml-2 text-chalk">your pick</span>}
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
