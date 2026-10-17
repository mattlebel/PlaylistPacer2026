import { NextResponse, type NextRequest } from "next/server";
import {
  buildImportPayload,
  cookieOptions,
  ensureFresh,
  openSession,
  parseStravaUrl,
  resolveShortLink,
  sealSession,
  STRAVA_COOKIE,
  StravaError,
  stravaGet,
  type Streams,
} from "@/lib/server/strava";

/** Import an activity or route by URL/id → raw points the client turns into a Course. */
export async function GET(req: NextRequest) {
  const s0 = await openSession(req);
  if (!s0) return NextResponse.json({ error: "Connect Strava first." }, { status: 401 });
  const input = req.nextUrl.searchParams.get("url") ?? "";
  const ref = parseStravaUrl(await resolveShortLink(input));
  if (!ref) return NextResponse.json({ error: "That doesn't look like a Strava activity or route link." }, { status: 400 });

  try {
    const { session, refreshed } = await ensureFresh(s0);
    const payload =
      ref.kind === "activity"
        ? buildImportPayload(
            ref,
            ...(await Promise.all([
              stravaGet<{ name: string; device_name?: string }>(session, `/activities/${ref.id}`),
              stravaGet<Streams>(session, `/activities/${ref.id}/streams?keys=latlng,altitude,time,distance&key_by_type=true`),
            ])),
          )
        : buildImportPayload(
            ref,
            ...(await Promise.all([
              stravaGet<{ name: string }>(session, `/routes/${ref.id}`),
              stravaGet<Streams>(session, `/routes/${ref.id}/streams`),
            ])),
          );

    const res = NextResponse.json(payload);
    if (refreshed) res.cookies.set(STRAVA_COOKIE, await sealSession(session), cookieOptions);
    return res;
  } catch (e) {
    const status = e instanceof StravaError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
