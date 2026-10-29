"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Manage } from "@/lib/client/api";
import { manageKeyFor } from "@/lib/client/keys";
import { mileByN, mileLabel, RACE } from "@/lib/race";
import { savePlaylist, spotifyConfigured, spotifyConnected, spotifyTrackUrl, startSpotifyLogin } from "@/lib/spotify";
import { SpotifyIcon } from "./brand";
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
      </section>

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

      <Playlist data={data} name={name} />

      <section>
        <h2 className="mb-3 font-display text-2xl font-bold">
          {data.total} {data.total === 1 ? "song" : "songs"} on {data.milesWithSongs} {data.milesWithSongs === 1 ? "mile" : "miles"}
        </h2>
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

function Playlist({ data, name }: { data: Manage; name: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const all = data.miles.flatMap((m) => m.songs);
  const uris = all.map((e) => e.song.uri).filter((u): u is string => !!u);
  const typed = all.length - uris.length;

  const save = async () => {
    if (!spotifyConnected()) return startSpotifyLogin();
    setBusy(true);
    setMsg(null);
    try {
      setLink(await savePlaylist(`${name}'s ${RACE.name}`, "Picked by friends and family with Playlist Pacer. In course order, start to finish. No shuffle!", uris));
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
          Every song, in course order, saved to your Spotify. Adding closes at 6am on race morning, so save it after that to get them all
          (you can save again any time). Then download it in Spotify so it plays without signal.
        </p>
      </div>
      {spotifyConfigured() ? (
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn bg-pink px-6 py-3 text-sm" onClick={save} disabled={busy || !uris.length}>
            <SpotifyIcon size={18} />
            {spotifyConnected() ? (busy ? "Saving…" : `Save ${uris.length} songs to Spotify`) : "Connect Spotify to save the playlist"}
          </button>
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold underline">
              <SpotifyIcon size={16} /> Open Spotify
            </a>
          )}
          {msg && <span className="text-sm text-coral">{msg}</span>}
        </div>
      ) : (
        <p className="text-sm text-pink/70">Spotify isn&apos;t connected to this app yet, so build the playlist by hand from the list below.</p>
      )}
      {spotifyConfigured() && typed > 0 && (
        <p className="text-sm text-pink/70">
          {typed} {typed === 1 ? "song was" : "songs were"} typed in rather than picked from Spotify. Add {typed === 1 ? "it" : "them"} to the
          playlist by hand.
        </p>
      )}
    </section>
  );
}

function SongRow({ entry: e, raceId, manageKey, onChange }: { entry: Entry; raceId: string; manageKey: string; onChange(): void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl bg-ink/20 p-2 pr-3">
      {e.song.art && e.song.spotifyId ? (
        <a href={spotifyTrackUrl(e.song.spotifyId)} target="_blank" rel="noreferrer" aria-label={`Play ${e.song.title} on Spotify`} className="h-12 w-12 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={e.song.art} alt="" className="h-full w-full rounded-[4px] object-cover" />
        </a>
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
      {e.song.spotifyId && (
        <a href={spotifyTrackUrl(e.song.spotifyId)} target="_blank" rel="noreferrer" className="shrink-0 p-1 text-pink/70 hover:text-chalk" aria-label={`Open ${e.song.title} on Spotify`}>
          <SpotifyIcon size={18} />
        </a>
      )}
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
    </li>
  );
}
