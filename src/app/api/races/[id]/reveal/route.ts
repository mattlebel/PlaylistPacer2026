import type { NextRequest } from "next/server";
import { getDb } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { revealRace } from "@/lib/server/repo";
import { now } from "@/lib/server/clock";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/races/[id]/reveal">) {
  return handle(async () => revealRace(await getDb(), (await ctx.params).id, req.headers.get("x-manage-key"), now()));
}
