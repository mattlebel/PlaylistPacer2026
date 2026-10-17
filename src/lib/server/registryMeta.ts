import "server-only";
import { RACE } from "../race";
import { getDb } from "./db";
import { getRegistry } from "./repo";
import { now } from "./clock";

/** Name + progress for link previews. Null if the race doesn't exist (or the DB is unreachable). */
export async function registrySummary(id: string) {
  try {
    const reg = await getRegistry(await getDb(), id, now());
    const friend = reg.moments.filter((m) => m.owner === "friend");
    return {
      name: reg.runnerName.trim().split(/\s+/)[0],
      planted: friend.filter((m) => m.status === "claimed").length,
      total: friend.length,
      race: RACE.name,
    };
  } catch {
    return null;
  }
}
