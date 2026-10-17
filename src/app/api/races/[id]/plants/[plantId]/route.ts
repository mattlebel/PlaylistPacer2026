import type { NextRequest } from "next/server";
import { getDb } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { removePlantAsRunner } from "@/lib/server/repo";

/** The runner can remove a plant (frees the moment). */
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/races/[id]/plants/[plantId]">) {
  return handle(async () => {
    const { id, plantId } = await ctx.params;
    await removePlantAsRunner(await getDb(), id, req.headers.get("x-manage-key"), plantId);
  });
}
