import "server-only";
import { MILES, RACE } from "../race";
import { getDb } from "./db";
import { getRegistry } from "./repo";
import { now } from "./clock";

/** Name + progress for link previews. Null if the race doesn't exist (or the DB is unreachable). */
export async function registrySummary(id: string) {
  try {
    const reg = await getRegistry(await getDb(), id, now());
    return {
      name: reg.runnerName.trim().split(/\s+/)[0],
      songs: reg.total,
      milesOpen: reg.miles.filter((m) => m.songs.length < reg.perMile).length,
      miles: MILES.length,
      capacity: MILES.length * reg.perMile,
      race: RACE.name,
    };
  } catch {
    return null;
  }
}
