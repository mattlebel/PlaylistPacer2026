"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type OwnPlant } from "@/lib/client/api";
import { editKeyFor } from "@/lib/client/keys";
import { fmtMile, fmtTimeOfDay, momentById } from "@/lib/race";
import type { Song } from "@/lib/types";
import { SongPicker } from "./SongPicker";
import { Toast } from "./ui";

export function EditPlant() {
  const { id } = useParams<{ id: string }>();
  const [key, setKey] = useState<string | null | undefined>(undefined);
  const [plant, setPlant] = useState<OwnPlant | null>(null);
  const [song, setSong] = useState<Song>();
  const [message, setMessage] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(async (k: string) => {
    try {
      const p = await api<OwnPlant>(`/api/plants/${id}`, { key: { header: "x-edit-key", value: k } });
      setPlant(p);
      setSong(p.song);
      setMessage(p.message ?? "");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't load your song.");
    }
  }, [id]);

  useEffect(() => {
    const k = editKeyFor(id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKey(k);
    if (k) load(k);
  }, [id, load]);

  if (key === null) return <p className="pt-10 text-lg">Open the edit link from your email to change your song.</p>;
  if (deleted)
    return (
      <div className="max-w-xl pt-10">
        <h1 className="font-display text-3xl font-bold">Removed</h1>
        <p className="mt-2 text-blush">Your moment is open again.</p>
        {plant && <Link href={`/r/${plant.raceId}`} className="btn mt-4 bg-pink px-5 py-3 text-sm">Back to the course</Link>}
      </div>
    );
  if (err && !plant) return <p className="pt-10 text-lg">{err}</p>;
  if (!plant || !key) return <p className="pt-10 text-pink/60">Loading…</p>;

  const mo = momentById(plant.moment)!;
  const save = async () => {
    setErr(null);
    try {
      await api(`/api/plants/${id}`, { method: "PATCH", key: { header: "x-edit-key", value: key }, body: JSON.stringify({ message, song }) });
      setToast("Saved.");
      load(key);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't save.");
    }
  };

  return (
    <div className="max-w-2xl space-y-6 pt-4">
      <div>
        <div className="label">Your song for {plant.runnerName}</div>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">{mo.label}</h1>
        <p className="mt-2 text-blush">
          Mile {fmtMile(mo.d)}, around {fmtTimeOfDay(new Date(plant.eta))} on race day.
        </p>
      </div>
      {plant.editable ? (
        <div className="panel space-y-5 p-6">
          <SongPicker label="Your song" value={song} onChange={setSong} />
          <div>
            <label htmlFor="edit-message" className="label mb-2 block">Your note</label>
            <textarea id="edit-message" className="field min-h-24" maxLength={150} value={message} onChange={(e) => setMessage(e.target.value)} />
            <div className="mt-1 text-right font-mono text-[10px] text-pink/60">{message.length}/150</div>
          </div>
          {err && <p role="alert" className="font-semibold text-coral">{err}</p>}
          <div className="flex flex-wrap items-center gap-4">
            <button className="btn bg-pink px-6 py-3 text-sm" onClick={save} disabled={!song}>
              Save changes
            </button>
            {confirm ? (
              <span className="flex gap-3 text-sm">
                <button
                  className="font-semibold text-coral underline"
                  onClick={async () => {
                    await api(`/api/plants/${id}`, { method: "DELETE", key: { header: "x-edit-key", value: key } });
                    setDeleted(true);
                  }}
                >
                  Yes, remove my song
                </button>
                <button className="underline" onClick={() => setConfirm(false)}>Keep it</button>
              </span>
            ) : (
              <button className="text-sm underline text-pink/70" onClick={() => setConfirm(true)}>Remove my song</button>
            )}
          </div>
        </div>
      ) : (
        <div className="panel p-6">
          <p className="font-semibold">{plant.song.title} · {plant.song.artist}</p>
          {plant.message && <p className="mt-2 text-blush">“{plant.message}”</p>}
          <p className="mt-4 text-sm text-pink/70">Planting is closed, so this is locked in. Thanks for cheering!</p>
        </div>
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
