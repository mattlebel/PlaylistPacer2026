import { NextResponse, type NextRequest } from "next/server";
import { appOrigin, cookieOptions, exchangeToken, sealSession, STRAVA_COOKIE } from "@/lib/server/strava";

export async function GET(req: NextRequest) {
  const origin = appOrigin(req);
  const code = req.nextUrl.searchParams.get("code");
  const scope = req.nextUrl.searchParams.get("scope") ?? "";
  if (!code || req.nextUrl.searchParams.get("error")) return NextResponse.redirect(`${origin}/?strava=denied`);
  if (!scope.includes("activity:read")) return NextResponse.redirect(`${origin}/?strava=scope`);
  try {
    const j = await exchangeToken({ code, grant_type: "authorization_code" });
    const res = NextResponse.redirect(`${origin}/?strava=connected`);
    res.cookies.set(
      STRAVA_COOKIE,
      await sealSession({
        access_token: j.access_token,
        refresh_token: j.refresh_token,
        expires_at: j.expires_at,
        athlete: { id: j.athlete?.id, firstname: j.athlete?.firstname, profile: j.athlete?.profile_medium },
      }),
      cookieOptions,
    );
    return res;
  } catch {
    return NextResponse.redirect(`${origin}/?strava=error`);
  }
}
