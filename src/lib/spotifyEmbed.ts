"use client";

/** Minimal wrapper over the Spotify iFrame Embed API (no auth needed; full tracks if the viewer is logged in). */
export interface EmbedController {
  loadUri(uri: string, preferVideo?: boolean, startAt?: number): void;
  play(): void;
  pause(): void;
  resume(): void;
  seek(sec: number): void;
  destroy(): void;
  addListener(ev: string, cb: (e: unknown) => void): void;
}

interface IFrameAPI {
  createController(el: HTMLElement, opts: Record<string, unknown>, cb: (c: EmbedController) => void): void;
}

let apiPromise: Promise<IFrameAPI> | null = null;

export function loadEmbedApi(): Promise<IFrameAPI> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const w = window as unknown as { onSpotifyIframeApiReady?: (api: IFrameAPI) => void };
    w.onSpotifyIframeApiReady = resolve;
    const s = document.createElement("script");
    s.src = "https://open.spotify.com/embed/iframe-api/v1";
    s.async = true;
    s.onerror = () => {
      apiPromise = null;
      reject(new Error("Spotify embed unavailable"));
    };
    document.body.appendChild(s);
    setTimeout(() => reject(new Error("Spotify embed timed out")), 8000);
  });
  return apiPromise;
}
