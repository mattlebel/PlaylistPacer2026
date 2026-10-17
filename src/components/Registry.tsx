"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, type Registry as RegistryData } from "@/lib/client/api";
import { rememberEditKey } from "@/lib/client/keys";
import { confetti } from "@/lib/confetti";
import { fmtMile, fmtTimeOfDay, momentById, RACE } from "@/lib/race";
import { spotifyTrackUrl } from "@/lib/spotify";
import type { Song } from "@/lib/types";
import { RaceMap, type PinState } from "./RaceMap";
import { SongPicker } from "./SongPicker";
import { Modal } from "./ui";

const first = (n: string) => n.trim().split(/\s+/)[0];
const at = (iso: string) => fmtTimeOfDay(new Date(iso));

export function Registry() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<RegistryData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [planting, setPlanting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<RegistryData>(`/api/races/${id}`));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't load this race.");
    }
  }, [id]);

  useEffect(() => {
    // Initial fetch; the state updates happen after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const states = useMemo(
    () => Object.fromEntries((data?.moments ?? []).map((m) => [m.id, m.status as PinState])),
    [data],
  );

  if (err) return <p className="pt-10 text-lg">{err}</p>;
  if (!data) return <p className="pt-10 text-pink/60">Loading…</p>;

  const name = first(data.runnerName);
  const friend = data.moments.filter((m) => m.owner === "friend");
  const planted = friend.filter((m) => m.status === "claimed").length;

  const pick = (mid: string) => {
    setSelected(mid);
    document.getElementById(`moment-${mid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    const m = data.moments.find((x) => x.id === mid);
    if (m?.status === "open" && data.plantingOpen) setPlanting(mid);
  };

  return (
    <div className="space-y-8 pt-4">
      <section className="max-w-3xl">
        <div className="label">{RACE.name} · {RACE.dateLabel}</div>
        <h1 className="mt-2 font-display text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[0.95] tracking-tight [text-wrap:balance]">
          Help {name} run 26.2
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-blush">
          {data.plantingOpen ? (
            <>
              Claim a moment on the course and plant a song with a short note. {name} will hear it right there on race day,
              and read your note after the finish. It stays a surprise until then.
            </>
          ) : (
            <>Planting is closed. {name} is about to start! Thanks to everyone who planted a song.</>
          )}
        </p>
        <div className="mt-5 flex items-center gap-4">
          <div className="h-2 w-48 overflow-hidden rounded-full bg-ink/30" aria-hidden>
            <div className="h-full rounded-full bg-pink transition-all" style={{ width: `${(planted / friend.length) * 100}%` }} />
          </div>
          <span className="font-mono text-xs">
            {planted} of {friend.length} moments planted
          </span>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="panel overflow-hidden lg:sticky lg:top-4 lg:self-start">
          <RaceMap states={states} selected={selected} onSelect={pick} className="h-[340px] lg:h-[600px]" />
          <div className="flex flex-wrap gap-4 px-4 py-3 font-mono text-[10px] uppercase text-pink/80">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full ring-2 ring-pink" /> open</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-pink" /> planted</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-chalk" /> {name}&apos;s picks</span>
          </div>
        </div>

        <ol className="space-y-2" aria-label="Moments along the course">
          {data.moments.map((m, i) => {
            const mo = momentById(m.id)!;
            const isSel = selected === m.id;
            return (
              <li
                key={m.id}
                id={`moment-${m.id}`}
                className={`rounded-2xl p-4 transition ${isSel ? "bg-ink/40 ring-1 ring-pink" : m.status === "open" ? "bg-ink/20" : "bg-ink/10"}`}
                onMouseEnter={() => setSelected(m.id)}
              >
                <div className="flex items-start gap-4">
                  <span
                    className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[11px] ${
                      m.status === "open" ? "ring-2 ring-pink" : m.status === "claimed" ? "bg-pink text-ink" : "bg-chalk text-ink"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <h2 className="font-display text-lg font-bold">{mo.label}</h2>
                      <span className="font-mono text-[11px] text-pink/70">
                        mi {fmtMile(mo.d)} · ~{at(m.eta)}
                      </span>
                    </div>
                    <p className="text-sm text-blush/90">{mo.note}</p>
                    <div className="mt-3">
                      {m.status === "open" &&
                        (data.plantingOpen ? (
                          <button className="btn bg-pink px-4 py-2 text-sm" onClick={() => setPlanting(m.id)}>
                            Plant a song here
                          </button>
                        ) : (
                          <span className="label">Unclaimed</span>
                        ))}
                      {m.status === "claimed" && <span className="font-semibold text-chalk">Planted by {m.claimedBy}</span>}
                      {m.status === "runner" && m.song && <RunnerPick name={name} song={m.song} />}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {planting && (
        <PlantDialog
          raceId={id}
          runner={name}
          momentId={planting}
          eta={data.moments.find((m) => m.id === planting)!.eta}
          onClose={() => setPlanting(null)}
          onDone={load}
        />
      )}
    </div>
  );
}

function RunnerPick({ name, song }: { name: string; song: Song }) {
  return (
    <div className="flex items-center gap-3">
      {song.art && song.spotifyId ? (
        <a href={spotifyTrackUrl(song.spotifyId)} target="_blank" rel="noreferrer" aria-label={`Play ${song.title} on Spotify`} className="h-10 w-10 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={song.art} alt="" className="h-full w-full rounded-[4px] object-cover" />
        </a>
      ) : null}
      <div className="min-w-0 text-sm">
        <div className="label">{name}&apos;s pick</div>
        <div className="truncate font-semibold" title={`${song.title} by ${song.artist}`}>
          {song.title} <span className="font-normal text-pink/70">· {song.artist}</span>
        </div>
      </div>
    </div>
  );
}

function PlantDialog({
  raceId,
  runner,
  momentId,
  eta,
  onClose,
  onDone,
}: {
  raceId: string;
  runner: string;
  momentId: string;
  eta: string;
  onClose(): void;
  onDone(): void;
}) {
  const mo = momentById(momentId)!;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [song, setSong] = useState<Song>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ editUrl: string; emailed: boolean } | null>(null);
  const ready = name.trim() && email.trim() && song;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api<{ id: string; editKey: string; editUrl: string; emailed: boolean }>(`/api/races/${raceId}/plants`, {
        method: "POST",
        body: JSON.stringify({ moment: momentId, name, email, message, song }),
      });
      rememberEditKey(res.id, res.editKey);
      setDone({ editUrl: res.editUrl, emailed: res.emailed });
      confetti();
      onDone();
    } catch (e) {
      const ae = e instanceof ApiError ? e : null;
      setErr(ae?.message ?? "Couldn't plant your song. Try again.");
      if (ae?.code === "song_taken") setSong(undefined);
      if (ae?.code === "moment_taken") onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={done ? "Planted!" : `Plant a song at ${mo.label}`}>
      {done ? (
        <div className="space-y-4">
          <p className="text-lg">
            Your song plays at <strong>{mo.label}</strong> (mile {fmtMile(mo.d)}), around {at(eta)} on race day. {runner} will hear
            it on the course and read your note after the finish.
          </p>
          <div className="rounded-xl bg-ink-3 p-4 text-sm">
            <div className="label mb-1">Your edit link</div>
            <p className="mb-2 text-blush">
              {done.emailed ? "We emailed it to you too. " : ""}Use it to change your song or note until two hours before the start.
            </p>
            <code className="block break-all font-mono text-xs text-chalk">{done.editUrl}</code>
          </div>
          <button className="btn bg-pink px-6 py-3 text-sm" onClick={onClose}>
            Back to the course
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <p className="text-blush">
            Mile {fmtMile(mo.d)}, around {at(eta)}. {mo.note}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="plant-name" className="label mb-2 block">Your name</label>
              <input id="plant-name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={40} required />
            </div>
            <div>
              <label htmlFor="plant-email" className="label mb-2 block">Your email</label>
              <input id="plant-email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </div>
          </div>
          <p className="-mt-2 text-xs text-pink/60">{runner} sees your name. Your email is only used to send you an edit link.</p>
          <SongPicker label="Your song" value={song} onChange={setSong} />
          <div>
            <label htmlFor="plant-message" className="label mb-2 block">A note for {runner} (optional)</label>
            <textarea
              id="plant-message"
              className="field min-h-24 resize-y"
              maxLength={150}
              value={message}
              placeholder={`The Bronx is yours, ${runner}!`}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="mt-1 text-right font-mono text-[10px] text-pink/60">{message.length}/150</div>
          </div>
          {err && <p role="alert" className="font-semibold text-coral">{err}</p>}
          <button type="submit" className="btn bg-pink px-7 py-3.5 text-base" disabled={!ready || busy}>
            {busy ? "Planting…" : "Plant my song"}
          </button>
        </form>
      )}
    </Modal>
  );
}

