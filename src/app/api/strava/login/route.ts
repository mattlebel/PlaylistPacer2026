import { NextResponse, type NextRequest } from "next/server";
import { appOrigin, stravaConfigured } from "@/lib/server/strava";

export async function GET(req: NextRequest) {
  if (!stravaConfigured()) return NextResponse.redirect(`${appOrigin(req)}/?strava=not-configured`);
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: `${appOrigin(req)}/api/strava/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
  });
  return NextResponse.redirect(`https://www.strava.com/oauth/authorize?${params}`);
}
