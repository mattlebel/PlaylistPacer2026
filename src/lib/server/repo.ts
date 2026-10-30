import "server-only";
import { z } from "zod";
import { ADDING_CLOSES_AT, DEFAULT_PACE_SEC, DEFAULT_START, MILES, RACE, SONGS_PER_MILE, mileLabel, startInstant } from "../race";
import type { Song } from "../types";
import { songKey } from "../songKey";
import { hashKey, keyMatches, newId, newKey } from "./crypto";
import { uniqueViolation, type Db } from "./db";

export class AppError extends Error {
  constructor(
    public code: "invalid" | "not_found" | "forbidden" | "mile_full" | "song_taken" | "closed" | "limit",
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/* ---------- validation ---------- */

const songSchema = z.object({
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().min(1).max(200),
  spotifyId: z.string().regex(/^[A-Za-z0-9]{22}$/).optional(),
  uri: z.string().regex(/^spotify:track:[A-Za-z0-9]{22}$/).optional(),
  art: z.url().max(500).optional(),
  durationSec: z.number().int().min(10).max(3600).optional(),
});

const email = z.email("That email doesn't look right").max(200).transform((s) => s.trim().toLowerCase());

const startTime = z.string().regex(/^(0[7-9]|1[0-2]):[0-5]\d$/, "Pick a start time between 7:00 and 12:59");
const paceSec = z.number().int().min(300, "That pace is faster than 5:00 a mile").max(1200, "That pace is slower than 20:00 a mile");
const bib = z
  .string()
  .trim()
  .regex(/^\d{1,6}$/, "Bib numbers are just digits")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const createRaceSchema = z.object({
  runnerName: z.string().trim().min(1, "Add your name").max(40),
  runnerEmail: email.optional(),
  startTime: startTime.default(DEFAULT_START),
  paceSec: paceSec.default(DEFAULT_PACE_SEC),
  bib,
});

export const raceSettingsSchema = z.object({
  startTime: startTime.optional(),
  paceSec: paceSec.optional(),
  bib: bib.nullable(),
  playlistId: z.string().regex(/^[A-Za-z0-9]{22}$/).optional(),
});

export const addSongSchema = z.object({
  mile: z.number().int().min(0).max(26),
  /** Shown as "from Sarah". */
  name: z.string().trim().min(1, "Add your name, so they know who picked it").max(40),
  song: songSchema,
});

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new AppError("invalid", r.error.issues[0]?.message ?? "Invalid input");
  return r.data;
}

/* ---------- songs ---------- */

export { songKey } from "../songKey";

/* ---------- rows ---------- */

interface RaceRow {
  id: string;
  manage_key_hash: string;
  runner_name: string;
  runner_email: string | null;
  start_time: Date | string | null;
  pace_sec: number | null;
  bib: string | null;
  spotify_playlist_id: string | null;
  created_at: Date | string;
}

/** Wave start, pace and bib, for estimated times along the course. Races from before this existed get the defaults. */
const raceInfo = (r: RaceRow) => ({
  startTime: (r.start_time ? new Date(r.start_time) : startInstant(DEFAULT_START)).toISOString(),
  paceSec: r.pace_sec ?? DEFAULT_PACE_SEC,
  bib: r.bib ?? undefined,
});

interface PlantRow {
  id: string;
  race_id: string;
  mile: number;
  slot: number;
  is_runner: boolean;
  name: string | null;
  edit_key_hash: string | null;
  spotify_id: string | null;
  uri: string | null;
  title: string;
  artist: string;
  art: string | null;
  duration_sec: number | null;
  message: string | null;
  created_at: Date | string;
}

const songOf = (p: PlantRow): Song => ({
  title: p.title,
  artist: p.artist,
  spotifyId: p.spotify_id ?? undefined,
  uri: p.uri ?? undefined,
  art: p.art ?? undefined,
  durationSec: p.duration_sec ?? undefined,
});

const firstName = (n: string | null) => n?.trim().split(/\s+/)[0] || undefined;

async function loadRace(db: Db, id: string) {
  const [race] = await db.query<RaceRow>("select * from races where id = $1", [id]);
  if (!race) throw new AppError("not_found", "We couldn't find that race link.", 404);
  return race;
}

async function loadPlants(db: Db, raceId: string) {
  return db.query<PlantRow>("select * from plants where race_id = $1 order by mile, slot", [raceId]);
}

const isOpen = (now: Date) => now < ADDING_CLOSES_AT;

function checkManageKey(race: RaceRow, key: string | null) {
  if (!keyMatches(key, race.manage_key_hash)) throw new AppError("forbidden", "That private link isn't valid.", 403);
}

/** Groups songs under every mile marker, in course order. */
function byMile<T>(plants: PlantRow[], view: (p: PlantRow) => T) {
  return MILES.map((m) => ({ n: m.n, songs: plants.filter((p) => p.mile === m.n).map(view) }));
}

/* ---------- runner ---------- */

export async function createRace(db: Db, input: unknown) {
  const data = parse(createRaceSchema, input);
  const id = newId(10);
  const manageKey = newKey();
  await db.query(
    `insert into races (id, manage_key_hash, runner_name, runner_email, race, start_time, pace_sec, bib) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, hashKey(manageKey), data.runnerName, data.runnerEmail ?? null, RACE.id, startInstant(data.startTime).toISOString(), data.paceSec, data.bib ?? null],
  );
  return { id, manageKey, runnerName: data.runnerName, runnerEmail: data.runnerEmail };
}

/** The live map everyone sees: every song on every mile, with first names only. */
export async function getRegistry(db: Db, raceId: string, now = new Date()) {
  const race = await loadRace(db, raceId);
  const plants = await loadPlants(db, raceId);
  const recent = [...plants]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      mile: p.mile,
      title: p.title,
      artist: p.artist,
      art: p.art ?? undefined,
      spotifyId: p.spotify_id ?? undefined,
      from: p.is_runner ? undefined : firstName(p.name),
      isRunner: p.is_runner,
      at: new Date(p.created_at).toISOString(),
    }));
  return {
    id: race.id,
    runnerName: race.runner_name,
    ...raceInfo(race),
    now: now.toISOString(),
    open: isOpen(now),
    closesAt: ADDING_CLOSES_AT.toISOString(),
    perMile: SONGS_PER_MILE,
    total: plants.length,
    recent,
    miles: byMile(plants, (p) => ({ id: p.id, song: songOf(p), from: p.is_runner ? undefined : firstName(p.name), isRunner: p.is_runner })),
  };
}

/** The runner's private view: full names, notes from the first version, and ids for removing songs. */
export async function getManage(db: Db, raceId: string, key: string | null, now = new Date()) {
  const race = await loadRace(db, raceId);
  checkManageKey(race, key);
  const plants = await loadPlants(db, raceId);
  return {
    id: race.id,
    runnerName: race.runner_name,
    ...raceInfo(race),
    playlistId: race.spotify_playlist_id ?? undefined,
    open: isOpen(now),
    closesAt: ADDING_CLOSES_AT.toISOString(),
    perMile: SONGS_PER_MILE,
    total: plants.length,
    milesWithSongs: new Set(plants.map((p) => p.mile)).size,
    miles: byMile(plants, (p) => ({
      id: p.id,
      song: songOf(p),
      from: p.is_runner ? undefined : (p.name ?? undefined),
      isRunner: p.is_runner,
      message: p.message ?? undefined,
    })),
  };
}

/** The runner updates their wave start, pace or bib, or remembers the Spotify playlist to update next time. */
export async function updateRaceSettings(db: Db, raceId: string, key: string | null, input: unknown) {
  const data = parse(raceSettingsSchema, input);
  checkManageKey(await loadRace(db, raceId), key);
  const sets: string[] = [];
  const vals: unknown[] = [raceId];
  const put = (col: string, v: unknown) => {
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  };
  if (data.startTime) put("start_time", startInstant(data.startTime).toISOString());
  if (data.paceSec) put("pace_sec", data.paceSec);
  if (data.bib !== undefined) put("bib", data.bib);
  if (data.playlistId) put("spotify_playlist_id", data.playlistId);
  if (sets.length) await db.query(`update races set ${sets.join(", ")} where id = $1`, vals);
}

/** The runner can remove any song (frees its spot on the mile). */
export async function removeSongAsRunner(db: Db, raceId: string, key: string | null, plantId: string) {
  checkManageKey(await loadRace(db, raceId), key);
  await db.query("delete from plants where id = $1 and race_id = $2", [plantId, raceId]);
}

/* ---------- friends ---------- */

export async function addSong(db: Db, raceId: string, input: unknown, now = new Date()) {
  const data = parse(addSongSchema, input);
  const race = await loadRace(db, raceId);
  if (!isOpen(now)) throw new AppError("closed", "Adding songs is closed. The race is about to start!", 403);

  const editKey = newKey();
  const id = newId(12);
  // Take the lowest free slot on this mile. If someone else takes it at the same moment,
  // the unique index refuses one of us and we try the next slot.
  for (let attempt = 0; attempt < SONGS_PER_MILE; attempt++) {
    const used = await db.query<{ slot: number }>("select slot from plants where race_id = $1 and mile = $2", [raceId, data.mile]);
    const taken = new Set(used.map((u) => u.slot));
    const slot = Array.from({ length: SONGS_PER_MILE }, (_, i) => i).find((i) => !taken.has(i));
    if (slot === undefined) throw new AppError("mile_full", `${mileLabel(data.mile)} is full. Try a mile nearby!`, 409);
    try {
      await db.query(
        `insert into plants (id, race_id, mile, slot, is_runner, name, edit_key_hash, song_key, spotify_id, uri, title, artist, art, duration_sec)
         values ($1,$2,$3,$4,false,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          id,
          raceId,
          data.mile,
          slot,
          data.name,
          hashKey(editKey),
          songKey(data.song),
          data.song.spotifyId ?? null,
          data.song.uri ?? null,
          data.song.title,
          data.song.artist,
          data.song.art ?? null,
          data.song.durationSec ?? null,
        ],
      );
      return { id, editKey, mile: data.mile, runnerName: race.runner_name };
    } catch (e) {
      const which = uniqueViolation(e);
      if (which?.includes("song")) throw new AppError("song_taken", "That song is already on the course. Pick a different one!", 409);
      if (which?.includes("slot")) continue;
      throw e;
    }
  }
  throw new AppError("mile_full", `${mileLabel(data.mile)} just filled up. Try a mile nearby!`, 409);
}

async function loadOwnPlant(db: Db, plantId: string, key: string | null) {
  const [p] = await db.query<PlantRow>("select * from plants where id = $1", [plantId]);
  if (!p || !keyMatches(key, p.edit_key_hash)) throw new AppError("forbidden", "That link isn't valid.", 403);
  return p;
}

export async function getOwnSong(db: Db, plantId: string, key: string | null, now = new Date()) {
  const p = await loadOwnPlant(db, plantId, key);
  const race = await loadRace(db, p.race_id);
  return { id: p.id, raceId: race.id, runnerName: race.runner_name, mile: p.mile, song: songOf(p), removable: isOpen(now) };
}

export async function deleteOwnSong(db: Db, plantId: string, key: string | null, now = new Date()) {
  await loadOwnPlant(db, plantId, key);
  if (!isOpen(now)) throw new AppError("closed", "Adding songs is closed, so this can't change now.", 403);
  await db.query("delete from plants where id = $1", [plantId]);
}
