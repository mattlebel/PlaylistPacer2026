"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Spotify's preview player for one track. Through Spotify's iFrame API it can start playing as soon
 * as it's ready, so our own ▶ is the only tap needed (browsers that block this still show the
 * player's own play button). If the API script can't load, it's the plain embed.
 */

interface Controller {
  addListener(event: "ready", cb: () => void): void;
  play(): void;
  destroy(): void;
}
interface IFrameApi {
  createController(el: HTMLElement, options: { uri: string; width?: string | number; height?: number }, cb: (c: Controller) => void): void;
}
declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameApi) => void;
  }
}

export const IFRAME_API_SRC = "https://open.spotify.com/embed/iframe-api/v1";
let api: Promise<IFrameApi> | null = null;

function loadApi(): Promise<IFrameApi> {
  return (api ??= new Promise<IFrameApi>((resolve, reject) => {
    const fail = () => {
      api = null; // try again next time
      reject(new Error("Spotify iFrame API unavailable"));
    };
    const timer = setTimeout(fail, 5000);
    window.onSpotifyIframeApiReady = (a) => {
      clearTimeout(timer);
      resolve(a);
    };
    const s = document.createElement("script");
    s.src = IFRAME_API_SRC;
    s.async = true;
    s.onerror = () => {
      clearTimeout(timer);
      s.remove();
      fail();
    };
    document.body.appendChild(s);
  }));
}

export function SpotifyPlayer({ id, title, autoPlay = false, className = "" }: { id: string; title: string; autoPlay?: boolean; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [plain, setPlain] = useState(false);

  useEffect(() => {
    let controller: Controller | null = null;
    let live = true;
    const el = box.current;
    loadApi()
      .then((a) => {
        if (!live || !el) return;
        // The API swaps this element for its iframe, so React never manages it.
        const spot = document.createElement("div");
        el.replaceChildren(spot);
        a.createController(spot, { uri: `spotify:track:${id}`, width: "100%", height: 80 }, (c) => {
          if (!live) return c.destroy();
          controller = c;
          el.querySelector("iframe")?.setAttribute("title", title);
          if (autoPlay) c.addListener("ready", () => c.play());
        });
      })
      .catch(() => live && setPlain(true));
    return () => {
      live = false;
      controller?.destroy();
      el?.replaceChildren();
    };
  }, [id, title, autoPlay]);

  if (plain)
    return (
      <iframe
        title={title}
        src={`https://open.spotify.com/embed/track/${id}?utm_source=generator&theme=0`}
        className={`h-20 w-full rounded-xl border-0 ${className}`}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    );
  return <div ref={box} className={`h-20 w-full overflow-hidden rounded-xl bg-ink/30 ${className}`} data-spotify-player={id} />;
}
