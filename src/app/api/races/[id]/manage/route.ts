import type { NextRequest } from "next/server";
import { getDb } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { getManage } from "@/lib/server/repo";
import { now } from "@/lib/server/clock";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/races/[id]/manage">) {
  return handle(async () => getManage(await getDb(), (await ctx.params).id, req.headers.get("x-manage-key"), now()));
}
