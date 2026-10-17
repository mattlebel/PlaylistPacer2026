import type { NextRequest } from "next/server";
import { getDb } from "@/lib/server/db";
import { handle, readJson } from "@/lib/server/http";
import { deleteOwnPlant, getOwnPlant, updateOwnPlant } from "@/lib/server/repo";
import { now } from "@/lib/server/clock";

type Ctx = RouteContext<"/api/plants/[plantId]">;
const key = (req: NextRequest) => req.headers.get("x-edit-key");

export async function GET(req: NextRequest, ctx: Ctx) {
  return handle(async () => getOwnPlant(await getDb(), (await ctx.params).plantId, key(req), now()));
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => updateOwnPlant(await getDb(), (await ctx.params).plantId, key(req), await readJson(req), now()));
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return handle(async () => deleteOwnPlant(await getDb(), (await ctx.params).plantId, key(req), now()));
}
