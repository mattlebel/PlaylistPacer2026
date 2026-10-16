import { NextResponse, type NextRequest } from "next/server";
import {
  cookieOptions,
  ensureFresh,
  openSession,
  parseStravaUrl,
  resolveShortLink,
  sealSession,
  STRAVA_COOKIE,
  StravaError,
  stravaGet,
} from "@/lib/server/strava";

type Stream = { type: string; data: unknown[] };
type Streams = Record<string, { data: unknown[] }> | Stream[];

function byType(s: Streams): Record<string, unknown[]> {
  if (Array.isArray(s)) return Object.fromEntries(s.map((x) => [x.type, x.data]));
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.data]));
}

/** Import an activity or route by URL/id → raw points the client turns into a Course. */
export async function GET(req: NextRequest) {
  const s0 = await openSession(req);
  if (!s0) return NextResponse.json({ error: "Connect Strava first." }, { status: 401 });
  const input = req.nextUrl.searchParams.get("url") ?? "";
  const ref = parseStravaUrl(await resolveShortLink(input));
  if (!ref) return NextResponse.json({ error: "That doesn't look like a Strava activity or route link." }, { status: 400 });

  try {
    const { session, refreshed } = await ensureFresh(s0);
    let name: string;
    let streams: Record<string, unknown[]>;
    if (ref.kind === "activity") {
      const [meta, raw] = await Promise.all([
        stravaGet<{ name: string; elapsed_time: number }>(session, `/activities/${ref.id}`),
        stravaGet<Streams>(session, `/activities/${ref.id}/streams?keys=latlng,altitude,time,distance&key_by_type=true`),
      ]);
      name = meta.name;
      streams = byType(raw);
    } else {
      const [meta, raw] = await Promise.all([
        stravaGet<{ name: string }>(session, `/routes/${ref.id}`),
        stravaGet<Streams>(session, `/routes/${ref.id}/streams`),
      ]);
      name = meta.name;
      streams = byType(raw);
    }
    const latlng = (streams.latlng ?? []) as [number, number][];
    if (latlng.length < 2) throw new StravaError("No GPS on that one (treadmill? 👀).", 422);
    const alt = streams.altitude as number[] | undefined;
    const time = streams.time as number[] | undefined;
    const points = latlng.map(([lat, lon], i) => ({ lat, lon, ele: alt?.[i], t: time?.[i] }));

    const res = NextResponse.json({ kind: ref.kind, name, points });
    if (refreshed) res.cookies.set(STRAVA_COOKIE, await sealSession(session), cookieOptions);
    return res;
  } catch (e) {
    const status = e instanceof StravaError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
