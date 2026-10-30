import type { NextRequest } from "next/server";
import { handle, rateLimit } from "@/lib/server/http";
import { findPreview } from "@/lib/server/songPreview";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const p = req.nextUrl.searchParams;
    const spotifyId = p.get("id")?.match(/^[A-Za-z0-9]{22}$/)?.[0];
    const title = (p.get("title") ?? "").slice(0, 200);
    const artist = (p.get("artist") ?? "").slice(0, 200);
    if (!spotifyId && !title) return { url: null };
    rateLimit(req, "preview", 120, 60_000);
    return { url: await findPreview({ spotifyId, title, artist }) };
  });
}
