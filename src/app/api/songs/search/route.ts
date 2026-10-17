import type { NextRequest } from "next/server";
import { handle, rateLimit } from "@/lib/server/http";
import { searchSongs, songSearchConfigured } from "@/lib/server/songSearch";

export async function GET(req: NextRequest) {
  return handle(async () => {
    // Read the request first so this route is always rendered per request, never prerendered.
    const q = req.nextUrl.searchParams.get("q") ?? "";
    if (!songSearchConfigured()) return { configured: false, results: [] };
    rateLimit(req, "search", 120, 60_000);
    try {
      return { configured: true, results: await searchSongs(q) };
    } catch {
      return { configured: true, results: [], error: "Spotify search is having a moment. Try again, or type the song in." };
    }
  });
}
