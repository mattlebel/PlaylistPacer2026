import type { NextRequest } from "next/server";
import { getDb } from "@/lib/server/db";
import { handle, rateLimit, readJson } from "@/lib/server/http";
import { addSong } from "@/lib/server/repo";
import { now } from "@/lib/server/clock";

/** Add a song to a mile marker. No account: the returned key lets this device remove it later. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/races/[id]/plants">) {
  return handle(async () => {
    rateLimit(req, "plant", 30, 3600_000);
    const { id } = await ctx.params;
    const res = await addSong(await getDb(), id, await readJson(req), now());
    return { id: res.id, editKey: res.editKey, mile: res.mile };
  });
}
