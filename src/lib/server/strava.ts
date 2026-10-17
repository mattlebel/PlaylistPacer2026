import "server-only";
import type { NextRequest } from "next/server";

/**
 * Strava OAuth + API helpers. Tokens live in an AES-GCM encrypted, httpOnly cookie —
 * no database needed. Strava's 2026 program: Standard-tier apps need a Strava
 * subscription, start at 1 athlete and can self-raise to 10 before review.
 */
export const STRAVA_COOKIE = "kd_strava";
const API = process.env.STRAVA_API_BASE ?? "https://www.strava.com/api/v3";

export const stravaConfigured = () => !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);

/** Public origin for OAuth redirects. Behind a proxy (Render), the request origin is the internal port. */
export function appOrigin(req: NextRequest) {
  const configured = process.env.APP_URL ?? process.env.RENDER_EXTERNAL_URL;
  return configured?.replace(/\/$/, "") ?? req.nextUrl.origin;
}

export interface StravaSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: { id: number; firstname?: string; profile?: string };
}

async function key() {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`playlistpacer:${process.env.STRAVA_CLIENT_SECRET}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64url");

export async function sealSession(s: StravaSession) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(JSON.stringify(s))));
  return `${b64(iv)}.${b64(ct)}`;
}

export async function openSession(req: NextRequest): Promise<StravaSession | null> {
  const raw = req.cookies.get(STRAVA_COOKIE)?.value;
  if (!raw || !stravaConfigured()) return null;
  try {
    const [iv, ct] = raw.split(".").map((x) => new Uint8Array(Buffer.from(x, "base64url")));
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await key(), ct);
    return JSON.parse(new TextDecoder().decode(pt));
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 60,
};

export async function exchangeToken(body: Record<string, string>) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`Strava token exchange failed (${res.status})`);
  return res.json();
}

/** Returns a fresh session (refreshing if needed) and whether it changed. */
export async function ensureFresh(s: StravaSession): Promise<{ session: StravaSession; refreshed: boolean }> {
  if (Date.now() / 1000 < s.expires_at - 120) return { session: s, refreshed: false };
  const j = await exchangeToken({ grant_type: "refresh_token", refresh_token: s.refresh_token });
  return {
    session: { ...s, access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at },
    refreshed: true,
  };
}

export async function stravaGet<T>(s: StravaSession, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${s.access_token}` }, cache: "no-store" });
  if (res.status === 429) throw new StravaError("Strava rate limit hit. Give it 15 minutes 🧊", 429);
  if (res.status === 404) throw new StravaError("Strava couldn't find that. Is it private, or someone else's?", 404);
  if (res.status === 401 || res.status === 403)
    throw new StravaError("Strava won't share that one. You can only import your own activities (or routes you can see).", res.status);
  if (!res.ok) throw new StravaError(`Strava error ${res.status}`, res.status);
  return res.json();
}

export class StravaError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** activities/123, routes/456, or a bare id. */
export function parseStravaUrl(text: string): { kind: "activity" | "route"; id: string } | null {
  const m = text.match(/(activities|routes)\/(\d+)/);
  if (m) return { kind: m[1] === "routes" ? "route" : "activity", id: m[2] };
  if (/^\d{6,}$/.test(text.trim())) return { kind: "activity", id: text.trim() };
  return null;
}

/** strava.app.link short links redirect to the real URL. */
export async function resolveShortLink(text: string) {
  if (!/strava\.app\.link|strava\.com\/s\//.test(text)) return text;
  try {
    const res = await fetch(text.trim(), { redirect: "manual" });
    return res.headers.get("location") ?? text;
  } catch {
    return text;
  }
}
