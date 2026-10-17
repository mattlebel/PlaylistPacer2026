import type { NextRequest } from "next/server";
import { getDb } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { getRegistry } from "@/lib/server/repo";
import { now } from "@/lib/server/clock";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/races/[id]">) {
  return handle(async () => getRegistry(await getDb(), (await ctx.params).id, now()));
}
