import type { NextRequest } from "next/server";
import { RACE } from "@/lib/race";
import { getDb } from "@/lib/server/db";
import { sendEmail } from "@/lib/server/email";
import { appOrigin, handle, rateLimit, readJson } from "@/lib/server/http";
import { createRace } from "@/lib/server/repo";

export async function POST(req: NextRequest) {
  return handle(async () => {
    rateLimit(req, "create", 10, 3600_000);
    const race = await createRace(await getDb(), await readJson(req));
    const origin = appOrigin(req);
    const shareUrl = `${origin}/r/${race.id}`;
    const manageUrl = `${origin}/r/${race.id}/manage#key=${race.manageKey}`;
    const emailed = race.runnerEmail
      ? await sendEmail({
          to: race.runnerEmail,
          subject: `Your ${RACE.name} song link`,
          text: [
            `Hi ${race.runnerName},`,
            "",
            `Share this link with friends and family so they can plant a song along your race:`,
            shareUrl,
            "",
            `Keep this one private. It's how you manage your race and, after the finish, read every note:`,
            manageUrl,
            "",
            "Run happy,",
            "Playlist Pacer",
          ].join("\n"),
        })
      : false;
    return { id: race.id, manageKey: race.manageKey, shareUrl, manageUrl, emailed };
  });
}
