import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions, ensureFresh, openSession, sealSession, STRAVA_COOKIE, StravaError, stravaGet } from "@/lib/server/strava";

interface SummaryActivity {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  workout_type?: number | null;
}

/** Your recent runs, races (workout_type 1) first. */
export async function GET(req: NextRequest) {
  const s0 = await openSession(req);
  if (!s0) return NextResponse.json({ error: "Connect Strava first." }, { status: 401 });
  try {
    const { session, refreshed } = await ensureFresh(s0);
    const list = await stravaGet<SummaryActivity[]>(session, "/athlete/activities?per_page=60");
    const runs = list
      .filter((a) => /run/i.test(a.sport_type ?? a.type ?? ""))
      .map((a) => ({
        id: String(a.id),
        name: a.name,
        date: a.start_date_local,
        distance: a.distance,
        elapsed: a.elapsed_time,
        moving: a.moving_time,
        race: a.workout_type === 1,
      }));
    const res = NextResponse.json({ runs });
    if (refreshed) res.cookies.set(STRAVA_COOKIE, await sealSession(session), cookieOptions);
    return res;
  } catch (e) {
    const status = e instanceof StravaError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
