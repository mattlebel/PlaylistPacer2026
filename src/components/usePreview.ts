"use client";

import { useEffect, useId, useRef, useState } from "react";
import { findPreview } from "@/lib/client/api";
import type { Song } from "@/lib/types";

// One shared player for preview clips. A header-only WAV "unlocks" it inside the tap itself, which
// iPhones require before they'll play sound; the real clip loads a moment later.
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
let player: HTMLAudioElement | null = null;
const audioPlayer = () => (player ??= new Audio());
const CLAIM = "pp:preview";

const keyOf = (s: Song) => s.spotifyId ?? `${s.title}|${s.artist}`;

/**
 * Song previews behind our own ▶: one tap plays the 30-second clip straight away. When there's no
 * clip, Spotify's player opens instead and starts by itself. Only one preview plays at a time
 * across the page.
 */
export function usePreview() {
  const owner = useId();
  // The clip playing (or loading) right now.
  const [clip, setClip] = useState<{ key: string; loading: boolean } | null>(null);
  // The song showing Spotify's player, and whether it should start by itself.
  const [embed, setEmbed] = useState<{ key: string; auto: boolean } | null>(null);
  const current = useRef<string | null>(null);

  const stopClip = () => {
    current.current = null;
    setClip(null);
    player?.pause();
  };

  // Another preview started somewhere else on the page: stop this one.
  useEffect(() => {
    const onClaim = (e: Event) => {
      if ((e as CustomEvent<string>).detail === owner) return;
      current.current = null;
      setClip(null);
      setEmbed(null);
    };
    window.addEventListener(CLAIM, onClaim);
    return () => {
      window.removeEventListener(CLAIM, onClaim);
      if (current.current) player?.pause();
      current.current = null;
    };
  }, [owner]);

  const claim = () => window.dispatchEvent(new CustomEvent(CLAIM, { detail: owner }));

  const showEmbed = (s: Song, auto = false) => {
    if (!s.spotifyId) return;
    if (auto) claim();
    stopClip();
    setEmbed({ key: keyOf(s), auto });
  };

  const play = async (s: Song) => {
    const key = keyOf(s);
    claim();
    setEmbed(null);
    const a = audioPlayer();
    // Inside the tap: start (silently) now, so the phone lets the real clip play once it arrives.
    a.pause();
    a.src = SILENT;
    a.play().catch(() => {});
    current.current = key;
    setClip({ key, loading: true });
    const url = await findPreview(s)
      .then((r) => r.url)
      .catch(() => null);
    if (current.current !== key) return;
    if (url) {
      a.src = url;
      a.onended = () => current.current === key && stopClip();
      try {
        await a.play();
        if (current.current === key) setClip({ key, loading: false });
        return;
      } catch {
        if (current.current !== key) return;
      }
    }
    // No clip to play here: Spotify's own player, started for you.
    stopClip();
    if (s.spotifyId) setEmbed({ key, auto: true });
  };

  return {
    /** ▶: play, or stop/close if this song is already previewing. */
    toggle(s: Song) {
      const key = keyOf(s);
      if (clip?.key === key) return stopClip();
      if (embed?.key === key) return setEmbed(null);
      void play(s);
    },
    showEmbed,
    hideEmbed: () => setEmbed(null),
    stop() {
      stopClip();
      setEmbed(null);
    },
    loading: (s: Song) => clip?.key === keyOf(s) && clip.loading,
    playing: (s: Song) => clip?.key === keyOf(s),
    embedFor: (s: Song) => (embed?.key === keyOf(s) ? embed : null),
    busy: !!clip,
  };
}
