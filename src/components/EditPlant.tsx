"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError, type OwnSong } from "@/lib/client/api";
import { editKeyFor } from "@/lib/client/keys";
import { mileByN, mileLabel } from "@/lib/race";
import { PreviewButton, SpotifyPlayer } from "./SpotifyPlayer";
import { usePreview } from "./usePreview";

/** Edit links from the first version of the app still work: see your song, or take it off the course. */
export function EditPlant() {
  const { id } = useParams<{ id: string }>();
  const [key, setKey] = useState<string | null | undefined>(undefined);
  const [own, setOwn] = useState<OwnSong | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const preview = usePreview();

  const load = useCallback(
    async (k: string) => {
      try {
        setOwn(await api<OwnSong>(`/api/plants/${id}`, { key: { header: "x-edit-key", value: k } }));
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : "Couldn't load your song.");
      }
    },
    [id],
  );

  useEffect(() => {
    const k = editKeyFor(id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKey(k);
    if (k) load(k);
  }, [id, load]);

  if (key === null) return <p className="pt-10 text-lg">This page needs the link you got when you added your song.</p>;
  if (err) return <p className="pt-10 text-lg">{err}</p>;
  if (!own || !key) return <p className="pt-10 text-pink/60">Loading…</p>;

  const mapLink = (
    <Link href={`/r/${own.raceId}`} className="btn bg-pink px-6 py-3 text-sm">
      See the live map
    </Link>
  );

  if (removed)
    return (
      <div className="max-w-xl space-y-4 pt-6">
        <h1 className="font-display text-4xl font-bold">Removed</h1>
        <p className="text-blush">Your song is off the course. You can add another one from the map.</p>
        {mapLink}
      </div>
    );

  return (
    <div className="max-w-xl space-y-6 pt-6">
      <div>
        <div className="label">Your song for {own.runnerName.split(" ")[0]}</div>
        <h1 className="mt-2 font-display text-4xl font-bold">
          {mileLabel(own.mile)} · {mileByN(own.mile)?.title}
        </h1>
      </div>
      <div className="flex items-center gap-3 rounded-xl bg-ink/25 p-2 pr-3">
        {own.song.art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={own.song.art} alt="" className="h-14 w-14 shrink-0 rounded-[4px] object-cover" />
        ) : (
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[4px] bg-ink-3">♪</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-chalk">{own.song.title}</div>
          <div className="truncate text-sm text-pink/70">{own.song.artist}</div>
        </div>
        {own.song.spotifyId && <PreviewButton song={own.song} preview={preview} />}
      </div>
      {own.song.spotifyId && preview.embedFor(own.song) && (
        <SpotifyPlayer id={own.song.spotifyId} title={`Preview ${own.song.title} on Spotify`} autoPlay={preview.embedFor(own.song)!.auto} />
      )}
      <div className="flex flex-wrap items-center gap-4">
        {mapLink}
        {own.removable &&
          (confirm ? (
            <span className="flex gap-3 text-sm">
              <button
                className="font-semibold text-coral underline"
                onClick={async () => {
                  await api(`/api/plants/${id}`, { method: "DELETE", key: { header: "x-edit-key", value: key } });
                  setRemoved(true);
                }}
              >
                Yes, remove my song
              </button>
              <button className="underline" onClick={() => setConfirm(false)}>
                Keep it
              </button>
            </span>
          ) : (
            <button className="text-sm underline underline-offset-4" onClick={() => setConfirm(true)}>
              Remove my song
            </button>
          ))}
      </div>
    </div>
  );
}
