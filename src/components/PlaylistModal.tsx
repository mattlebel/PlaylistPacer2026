"use client";

import { useEffect, useRef, useState } from "react";
import { parseTrackCsv } from "@/lib/csv";
import { DEMO_PLAYLIST_NAME, demoTracks } from "@/lib/demo";
import {
  lookupBpms,
  myPlaylists,
  playlistIdFromUrl,
  playlistTracks,
  spotifyConfigured,
  spotifyConnected,
  spotifyLogout,
  startSpotifyLogin,
  type PlaylistSummary,
} from "@/lib/spotify";
import { useKD } from "@/lib/store";
import type { Track } from "@/lib/types";
import { Modal, Tabs } from "./ui";

export type Tab = "spotify" | "csv" | "demo";

export function PlaylistModal({
  tab,
  setTab,
  notify,
}: {
  /** Which tab is showing; false = closed. */
  tab: Tab | false;
  setTab(t: Tab | false): void;
  notify(m: string): void;
}) {
  const open = tab !== false;
  const onClose = () => setTab(false);
  const setTracks = useKD((s) => s.setTracks);

  const accept = (tracks: Track[], name: string, source: "spotify" | "csv" | "demo") => {
    setTracks(tracks, name, source);
    const withBpm = tracks.filter((t) => t.bpm).length;
    notify(`${tracks.length} songs loaded${withBpm < tracks.length ? ` · ${tracks.length - withBpm} need a BPM (tap to set)` : ""}`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add your playlist" wide>
      <Tabs
        value={tab || "spotify"}
        onChange={setTab}
        tabs={[
          { value: "spotify", label: "Spotify" },
          { value: "csv", label: "CSV import" },
          { value: "demo", label: "Sample mix" },
        ]}
      />
      {tab === "spotify" && <SpotifyTab onTracks={(t, n) => accept(t, n, "spotify")} />}
      {tab === "csv" && <CsvTab onTracks={(t, n) => accept(t, n, "csv")} />}
      {tab === "demo" && (
        <div className="space-y-4">
          <p>
            65 running songs, from Empire State of Mind to &apos;Till I Collapse, shuffled so you can see what auto-ramp
            does.
          </p>
          <button className="btn bg-pink px-6 py-3 text-sm" onClick={() => accept(demoTracks(), DEMO_PLAYLIST_NAME, "demo")}>
            Load the sample mix
          </button>
        </div>
      )}
    </Modal>
  );
}

function SpotifyTab({ onTracks }: { onTracks(t: Track[], name: string): void }) {
  // Only rendered inside an opened modal, so it's always client-side here.
  const [connected, setConnected] = useState(() => spotifyConnected());
  const [lists, setLists] = useState<PlaylistSummary[] | null>(null);
  const [q, setQ] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) return;
    myPlaylists()
      .then(setLists)
      .catch((e) => {
        setErr(e.message);
        setConnected(spotifyConnected());
      });
  }, [connected]);

  const load = async (id: string) => {
    setBusy(id);
    setErr(null);
    try {
      const { name, tracks } = await playlistTracks(id);
      if (!tracks.length) throw new Error("That playlist is empty.");
      setBusy("bpm");
      const bpm = await lookupBpms(tracks.map((t) => t.spotifyId).filter((x): x is string => !!x));
      onTracks(
        tracks.map((t) => ({ ...t, bpm: t.spotifyId ? bpm[t.spotifyId] : undefined })),
        name,
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!spotifyConfigured()) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-base">Spotify isn&apos;t wired up on this deploy yet.</p>
        <p className="text-pink/70">
          Set <code className="rounded bg-ink-3 px-1.5 py-0.5 font-mono text-chalk">NEXT_PUBLIC_SPOTIFY_CLIENT_ID</code> (see the
          README). Until then, export your playlist with Exportify and use the CSV tab, or play with the sample mix.
        </p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="space-y-4">
        <p>Connect Spotify to pull in any playlist you own or collaborate on. We only read playlists, and save new ones when you ask.</p>
        <button className="btn bg-pink px-6 py-3 text-sm" onClick={() => startSpotifyLogin()}>
          Connect Spotify
        </button>
        {err && <p className="font-bold text-coral">{err}</p>}
      </div>
    );
  }

  const shown = (lists ?? []).filter((l) => l.name.toLowerCase().includes(q.toLowerCase()));
  const pastedId = playlistIdFromUrl(url);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="field" placeholder="search your playlists…" value={q} onChange={(e) => setQ(e.target.value)} />
        <input
          className="field font-mono text-sm"
          placeholder="…or paste a playlist link"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        {pastedId && (
          <button className="btn bg-pink px-5 py-2 text-xs" onClick={() => load(pastedId)} disabled={!!busy}>
            Load
          </button>
        )}
      </div>
      {busy && (
        <p className="animate-pulse font-bold text-chalk">
          {busy === "bpm" ? "Looking up tempos…" : "Loading tracks…"}
        </p>
      )}
      {err && <p className="font-bold text-coral">{err}</p>}
      {!lists && !err && <p className="animate-pulse text-pink/60">loading your playlists…</p>}
      <div className="grid max-h-[50dvh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-4">
        {shown.map((l) => (
          <button
            key={l.id}
            onClick={() => load(l.id)}
            disabled={!!busy}
            className="group rounded-2xl border-2 border-pink/10 bg-ink-3 p-2 text-left transition hover:border-coral"
          >
            <div className="aspect-square overflow-hidden rounded-xl bg-ink-3">
              {l.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.image} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
              ) : (
                <div className="grid h-full place-items-center text-3xl">🎵</div>
              )}
            </div>
            <div className="mt-2 truncate text-sm font-bold">{l.name}</div>
            <div className="font-mono text-[11px] text-pink/50">{l.count} songs</div>
          </button>
        ))}
      </div>
      <button
        className="text-xs text-pink/50 underline hover:text-pink"
        onClick={() => {
          spotifyLogout();
          setConnected(false);
          setLists(null);
        }}
      >
        disconnect Spotify
      </button>
    </div>
  );
}

function CsvTab({ onTracks }: { onTracks(t: Track[], name: string): void }) {
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const handle = async (file?: File) => {
    if (!file) return;
    try {
      const tracks = parseTrackCsv(await file.text());
      if (!tracks.length) throw new Error("No songs in that CSV.");
      onTracks(tracks, file.name.replace(/\.csv$/i, ""));
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <div className="space-y-4">
      <p>
        Works with{" "}
        <a className="text-chalk underline" href="https://exportify.app" target="_blank" rel="noreferrer">
          Exportify
        </a>{" "}
        exports (any playlist, even ones you don&apos;t own), or any CSV with title, artist, duration and optional tempo/BPM
        columns.
      </p>
      <button className="btn bg-pink px-6 py-3 text-sm" onClick={() => input.current?.click()}>
        Choose CSV
      </button>
      <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => handle(e.target.files?.[0])} />
      {err && <p className="font-bold text-coral">{err}</p>}
    </div>
  );
}
