import { fmtDuration, fmtTrack, type Wrapped as WrappedStats } from "@/lib/wrapped";

/**
 * The race playlist, wrapped: big numbers on a bright card, plus a leaderboard of who added the
 * most songs. On the runner's page always; on the friends' page as a recap once adding closes.
 */
export function Wrapped({ stats, runner, label, leaders = 8 }: { stats: WrappedStats; runner: string; label: string; leaders?: number }) {
  if (!stats.songs) return null;
  const top = stats.leaderboard.slice(0, leaders);
  const more = stats.leaderboard.length - top.length;
  const best = top[0]?.count ?? 1;
  const tiles = [
    [String(stats.songs), stats.songs === 1 ? "song" : "songs"],
    [`${stats.estimated ? "~" : ""}${fmtDuration(stats.seconds)}`, "of music"],
    [String(stats.artists), stats.artists === 1 ? "artist" : "artists"],
    [String(stats.people), stats.people === 1 ? "friend" : "friends"],
  ];
  const cover = Math.min(1, stats.coverage);

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]" aria-label="Race playlist, wrapped">
      <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-pink via-butter to-mint p-5 text-ink sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/70">{label}</div>
            <h2 className="mt-1 font-display text-3xl font-extrabold leading-none tracking-tight sm:text-4xl">{runner}&apos;s race playlist</h2>
          </div>
          {stats.art.length >= 4 && (
            <div className="grid shrink-0 grid-cols-3 gap-0.5 overflow-hidden rounded-md shadow-[0_10px_24px_rgb(14_14_20/0.3)]" aria-hidden>
              {stats.art.slice(0, stats.art.length >= 9 ? 9 : 3).map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt="" className="h-7 w-7 object-cover sm:h-9 sm:w-9" />
              ))}
            </div>
          )}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {tiles.map(([n, what]) => (
            <div key={what}>
              <dt className="sr-only">{what}</dt>
              <dd className="font-display text-3xl font-extrabold leading-none tracking-tight sm:text-4xl">{n}</dd>
              <dd className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink/70">{what}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-3 text-sm font-semibold">
            <span>
              {stats.coverage >= 1
                ? `Enough music for the whole race, and then some`
                : `Covers ${Math.round(stats.coverage * 100)}% of ${runner}'s run`}
            </span>
            <span className="shrink-0 text-ink/70">~{fmtDuration(stats.raceSeconds)} at race pace</span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink/15" role="img" aria-label={`Music covers ${Math.round(stats.coverage * 100)}% of the race`}>
            <div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(2, cover * 100)}%` }} />
          </div>
        </div>

        <ul className="mt-4 space-y-1 text-sm">
          {stats.topArtists.length > 0 && (
            <li>
              <strong>Top {stats.topArtists.length === 1 ? "artist" : "artists"}:</strong>{" "}
              {stats.topArtists.map((a) => `${a.name} (${a.count})`).join(" · ")}
            </li>
          )}
          {stats.longest && (
            <li>
              <strong>Longest track:</strong> {stats.longest.title} · {stats.longest.artist} · {fmtTrack(stats.longest.seconds)}
            </li>
          )}
          <li>
            <strong>Miles with music:</strong> {stats.milesWithSongs} of 27
          </li>
        </ul>
      </div>

      <div className="panel p-5 sm:p-6">
        <div className="label">Leaderboard · who added the most</div>
        <ol className="mt-3 space-y-2">
          {top.map((p, i) => (
            <li key={`${p.name}-${p.isRunner}`} className="flex items-center gap-3">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-display text-sm font-bold ${i === 0 ? "bg-butter text-ink" : "bg-ink/30"}`}>
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-semibold text-chalk">
                    {p.name}
                    {p.isRunner && <span className="font-normal text-pink/60"> (runner)</span>}
                  </span>
                  <span className="shrink-0 font-mono text-xs">
                    {p.count} {p.count === 1 ? "song" : "songs"}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/30">
                  <div className="h-full rounded-full bg-gradient-to-r from-pink to-butter" style={{ width: `${(p.count / best) * 100}%` }} />
                </div>
              </div>
            </li>
          ))}
        </ol>
        {more > 0 && (
          <p className="mt-3 text-xs text-pink/60">
            And {more} more {more === 1 ? "person" : "people"}. Thank you all!
          </p>
        )}
      </div>
    </section>
  );
}
