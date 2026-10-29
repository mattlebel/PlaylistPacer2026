import type { NextRequest } from "next/server";
import { getDb } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { deleteOwnSong, getOwnSong } from "@/lib/server/repo";
import { now } from "@/lib/server/clock";

type Ctx = RouteContext<"/api/plants/[plantId]">;
const key = (req: NextRequest) => req.headers.get("x-edit-key");

export async function GET(req: NextRequest, ctx: Ctx) {
  return handle(async () => getOwnSong(await getDb(), (await ctx.params).plantId, key(req), now()));
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return handle(async () => deleteOwnSong(await getDb(), (await ctx.params).plantId, key(req), now()));
}
