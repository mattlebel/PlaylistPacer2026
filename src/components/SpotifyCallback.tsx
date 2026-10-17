"use client";

import { useEffect, useState } from "react";
import { finishSpotifyLogin } from "@/lib/spotify";

export function SpotifyCallback() {
  const [msg, setMsg] = useState("connecting to Spotify…");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
      window.location.replace("/");
      return;
    }
    finishSpotifyLogin(code)
      .then(() => window.location.replace("/?spotify=connected"))
      .catch((e) => setMsg(e.message));
  }, []);
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <p className="animate-pulse font-display text-2xl font-extrabold">{msg}</p>
    </main>
  );
}
