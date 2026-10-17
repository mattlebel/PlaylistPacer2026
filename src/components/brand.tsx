"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * Third-party brand marks, used the way each brand's developer guidelines ask.
 *
 * Spotify: any Spotify metadata or artwork must be accompanied by the Spotify brand,
 * and metadata should link back to Spotify. The icon below is Spotify's official mark
 * (path from Simple Icons, CC0), shown in white or black only, never recolored.
 *
 * Strava: the "Connect with Strava" button and "Powered by Strava" logo must be the
 * official, unmodified assets. Strava's site can't be fetched at build time, so drop the
 * files from https://developers.strava.com/guidelines/ into public/brand/strava/ under
 * the names below. Until then a plain-text fallback renders (see README → Branding).
 */

export const STRAVA_CONNECT_SRC = "/brand/strava/connect-with-strava.svg";
export const STRAVA_POWERED_SRC = "/brand/strava/powered-by-strava-white.svg";

const SPOTIFY_PATH = "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z";

export function SpotifyIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`shrink-0 ${className}`} role="img" aria-label="Spotify">
      <path d={SPOTIFY_PATH} fill="currentColor" />
    </svg>
  );
}

/** Small "Spotify" lockup for places that show Spotify metadata. */
export function SpotifyAttribution({ href, className = "" }: { href?: string | null; className?: string }) {
  const body = (
    <>
      <SpotifyIcon size={16} />
      <span>{href ? "Open Spotify" : "Spotify"}</span>
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 font-semibold hover:underline ${className}`}>
      {body}
    </a>
  ) : (
    <span className={`inline-flex items-center gap-1.5 font-semibold ${className}`}>{body}</span>
  );
}

/**
 * An official brand image that falls back to `fallback` when the file isn't installed.
 * Checks after mount too, since the image can fail before React hydrates.
 */
export function BrandImage({
  src,
  alt,
  height,
  fallback,
}: {
  src: string;
  alt: string;
  height: number;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={img} src={src} alt={alt} style={{ height, width: "auto" }} onError={() => setFailed(true)} />;
}

/** Strava's OAuth entry point. Must be the official button, linking to Strava's authorize flow. */
export function ConnectWithStrava() {
  return (
    <a href="/api/strava/login" className="inline-block" aria-label="Connect with Strava">
      <BrandImage
        src={STRAVA_CONNECT_SRC}
        alt="Connect with Strava"
        height={48}
        fallback={<span className="btn bg-pink px-6 py-3 text-sm">Connect with Strava</span>}
      />
    </a>
  );
}

/** Required wherever Strava data is shown. Kept smaller than, and apart from, our own logo. */
export function PoweredByStrava({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <BrandImage
        src={STRAVA_POWERED_SRC}
        alt="Powered by Strava"
        height={18}
        fallback={<span className="font-mono text-[10px] uppercase tracking-wider">Powered by Strava</span>}
      />
    </span>
  );
}

/** Strava's guidelines require this exact link text when linking back to Strava data. */
export function ViewOnStrava({ href, className = "" }: { href: string; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`font-bold underline underline-offset-2 ${className}`}>
      View on Strava
    </a>
  );
}

/** Device partners (e.g. Garmin) require attribution when their data is shown. */
export function DeviceAttribution({ device, className = "" }: { device?: string; className?: string }) {
  if (!device) return null;
  return <span className={className}>Recorded on {device}</span>;
}
