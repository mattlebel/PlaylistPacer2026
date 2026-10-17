import "server-only";
import { z } from "zod";
import { MOMENTS, momentById, momentOffsets, RACE, startInstant } from "../race";
import type { Song } from "../types";
import { hashKey, keyMatches, newId, newKey } from "./crypto";
import { uniqueViolation, type Db } from "./db";

export class AppError extends Error {
  constructor(
    public code: "invalid" | "not_found" | "forbidden" | "moment_taken" | "song_taken" | "closed" | "limit" | "not_yet",
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

const name = z.string().trim().min(1, "Add your name").max(40);
const email = z.email("That email doesn't look right").max(200).transform((s) => s.trim().toLowerCase());
const message = z.string().trim().max(150, "Keep the note to 150 characters").optional().transform((s) => s || undefined);

export const createRaceSchema = z.object({
  runnerName: name,
  runnerEmail: email.optional(),
  goalSec: z.number().int().min(2 * 3600).max(8 * 3600),
  startTime: z.string().regex(/^(0[7-9]|1[0-2]):[0-5]\d$/, "Pick a start time between 7:00 and 12:59"),
  songs: z.object({ start: songSchema, half: songSchema, finish: songSchema }),
});

export const plantSchema = z.object({ moment: z.string(), name, email, message, song: songSchema });
export const updatePlantSchema = z.object({ message, song: songSchema.optional() });

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new AppError("invalid", r.error.issues[0]?.message ?? "Invalid input");
  return r.data;
}

/* ---------- songs ---------- */

/**
 * Duplicate detection key. Based on title + lead artist so different releases of the same
 * song ("Mr. Brightside", "Mr. Brightside - Remastered") still count as a duplicate.
 */
export function songKey(s: Pick<Song, "title" | "artist">) {
  const title = s.title
    .toLowerCase()
    .replace(/\s+-\s+.*$/, "")
    .replace(/[([].*?[)\]]/g, "")
    .replace(/\b(feat|ft)\.?\s.*$/, "");
  const artist = s.artist.toLowerCase().split(/,|&| and | feat\.? | x /)[0];
  const clean = (x: string) => x.normalize("NFKD").replace(/[^a-z0-9]/g, "");
  return `${clean(title)}|${clean(artist)}`;
}

/* ---------- time rules ---------- */

const HOUR = 3600_000;

export function raceTimes(race: { start_time: Date | string; goal_sec: number }) {
  const start = new Date(race.start_time);
  return {
    start,
    /** Friends can plant until two hours before the runner's wave. */
    plantingClosesAt: new Date(start.getTime() - 2 * HOUR),
    /** The race-day cue list and playlist unlock at 4am. */
    raceDayOpensAt: new Date(`${RACE.date}T04:00:00${RACE.utcOffset}`),
    /** Messages unlock on their own 30 minutes after the goal time, or earlier if the runner taps reveal after the gun. */
    autoRevealAt: new Date(start.getTime() + race.goal_sec * 1000 + 0.5 * HOUR),
  };
}

/* ---------- rows ---------- */

interface RaceRow {
  id: string;
  manage_key_hash: string;
  runner_name: string;
  runner_email: string | null;
  race: string;
  goal_sec: number;
  start_time: Date | string;
  revealed_at: Date | string | null;
  created_at: Date | string;
}

interface PlantRow {
  id: string;
  race_id: string;
  moment: string;
  is_runner: boolean;
  name: string;
  email: string | null;
  edit_key_hash: string | null;
  song_key: string;
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

const firstName = (n: string) => n.trim().split(/\s+/)[0];

async function loadRace(db: Db, id: string) {
  const [race] = await db.query<RaceRow>("select * from races where id = $1", [id]);
  if (!race) throw new AppError("not_found", "We couldn't find that race link.", 404);
  return race;
}

async function loadPlants(db: Db, raceId: string) {
  return db.query<PlantRow>("select * from plants where race_id = $1 order by created_at", [raceId]);
}

function etaMap(race: RaceRow) {
  const start = new Date(race.start_time);
  const offs = momentOffsets(race.goal_sec);
  return Object.fromEntries(Object.entries(offs).map(([k, s]) => [k, new Date(start.getTime() + s * 1000).toISOString()]));
}

async function insertPlant(
  db: Db,
  p: { raceId: string; moment: string; isRunner: boolean; name: string; email?: string; editKeyHash?: string; song: Song; message?: string },
) {
  const id = newId(12);
  try {
    await db.query(
      `insert into plants (id, race_id, moment, is_runner, name, email, edit_key_hash, song_key, spotify_id, uri, title, artist, art, duration_sec, message)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        id,
        p.raceId,
        p.moment,
        p.isRunner,
        p.name,
        p.email ?? null,
        p.editKeyHash ?? null,
        songKey(p.song),
        p.song.spotifyId ?? null,
        p.song.uri ?? null,
        p.song.title,
        p.song.artist,
        p.song.art ?? null,
        p.song.durationSec ?? null,
        p.message ?? null,
      ],
    );
  } catch (e) {
    const which = uniqueViolation(e);
    if (which?.includes("moment")) throw new AppError("moment_taken", "Someone just claimed that moment. Pick another one!", 409);
    if (which?.includes("song")) throw new AppError("song_taken", "That song is already planted on this course. Pick a different one!", 409);
    throw e;
  }
  return id;
}

/* ---------- runner ---------- */

export async function createRace(db: Db, input: unknown) {
  const data = parse(createRaceSchema, input);
  const keys = [data.songs.start, data.songs.half, data.songs.finish].map(songKey);
  if (new Set(keys).size !== 3) throw new AppError("invalid", "Pick three different songs for your start, halfway and finish.");

  const id = newId(10);
  const manageKey = newKey();
  await db.query(
    `insert into races (id, manage_key_hash, runner_name, runner_email, race, goal_sec, start_time) values ($1,$2,$3,$4,$5,$6,$7)`,
    [id, hashKey(manageKey), data.runnerName, data.runnerEmail ?? null, RACE.id, data.goalSec, startInstant(data.startTime).toISOString()],
  );
  for (const [moment, song] of [
    ["start", data.songs.start],
    ["half", data.songs.half],
    ["finish", data.songs.finish],
  ] as const) {
    await insertPlant(db, { raceId: id, moment, isRunner: true, name: data.runnerName, song });
  }
  return { id, manageKey, runnerName: data.runnerName, runnerEmail: data.runnerEmail };
}

/** Public view for friends: who claimed what (first names only), never songs or notes from friends. */
export async function getRegistry(db: Db, raceId: string, now = new Date()) {
  const race = await loadRace(db, raceId);
  const plants = await loadPlants(db, raceId);
  const times = raceTimes(race);
  const eta = etaMap(race);
  const byMoment = new Map(plants.map((p) => [p.moment, p]));
  return {
    id: race.id,
    runnerName: race.runner_name,
    goalSec: race.goal_sec,
    startTime: times.start.toISOString(),
    plantingOpen: now < times.plantingClosesAt,
    plantingClosesAt: times.plantingClosesAt.toISOString(),
    moments: MOMENTS.map((m) => {
      const p = byMoment.get(m.id);
      return {
        id: m.id,
        eta: eta[m.id],
        owner: m.owner,
        status: m.owner === "runner" ? ("runner" as const) : p ? ("claimed" as const) : ("open" as const),
        claimedBy: p && !p.is_runner ? firstName(p.name) : undefined,
        // The runner's own three picks are visible so friends don't double up on them.
        song: p?.is_runner ? songOf(p) : undefined,
      };
    }),
  };
}

export async function getManage(db: Db, raceId: string, key: string | null, now = new Date()) {
  const race = await loadRace(db, raceId);
  if (!keyMatches(key, race.manage_key_hash)) throw new AppError("forbidden", "That manage link isn't valid.", 403);
  const plants = await loadPlants(db, raceId);
  const times = raceTimes(race);
  const eta = etaMap(race);
  const revealed = !!race.revealed_at || now >= times.autoRevealAt;
  const raceDay = now >= times.raceDayOpensAt;
  const byMoment = new Map(plants.map((p) => [p.moment, p]));

  return {
    id: race.id,
    runnerName: race.runner_name,
    goalSec: race.goal_sec,
    startTime: times.start.toISOString(),
    plantingOpen: now < times.plantingClosesAt,
    raceDay,
    raceDayOpensAt: times.raceDayOpensAt.toISOString(),
    canReveal: now >= times.start,
    revealed,
    planted: plants.filter((p) => !p.is_runner).length,
    friendMoments: MOMENTS.filter((m) => m.owner === "friend").length,
    moments: MOMENTS.map((m) => {
      const p = byMoment.get(m.id);
      const open = p && (p.is_runner || revealed);
      return {
        id: m.id,
        eta: eta[m.id],
        owner: m.owner,
        plantId: p && !p.is_runner ? p.id : undefined,
        from: p ? (p.is_runner ? undefined : p.name) : undefined,
        song: open ? songOf(p) : undefined,
        message: revealed ? (p?.message ?? undefined) : undefined,
        // Race day: enough to play each track at its moment without showing its title.
        playUri: raceDay && p ? (p.uri ?? undefined) : undefined,
      };
    }),
  };
}

export async function revealRace(db: Db, raceId: string, key: string | null, now = new Date()) {
  const race = await loadRace(db, raceId);
  if (!keyMatches(key, race.manage_key_hash)) throw new AppError("forbidden", "That manage link isn't valid.", 403);
  if (now < raceTimes(race).start) throw new AppError("not_yet", "No peeking! Notes unlock once you've started the race.", 409);
  await db.query("update races set revealed_at = coalesce(revealed_at, $2) where id = $1", [raceId, now.toISOString()]);
}

/** Runner-side moderation: remove a friend's plant (frees the moment). */
export async function removePlantAsRunner(db: Db, raceId: string, key: string | null, plantId: string) {
  const race = await loadRace(db, raceId);
  if (!keyMatches(key, race.manage_key_hash)) throw new AppError("forbidden", "That manage link isn't valid.", 403);
  await db.query("delete from plants where id = $1 and race_id = $2 and is_runner = false", [plantId, raceId]);
}

/* ---------- friends ---------- */

export const MAX_PLANTS_PER_EMAIL = 2;

export async function plantSong(db: Db, raceId: string, input: unknown, now = new Date()) {
  const data = parse(plantSchema, input);
  const race = await loadRace(db, raceId);
  const moment = momentById(data.moment);
  if (!moment || moment.owner !== "friend") throw new AppError("invalid", "That moment isn't open for planting.");
  if (now >= raceTimes(race).plantingClosesAt) throw new AppError("closed", "Planting is closed. The race is about to start!", 403);

  const [{ n }] = await db.query<{ n: number }>(
    "select count(*)::int as n from plants where race_id = $1 and lower(email) = $2",
    [raceId, data.email],
  );
  if (n >= MAX_PLANTS_PER_EMAIL) throw new AppError("limit", `Everyone gets ${MAX_PLANTS_PER_EMAIL} songs, so there's room for others.`, 429);

  const editKey = newKey();
  const id = await insertPlant(db, {
    raceId,
    moment: moment.id,
    isRunner: false,
    name: data.name,
    email: data.email,
    editKeyHash: hashKey(editKey),
    song: data.song,
    message: data.message,
  });
  return { id, editKey, moment: moment.id, eta: etaMap(race)[moment.id], runnerName: race.runner_name };
}

async function loadOwnPlant(db: Db, plantId: string, key: string | null) {
  const [p] = await db.query<PlantRow>("select * from plants where id = $1", [plantId]);
  if (!p || p.is_runner || !keyMatches(key, p.edit_key_hash)) throw new AppError("forbidden", "That edit link isn't valid.", 403);
  return p;
}

export async function getOwnPlant(db: Db, plantId: string, key: string | null, now = new Date()) {
  const p = await loadOwnPlant(db, plantId, key);
  const race = await loadRace(db, p.race_id);
  return {
    id: p.id,
    raceId: race.id,
    runnerName: race.runner_name,
    moment: p.moment,
    eta: etaMap(race)[p.moment],
    name: p.name,
    song: songOf(p),
    message: p.message ?? undefined,
    editable: now < raceTimes(race).plantingClosesAt,
  };
}

export async function updateOwnPlant(db: Db, plantId: string, key: string | null, input: unknown, now = new Date()) {
  const data = parse(updatePlantSchema, input);
  const p = await loadOwnPlant(db, plantId, key);
  const race = await loadRace(db, p.race_id);
  if (now >= raceTimes(race).plantingClosesAt) throw new AppError("closed", "Planting is closed, so this can't change now.", 403);
  const song = data.song ?? songOf(p);
  try {
    await db.query(
      `update plants set message = $2, song_key = $3, spotify_id = $4, uri = $5, title = $6, artist = $7, art = $8, duration_sec = $9, updated_at = now()
       where id = $1`,
      [plantId, data.message ?? null, songKey(song), song.spotifyId ?? null, song.uri ?? null, song.title, song.artist, song.art ?? null, song.durationSec ?? null],
    );
  } catch (e) {
    if (uniqueViolation(e)?.includes("song")) throw new AppError("song_taken", "That song is already planted on this course. Pick a different one!", 409);
    throw e;
  }
}

export async function deleteOwnPlant(db: Db, plantId: string, key: string | null, now = new Date()) {
  const p = await loadOwnPlant(db, plantId, key);
  const race = await loadRace(db, p.race_id);
  if (now >= raceTimes(race).plantingClosesAt) throw new AppError("closed", "Planting is closed, so this can't change now.", 403);
  await db.query("delete from plants where id = $1", [plantId]);
}
