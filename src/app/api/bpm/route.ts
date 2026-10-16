import { NextResponse, type NextRequest } from "next/server";

/**
 * Spotify killed audio-features (tempo) for new apps in Nov 2024. ReccoBeats serves
 * Spotify-compatible features by Spotify track id, no key needed. Best effort only.
 */
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .filter((x) => /^[A-Za-z0-9]{22}$/.test(x))
    .slice(0, 40);
  if (!ids.length) return NextResponse.json({ bpm: {} });
  try {
    const res = await fetch(`https://api.reccobeats.com/v1/audio-features?ids=${ids.join(",")}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return NextResponse.json({ bpm: {}, error: `upstream ${res.status}` });
    const json = (await res.json()) as { content?: { href?: string; id?: string; tempo?: number }[] };
    const bpm: Record<string, number> = {};
    for (const row of json.content ?? []) {
      const sid = row.href?.match(/track\/([A-Za-z0-9]{22})/)?.[1];
      if (sid && row.tempo) bpm[sid] = Math.round(row.tempo);
    }
    return NextResponse.json({ bpm });
  } catch {
    return NextResponse.json({ bpm: {}, error: "unreachable" });
  }
}
