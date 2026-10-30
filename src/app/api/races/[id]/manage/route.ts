import type { NextRequest } from "next/server";
import { getDb } from "@/lib/server/db";
import { handle, readJson } from "@/lib/server/http";
import { getManage, updateRaceSettings } from "@/lib/server/repo";
import { now } from "@/lib/server/clock";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/races/[id]/manage">) {
  return handle(async () => getManage(await getDb(), (await ctx.params).id, req.headers.get("x-manage-key"), now()));
}

/** Wave start, pace, bib, or the Spotify playlist to update on the next save. */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/races/[id]/manage">) {
  return handle(async () => updateRaceSettings(await getDb(), (await ctx.params).id, req.headers.get("x-manage-key"), await readJson(req)));
}
