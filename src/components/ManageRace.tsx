"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Manage } from "@/lib/client/api";
import { manageKeyFor } from "@/lib/client/keys";
import { confetti } from "@/lib/confetti";
import { fmtMile, fmtTimeOfDay, momentById, RACE } from "@/lib/race";
import { savePlaylist, spotifyConfigured, spotifyConnected, spotifyTrackUrl, startSpotifyLogin } from "@/lib/spotify";
import { SpotifyIcon } from "./brand";
import { Toast } from "./ui";

const first = (n: string) => n.trim().split(/\s+/)[0];
const at = (iso: string) => fmtTimeOfDay(new Date(iso));
const trackId = (uri?: string) => uri?.split(":")[2];

export function ManageRace() {
  const { id } = useParams<{ id: string }>();
  const [key, setKey] = useState<string | null | undefined>(undefined);
  const [data, setData] = useState<Manage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);

  const load = useCallback(async (k: string) => {
    try {
      setData(await api<Manage>(`/api/races/${id}/manage`, { key: { header: "x-manage-key", value: k } }));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't load your race.");
    }
  }, [id]);

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
          Open the manage link from your email, or from the device you set up your race on. Friends should use the share link instead.
        </p>
      </div>
    );
  if (err) return <p className="pt-10 text-lg">{err}</p>;
  if (!data || !key) return <p className="pt-10 text-pink/60">Loading…</p>;

  const name = first(data.runnerName);
  const origin = window.location.origin;
  const shareUrl = `${origin}/r/${data.id}`;
  const manageUrl = `${origin}/r/${data.id}/manage#key=${key}`;
  const shareText = `I'm running the ${RACE.name} on November 1! Plant a song along my course and I'll hear it out there:`;

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
        <div className="label">{RACE.name} · {RACE.dateLabel}</div>
        <h1 className="mt-2 font-display text-5xl font-extrabold tracking-tight">Your race, {name}</h1>
        <p className="mt-2 text-blush">
          Start {at(data.startTime)} · goal {Math.floor(data.goalSec / 3600)}:{String(Math.floor((data.goalSec % 3600) / 60)).padStart(2, "0")}
        </p>
      </section>

      {isNew && (
        <section className="stk bg-pink p-5">
          <h2 className="font-display text-xl font-bold">You&apos;re set up. Save this page.</h2>
          <p className="mt-1 text-sm">
            This is your private link. It&apos;s how you get back here on race morning and read your notes after the finish.
            Bookmark it, or copy it somewhere safe.
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
            <button className="btn btn-ghost shrink-0 whitespace-nowrap px-5 py-3 text-sm" onClick={() => navigator.share({ title: "Plant a song for my marathon", text: shareText, url: shareUrl }).catch(() => {})}>
              Share…
            </button>
          )}
        </div>
        <p className="text-sm text-pink/70">Planting closes two hours before your wave. Everyone gets up to two songs.</p>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-bold">
            {data.planted} of {data.friendMoments} moments planted
          </h2>
          {!data.revealed && <span className="label">Songs and notes stay sealed until you finish</span>}
        </div>
        <ol className="space-y-2">
          {data.moments.map((m) => (
            <MomentRow key={m.id} m={m} raceId={data.id} manageKey={key} onChange={() => load(key)} revealed={data.revealed} />
          ))}
        </ol>
      </section>

      <RaceDay data={data} name={name} />

      {data.canReveal && !data.revealed && (
        <section className="stk bg-pink p-6">
          <h2 className="font-display text-2xl font-bold">Crossed the line?</h2>
          <p className="mt-1">Reveal every song and note from your people.</p>
          <button
            className="btn mt-4 bg-ink px-6 py-3 text-sm text-pink"
            onClick={async () => {
              await api(`/api/races/${data.id}/reveal`, { method: "POST", key: { header: "x-manage-key", value: key } });
              confetti();
              load(key);
            }}
          >
            I finished. Reveal my notes
          </button>
        </section>
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

function MomentRow({
  m,
  raceId,
  manageKey,
  onChange,
  revealed,
}: {
  m: Manage["moments"][number];
  raceId: string;
  manageKey: string;
  onChange(): void;
  revealed: boolean;
}) {
  const mo = momentById(m.id)!;
  const [confirm, setConfirm] = useState(false);
  return (
    <li className={`rounded-2xl p-4 ${m.from || m.owner === "runner" ? "bg-ink/20" : "bg-ink/10"}`}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="w-20 shrink-0 font-mono text-[11px] leading-snug text-pink/70">
          <div>mi {fmtMile(mo.d)}</div>
          <div>~{at(m.eta)}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{mo.label}</div>
          {m.owner === "runner" && m.song && <div className="text-sm text-pink/80">Your pick · {m.song.title} · {m.song.artist}</div>}
          {m.owner === "friend" && !m.from && <div className="text-sm text-pink/50">Open</div>}
          {m.from && !revealed && <div className="text-sm text-chalk">Planted by {m.from} · sealed</div>}
          {m.from && revealed && m.song && (
            <div className="mt-2 flex gap-3">
              {m.song.art && m.song.spotifyId && (
                <a href={spotifyTrackUrl(m.song.spotifyId)} target="_blank" rel="noreferrer" aria-label={`Play ${m.song.title} on Spotify`} className="h-12 w-12 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.song.art} alt="" className="h-full w-full rounded-[4px] object-cover" />
                </a>
              )}
              <div className="min-w-0">
                <div className="font-semibold text-chalk">{m.song.title} <span className="font-normal text-pink/70">· {m.song.artist}</span></div>
                <div className="text-sm">from {m.from}</div>
                {m.message && <blockquote className="mt-1 border-l-2 border-pink/40 pl-3 text-blush">“{m.message}”</blockquote>}
              </div>
            </div>
          )}
        </div>
        {m.plantId && !revealed && (
          <div className="shrink-0 text-xs">
            {confirm ? (
              <span className="flex gap-2">
                <button
                  className="font-semibold text-coral underline"
                  onClick={async () => {
                    await api(`/api/races/${raceId}/plants/${m.plantId}`, { method: "DELETE", key: { header: "x-manage-key", value: manageKey } });
                    onChange();
                  }}
                >
                  Remove it
                </button>
                <button className="underline" onClick={() => setConfirm(false)}>Keep</button>
              </span>
            ) : (
              <button className="text-pink/50 underline hover:text-pink" onClick={() => setConfirm(true)}>
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function RaceDay({ data, name }: { data: Manage; name: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const cues = data.moments.filter((m) => m.playUri);

  if (!data.raceDay) {
    return (
      <section className="panel p-6">
        <h2 className="font-display text-2xl font-bold">Race morning</h2>
        <p className="mt-1 text-blush">
          At 4am on November 1 this section unlocks your race-day playlist and a cue list. It tells you when each planted song
          is coming without spoiling which song it is.
        </p>
      </section>
    );
  }

  const build = async () => {
    if (!spotifyConnected()) return startSpotifyLogin();
    setBusy(true);
    setMsg(null);
    try {
      const url = await savePlaylist(
        `Don't peek: ${name}'s ${RACE.name}`,
        "Planted by friends and family with Playlist Pacer. Press play at the start, in order, no shuffle.",
        cues.map((c) => c.playUri!),
      );
      setLink(url);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel space-y-5 p-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Race day</h2>
        <p className="mt-1 text-blush">
          Download the playlist in Spotify before you leave so it plays without signal. When you reach each moment, tap Play.
          The song stays a surprise until you hear it.
        </p>
      </div>
      {spotifyConfigured() && (
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn bg-pink px-6 py-3 text-sm" onClick={build} disabled={busy || !cues.length}>
            <SpotifyIcon size={18} />
            {spotifyConnected() ? (busy ? "Saving…" : "Save my Don't peek playlist") : "Connect Spotify to save the playlist"}
          </button>
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold underline">
              <SpotifyIcon size={16} /> Open Spotify
            </a>
          )}
          {msg && <span className="text-sm text-coral">{msg}</span>}
        </div>
      )}
      <ol className="space-y-2" aria-label="Race-day cue list">
        {data.moments.map((m) => {
          const mo = momentById(m.id)!;
          const tid = trackId(m.playUri);
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-ink/20 px-4 py-3">
              <span className="w-24 font-mono text-[11px] text-pink/70">~{at(m.eta)}</span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{mo.label}</span>
                <span className="text-sm text-pink/70"> · mile {fmtMile(mo.d)} · {m.owner === "runner" ? "your pick" : m.from ? `from ${m.from}` : "open"}</span>
              </span>
              {tid ? (
                <a href={spotifyTrackUrl(tid)} target="_blank" rel="noreferrer" className="btn bg-pink px-4 py-2 text-xs" aria-label={`Play the song at ${mo.label}`}>
                  ▶ Play
                </a>
              ) : (
                m.from && <span className="text-xs text-pink/60">typed in, not on Spotify</span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
