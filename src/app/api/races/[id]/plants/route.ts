import type { NextRequest } from "next/server";
import { fmtTimeOfDay, momentById, RACE } from "@/lib/race";
import { getDb } from "@/lib/server/db";
import { sendEmail } from "@/lib/server/email";
import { appOrigin, handle, rateLimit, readJson } from "@/lib/server/http";
import { plantSong } from "@/lib/server/repo";
import { now } from "@/lib/server/clock";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/races/[id]/plants">) {
  return handle(async () => {
    rateLimit(req, "plant", 20, 3600_000);
    const { id } = await ctx.params;
    const body = await readJson(req);
    const res = await plantSong(await getDb(), id, body, now());
    const editUrl = `${appOrigin(req)}/p/${res.id}#key=${res.editKey}`;
    const moment = momentById(res.moment)!;
    const emailed = await sendEmail({
      to: String(body.email).trim().toLowerCase(),
      subject: `You planted a song for ${res.runnerName}`,
      text: [
        `Thanks for planting a song for ${res.runnerName}'s ${RACE.name}!`,
        "",
        `Your song plays at ${moment.label}, around ${fmtTimeOfDay(new Date(res.eta))} on ${RACE.dateLabel}.`,
        `${res.runnerName} will hear it on the course and read your note after the finish.`,
        "",
        `Change your song or note (until two hours before the start):`,
        editUrl,
      ].join("\n"),
    });
    return { id: res.id, editKey: res.editKey, editUrl, eta: res.eta, emailed };
  });
}
