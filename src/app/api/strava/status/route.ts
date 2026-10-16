import { NextResponse, type NextRequest } from "next/server";
import { openSession, stravaConfigured } from "@/lib/server/strava";

export async function GET(req: NextRequest) {
  const s = await openSession(req);
  return NextResponse.json({
    configured: stravaConfigured(),
    connected: !!s,
    athlete: s ? { firstname: s.athlete.firstname, profile: s.athlete.profile } : null,
  });
}
