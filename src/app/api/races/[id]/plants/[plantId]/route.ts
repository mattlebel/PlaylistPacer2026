import type { NextRequest } from "next/server";
import { getDb } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { removeSongAsRunner } from "@/lib/server/repo";

/** The runner can remove any song (frees its spot on the mile). */
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/races/[id]/plants/[plantId]">) {
  return handle(async () => {
    const { id, plantId } = await ctx.params;
    await removeSongAsRunner(await getDb(), id, req.headers.get("x-manage-key"), plantId);
  });
}
