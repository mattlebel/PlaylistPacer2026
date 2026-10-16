import { NextResponse } from "next/server";
import { STRAVA_COOKIE } from "@/lib/server/strava";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(STRAVA_COOKIE);
  return res;
}
