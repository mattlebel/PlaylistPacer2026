"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Manage } from "@/lib/client/api";
import { manageKeyFor } from "@/lib/client/keys";
import { etaAtMile, finishEta, fmtPace, fmtTimeOfDay, mileByN, mileLabel, RACE, startHhmm, waveLabel } from "@/lib/race";
import { RaceDetailsFields, useRaceDetails } from "./RaceDetails";
import { cheer } from "@/lib/sounds";
import { savePlaylist, spotifyConfigured, spotifyConnected, spotifyTrackUrl, startSpotifyLogin } from "@/lib/spotify";
import { wrap } from "@/lib/wrapped";
import { SpotifyIcon } from "./brand";
import { Wrapped } from "./Wrapped";
import { PreviewButton, SpotifyPlayer } from "./SpotifyPlayer";
import { usePreview } from "./usePreview";
import { ChipStack } from "./ChipStack";
import { Toast } from "./ui";

const first = (n: string) => n.trim().split(/\s+/)[0];
type Entry = Manage["miles"][number]["songs"][number];

export function ManageRace() {
  const { id } = useParams<{ id: string }>();
  const [key, setKey] = useState<string | null | undefined>(undefined);
  const [data, setData] = useState<Manage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);

  const load = useCallback(
    async (k: string) => {
      try {
        setData(await api<Manage>(`/api/races/${id}/manage`, { key: { header: "x-manage-key", value: k } }));
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : "Couldn't load your race.");
      }
    },
    [id],
  );

  useEffect(() => {
    // Read the private key from the URL fragment (or this device) once, then fetch.
    const k = manageKeyFor(id);
    /* eslint-disable react-hooks/set-state-in-effect */
    setKey(k);
    setIsNew(new URLSearchParams(window.location.search).get("new") === "1");
    /* eslint-enable react-hooks/set-state-in-effect */
    if (k) load(k);
  }, [id, load]);

  if (key === null)
    return (
      <div className="max-w-xl pt-10">
        <h1 className="font-display text-3xl font-bold">This page needs your private link</h1>
        <p className="mt-3 text-blush">
          Open the private link from your email, or from the device you set up your race on. Friends should use the share link instead.
        </p>
      </div>
    );
  if (err) return <p className="pt-10 text-lg">{err}</p>;
  if (!data || !key) return <p className="pt-10 text-pink/60">Loading…</p>;

  const name = first(data.runnerName);
  const origin = window.location.origin;
  const shareUrl = `${origin}/r/${data.id}`;
  const manageUrl = `${origin}/r/${data.id}/manage#key=${key}`;
  const shareText = `I'm running the ${RACE.name} on November 1! Drop a song on a mile of my course and I'll hear it out there:`;
  const withSongs = data.miles.filter((m) => m.songs.length);

  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(msg);
    } catch {
      setToast("Couldn't copy. Select the link and copy it instead.");
    }
  };

  return (
    <div className="space-y-10 pt-4">
      <section>
        <div className="label">
          {RACE.name} · {RACE.dateLabel}
        </div>
        <h1 className="mt-2 font-display text-5xl font-extrabold tracking-tight">Your race, {name}</h1>
        <RaceSummary data={data} manageKey={key} onSaved={() => load(key)} onToast={setToast} />
      </section>

      <Wrapped stats={wrap(data.miles, data.runnerName, data.paceSec)} runner={name} label={data.open ? "So far · wrapped" : "Wrapped"} />

      {isNew && (
        <section className="stk bg-pink p-5">
          <h2 className="font-display text-xl font-bold">You&apos;re set up. Save this page.</h2>
          <p className="mt-1 text-sm">
            This is your private link. It&apos;s how you get back here to see every song and save your race-day playlist. Bookmark it,
            or copy it somewhere safe.
          </p>
          <button className="btn mt-3 bg-ink px-4 py-2 text-xs text-pink" onClick={() => copy(manageUrl, "Private link copied.")}>
            Copy my private link
          </button>
        </section>
      )}

      <section className="panel space-y-4 p-6">
        <h2 className="font-display text-2xl font-bold">Share with friends and family</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input readOnly aria-label="Share link" className="field font-mono text-sm" value={shareUrl} onFocus={(e) => e.target.select()} />
          <button className="btn shrink-0 whitespace-nowrap bg-pink px-5 py-3 text-sm" onClick={() => copy(`${shareText} ${shareUrl}`, "Link and message copied.")}>
            Copy link
          </button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button
              className="btn btn-ghost shrink-0 whitespace-nowrap px-5 py-3 text-sm"
              onClick={() => navigator.share({ title: "Soundtrack my marathon", text: shareText, url: shareUrl }).catch(() => {})}
            >
              Share…
            </button>
          )}
        </div>
        <p className="text-sm text-pink/70">
          Each mile holds {data.perMile} songs. Adding closes at 6am on race morning.{" "}
          <Link href={`/r/${data.id}`} className="underline underline-offset-4 hover:text-chalk">
            Open the live map
          </Link>
        </p>
      </section>

      <Playlist data={data} name={name} manageKey={key} />

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl font-bold">
            {data.total} {data.total === 1 ? "song" : "songs"} on {data.milesWithSongs} {data.milesWithSongs === 1 ? "mile" : "miles"}
          </h2>
          {data.total > 0 && (
            <button className="text-sm font-semibold underline underline-offset-4 hover:text-chalk" onClick={() => downloadCsv(data)}>
              Download as a spreadsheet (CSV)
            </button>
          )}
        </div>
        {withSongs.length === 0 ? (
          <p className="text-blush">Nothing yet. Share your link and watch the map fill up.</p>
        ) : (
          <ol className="space-y-3">
            {withSongs.map((m) => (
              <li key={m.n} className="panel p-4">
                <div className="mb-3 flex items-center gap-3">
                  <ChipStack count={m.songs.length} max={data.perMile} size="sm" />
                  <span className="font-mono text-[10px] uppercase text-pink/70">{mileLabel(m.n)}</span>
                  <span className="font-display text-lg font-bold">{mileByN(m.n)?.title}</span>
                  <span className="ml-auto font-mono text-[11px] text-pink/70">~{fmtTimeOfDay(etaAtMile(new Date(data.startTime), data.paceSec, m.n))}</span>
                </div>
                <ul className="space-y-2">
                  {m.songs.map((e) => (
                    <SongRow key={e.id} entry={e} raceId={data.id} manageKey={key} onChange={() => load(key)} />
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

/** "Wave 1 · 9:10 AM · 11:00/mile · bib 13302 · finish ~1:58 PM", with an editor. */
function RaceSummary({ data, manageKey, onSaved, onToast }: { data: Manage; manageKey: string; onSaved(): void; onToast(m: string): void }) {
  const start = new Date(data.startTime);
  const hhmm = startHhmm(start);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const details = useRaceDetails({ startTime: hhmm, paceSec: data.paceSec, bib: data.bib });
  const parts = [
    `${waveLabel(hhmm) ?? "Start"} · ${fmtTimeOfDay(start)}`,
    `${fmtPace(data.paceSec)}/mile`,
    data.bib ? `bib ${data.bib}` : null,
    `finish ~${fmtTimeOfDay(finishEta(start, data.paceSec))}`,
  ].filter(Boolean);

  const save = async () => {
    if (!details.valid) return;
    setBusy(true);
    try {
      await api(`/api/races/${data.id}/manage`, {
        method: "PATCH",
        key: { header: "x-manage-key", value: manageKey },
        body: JSON.stringify({ ...details.values, bib: details.values.bib ?? null }),
      });
      setEditing(false);
      onToast("Saved. Times along the course are updated.");
      onSaved();
    } catch (e) {
      onToast(e instanceof ApiError ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <p className="text-blush">
        {parts.join(" · ")}{" "}
        <button className="ml-1 text-sm font-semibold underline underline-offset-4 hover:text-chalk" onClick={() => setEditing(!editing)}>
          {editing ? "Cancel" : "Edit"}
        </button>
      </p>
      {editing && (
        <div className="panel mt-4 space-y-4 p-5">
          <RaceDetailsFields details={details} />
          <button className="btn bg-pink px-6 py-3 text-sm" disabled={!details.valid || busy} onClick={save}>
            {busy ? "Saving…" : "Save race details"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Every song as a spreadsheet: a backup that outlives the free database, and handy for building playlists by hand. */
function downloadCsv(data: Manage) {
  const cell = (v: string | number | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const start = new Date(data.startTime);
  const rows = [
    ["Mile", "Spot", "Around", "Song", "Artist", "From", "Note", "Spotify link"],
    ...data.miles.flatMap((m) =>
      m.songs.map((e) => [
        mileLabel(m.n),
        mileByN(m.n)?.title,
        fmtTimeOfDay(etaAtMile(start, data.paceSec, m.n)),
        e.song.title,
        e.song.artist,
        e.isRunner ? "(your pick)" : e.from,
        e.message,
        e.song.spotifyId ? spotifyTrackUrl(e.song.spotifyId) : "",
      ]),
    ),
  ];
  const csv = rows.map((r) => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${first(data.runnerName).toLowerCase()}-nyc-marathon-songs.csv` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Playlist({ data, name, manageKey }: { data: Manage; name: string; manageKey: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [updated, setUpdated] = useState(false);
  const all = data.miles.flatMap((m) => m.songs);

  const save = async () => {
    if (!spotifyConnected()) return startSpotifyLogin();
    setBusy(true);
    setMsg(null);
    try {
      const res = await savePlaylist(
        `${name}'s ${RACE.name}`,
        "Picked by friends and family with Playlist Pacer. In course order, start to finish. No shuffle!",
        all.map((e) => e.song),
        data.playlistId,
      );
      setLink(res.url);
      setUpdated(res.updated);
      cheer();
      // Remember it, so the next save updates this playlist instead of making another.
      if (res.id !== data.playlistId) {
        await api(`/api/races/${data.id}/manage`, {
          method: "PATCH",
          key: { header: "x-manage-key", value: manageKey },
          body: JSON.stringify({ playlistId: res.id }),
        }).catch(() => {});
      }
      setMissing(res.missing.map((s) => `${s.title} (${s.artist})`));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel space-y-4 p-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Race-day playlist</h2>
        <p className="mt-1 text-blush">
          Every song, in course order, saved to your Spotify. Save it any time; saving again updates the same playlist, so the copy
          downloaded on your phone just refreshes. Adding closes at 6am on race morning, so do a last save after that, then download it
          in Spotify so it plays without signal.
        </p>
      </div>
      {spotifyConfigured() ? (
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn bg-pink px-6 py-3 text-sm" onClick={save} disabled={busy || !all.length}>
            <SpotifyIcon size={18} />
            {spotifyConnected()
              ? busy
                ? "Saving…"
                : `${data.playlistId ? "Update" : "Save"} ${all.length} ${all.length === 1 ? "song" : "songs"} ${data.playlistId ? "in" : "to"} Spotify`
              : "Connect Spotify to save the playlist"}
          </button>
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold underline">
              <SpotifyIcon size={16} /> {updated ? "Updated. Open Spotify" : "Saved. Open Spotify"}
            </a>
          )}
          {msg && <span className="text-sm text-coral">{msg}</span>}
        </div>
      ) : (
        <p className="text-sm text-pink/70">Spotify isn&apos;t connected to this app yet, so build the playlist by hand from the list below.</p>
      )}
      {missing.length > 0 && (
        <p className="text-sm text-pink/70">
          Couldn&apos;t find {missing.length === 1 ? "this one" : "these"} on Spotify, so add {missing.length === 1 ? "it" : "them"} by hand:{" "}
          {missing.join(", ")}.
        </p>
      )}
    </section>
  );
}

function SongRow({ entry: e, raceId, manageKey, onChange }: { entry: Entry; raceId: string; manageKey: string; onChange(): void }) {
  const [confirm, setConfirm] = useState(false);
  const preview = usePreview();
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl bg-ink/20 p-2 pr-3">
      {e.song.art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.song.art} alt="" className="h-12 w-12 shrink-0 rounded-[4px] object-cover" />
      ) : (
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[4px] bg-ink-3">♪</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-chalk">
          {e.song.title} <span className="font-normal text-pink/70">· {e.song.artist}</span>
        </div>
        <div className="text-sm">{e.isRunner ? "Your pick" : `from ${e.from ?? "someone who didn't leave a name"}`}</div>
        {e.message && <blockquote className="mt-1 border-l-2 border-pink/40 pl-3 text-sm text-blush">“{e.message}”</blockquote>}
      </div>
      {e.song.spotifyId && <PreviewButton song={e.song} preview={preview} />}
      <div className="shrink-0 text-xs">
        {confirm ? (
          <span className="flex gap-2">
            <button
              className="font-semibold text-coral underline"
              onClick={async () => {
                await api(`/api/races/${raceId}/plants/${e.id}`, { method: "DELETE", key: { header: "x-manage-key", value: manageKey } });
                onChange();
              }}
            >
              Remove it
            </button>
            <button className="underline" onClick={() => setConfirm(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button className="text-pink/50 underline hover:text-pink" onClick={() => setConfirm(true)} aria-label={`Remove ${e.song.title}`}>
            Remove
          </button>
        )}
      </div>
      {e.song.spotifyId && preview.embedFor(e.song) && (
        <SpotifyPlayer id={e.song.spotifyId} title={`Preview ${e.song.title} on Spotify`} autoPlay={preview.embedFor(e.song)!.auto} className="basis-full" />
      )}
    </li>
  );
}
