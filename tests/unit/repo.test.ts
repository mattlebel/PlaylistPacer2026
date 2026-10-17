import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MOMENTS } from "@/lib/race";
import { createDb, type Db } from "@/lib/server/db";
import {
  AppError,
  createRace,
  deleteOwnPlant,
  getManage,
  getOwnPlant,
  getRegistry,
  MAX_PLANTS_PER_EMAIL,
  plantSong,
  raceTimes,
  removePlantAsRunner,
  revealRace,
  songKey,
  updateOwnPlant,
} from "@/lib/server/repo";

let db: Db;
beforeAll(async () => {
  db = await createDb({ dataDir: "memory://" });
});
afterAll(() => db.close());
beforeEach(async () => {
  await db.query("delete from plants");
  await db.query("delete from races");
});

const song = (title: string, artist = "Someone", id?: string) => ({
  title,
  artist,
  ...(id ? { spotifyId: id, uri: `spotify:track:${id}` } : {}),
});
const sid = (c: string) => c.repeat(22);

// Wave 1 at 9:10am EST; planting closes 7:10am, race-day tools open 4am.
const BEFORE = new Date("2026-10-20T12:00:00-04:00");
const RACE_MORNING = new Date("2026-11-01T06:00:00-05:00");
const LOCKED = new Date("2026-11-01T07:30:00-05:00");
const AFTER_GUN = new Date("2026-11-01T09:30:00-05:00");
const AFTER_FINISH = new Date("2026-11-01T14:00:00-05:00");

async function newRace(over: Record<string, unknown> = {}) {
  return createRace(db, {
    runnerName: "Matt Lebel",
    runnerEmail: "Matt@Example.com",
    goalSec: 4 * 3600,
    startTime: "09:10",
    songs: {
      start: song("Empire State of Mind", "JAY-Z, Alicia Keys", sid("a")),
      half: song("Titanium", "David Guetta, Sia", sid("b")),
      finish: song("'Till I Collapse", "Eminem", sid("c")),
    },
    ...over,
  });
}

async function expectCode(p: Promise<unknown>, code: AppError["code"]) {
  await expect(p).rejects.toSatisfy((e) => e instanceof AppError && e.code === code);
}

describe("songKey", () => {
  it("treats different releases of a song as the same", () => {
    expect(songKey(song("Mr. Brightside", "The Killers"))).toBe(songKey(song("Mr. Brightside - Remastered 2024", "The Killers")));
    expect(songKey(song("Titanium (feat. Sia)", "David Guetta, Sia"))).toBe(songKey(song("Titanium", "David Guetta")));
    expect(songKey(song("Run the World (Girls)", "Beyoncé"))).toBe(songKey(song("run the world", "BEYONCE")));
  });
  it("keeps different songs apart", () => {
    expect(songKey(song("Juice", "Lizzo"))).not.toBe(songKey(song("Juicy", "Lizzo")));
    expect(songKey(song("Stronger", "Kanye West"))).not.toBe(songKey(song("Stronger", "Kelly Clarkson")));
  });
});

describe("createRace", () => {
  it("creates a race with the runner's three songs and a secret manage key", async () => {
    const r = await newRace();
    expect(r.id).toMatch(/^[a-z2-9]{10}$/);
    expect(r.manageKey.length).toBeGreaterThan(20);
    const [row] = await db.query<{ manage_key_hash: string; runner_email: string; start_time: Date }>("select * from races");
    expect(row.manage_key_hash).not.toContain(r.manageKey);
    expect(row.runner_email).toBe("matt@example.com");
    expect(new Date(row.start_time).toISOString()).toBe("2026-11-01T14:10:00.000Z");
    const plants = await db.query<{ moment: string; is_runner: boolean }>("select moment, is_runner from plants order by moment");
    expect(plants).toEqual([
      { moment: "finish", is_runner: true },
      { moment: "half", is_runner: true },
      { moment: "start", is_runner: true },
    ]);
  });

  it("rejects repeated songs and bad input", async () => {
    await expectCode(newRace({ songs: { start: song("A"), half: song("A"), finish: song("B") } }), "invalid");
    await expectCode(newRace({ runnerName: "" }), "invalid");
    await expectCode(newRace({ goalSec: 600 }), "invalid");
    await expectCode(newRace({ startTime: "15:00" }), "invalid");
    await expectCode(newRace({ runnerEmail: "nope" }), "invalid");
  });
});

describe("registry", () => {
  it("lists every moment with ETAs, the runner's picks, and first names only", async () => {
    const r = await newRace();
    await plantSong(db, r.id, { moment: "bronx", name: "Sarah Connor", email: "s@x.com", message: "You got this", song: song("Juice", "Lizzo") }, BEFORE);
    const reg = await getRegistry(db, r.id, BEFORE);
    expect(reg.runnerName).toBe("Matt Lebel");
    expect(reg.plantingOpen).toBe(true);
    expect(reg.moments).toHaveLength(MOMENTS.length);
    const bronx = reg.moments.find((m) => m.id === "bronx")!;
    expect(bronx).toMatchObject({ status: "claimed", claimedBy: "Sarah" });
    expect(bronx.song).toBeUndefined();
    expect(JSON.stringify(reg)).not.toContain("You got this");
    expect(JSON.stringify(reg)).not.toContain("s@x.com");
    expect(reg.moments.find((m) => m.id === "start")).toMatchObject({ status: "runner", song: { title: "Empire State of Mind" } });
    expect(reg.moments.find((m) => m.id === "5k")!.status).toBe("open");
    // ETAs increase along the course and the finish lands near the goal.
    const etas = reg.moments.map((m) => new Date(m.eta).getTime());
    expect([...etas].sort((a, b) => a - b)).toEqual(etas);
    const finishMins = (etas.at(-1)! - etas[0]) / 60000;
    expect(finishMins).toBeGreaterThan(230);
    expect(finishMins).toBeLessThan(240);
  });

  it("404s for unknown links", async () => {
    await expectCode(getRegistry(db, "nope"), "not_found");
  });
});

describe("plantSong", () => {
  it("claims a moment and returns an edit key", async () => {
    const r = await newRace();
    const p = await plantSong(db, r.id, { moment: "queensboro", name: "Ana", email: "ANA@x.com", song: song("Mr. Brightside", "The Killers", sid("d")) }, BEFORE);
    expect(p.editKey.length).toBeGreaterThan(20);
    expect(p.runnerName).toBe("Matt Lebel");
    const [row] = await db.query<{ email: string; uri: string; message: string | null }>("select * from plants where id = $1", [p.id]);
    expect(row).toMatchObject({ email: "ana@x.com", uri: `spotify:track:${sid("d")}`, message: null });
  });

  it("allows one song per moment", async () => {
    const r = await newRace();
    await plantSong(db, r.id, { moment: "bronx", name: "A", email: "a@x.com", song: song("Juice", "Lizzo") }, BEFORE);
    await expectCode(plantSong(db, r.id, { moment: "bronx", name: "B", email: "b@x.com", song: song("Toxic", "Britney Spears") }, BEFORE), "moment_taken");
  });

  it("handles two friends grabbing the same moment at the same time", async () => {
    const r = await newRace();
    const results = await Promise.allSettled([
      plantSong(db, r.id, { moment: "40k", name: "A", email: "a@x.com", song: song("Juice", "Lizzo") }, BEFORE),
      plantSong(db, r.id, { moment: "40k", name: "B", email: "b@x.com", song: song("Toxic", "Britney Spears") }, BEFORE),
    ]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((x) => x.status === "rejected") as PromiseRejectedResult;
    expect((rejected.reason as AppError).code).toBe("moment_taken");
  });

  it("blocks duplicate songs, including the runner's own picks and other versions", async () => {
    const r = await newRace();
    await expectCode(plantSong(db, r.id, { moment: "5k", name: "A", email: "a@x.com", song: song("Titanium (feat. Sia)", "David Guetta") }, BEFORE), "song_taken");
    await plantSong(db, r.id, { moment: "5k", name: "A", email: "a@x.com", song: song("Mr. Brightside", "The Killers") }, BEFORE);
    await expectCode(plantSong(db, r.id, { moment: "10k", name: "B", email: "b@x.com", song: song("Mr. Brightside - Remastered", "The Killers") }, BEFORE), "song_taken");
  });

  it("refuses runner moments, unknown moments, long notes and missing emails", async () => {
    const r = await newRace();
    await expectCode(plantSong(db, r.id, { moment: "half", name: "A", email: "a@x.com", song: song("X") }, BEFORE), "invalid");
    await expectCode(plantSong(db, r.id, { moment: "mile-27", name: "A", email: "a@x.com", song: song("X") }, BEFORE), "invalid");
    await expectCode(plantSong(db, r.id, { moment: "5k", name: "A", email: "a@x.com", message: "x".repeat(151), song: song("X") }, BEFORE), "invalid");
    await expectCode(plantSong(db, r.id, { moment: "5k", name: "A", song: song("X") }, BEFORE), "invalid");
  });

  it(`caps each email at ${MAX_PLANTS_PER_EMAIL} songs`, async () => {
    const r = await newRace();
    const base = { name: "Superfan", email: "fan@x.com" };
    await plantSong(db, r.id, { ...base, moment: "5k", song: song("One") }, BEFORE);
    await plantSong(db, r.id, { ...base, moment: "10k", song: song("Two") }, BEFORE);
    await expectCode(plantSong(db, r.id, { ...base, email: "FAN@x.com", moment: "bronx", song: song("Three") }, BEFORE), "limit");
  });

  it("closes two hours before the runner's wave", async () => {
    const r = await newRace();
    const closes = new Date("2026-11-01T07:10:00-05:00");
    await plantSong(db, r.id, { moment: "5k", name: "A", email: "a@x.com", song: song("One") }, new Date(closes.getTime() - 1000));
    await expectCode(plantSong(db, r.id, { moment: "10k", name: "B", email: "b@x.com", song: song("Two") }, closes), "closed");
    expect((await getRegistry(db, r.id, closes)).plantingOpen).toBe(false);
  });
});

describe("editing your own plant", () => {
  it("reads, updates and deletes with the edit key only", async () => {
    const r = await newRace();
    const p = await plantSong(db, r.id, { moment: "bronx", name: "Ana", email: "a@x.com", message: "Go!", song: song("Juice", "Lizzo") }, BEFORE);
    await expectCode(getOwnPlant(db, p.id, "wrong", BEFORE), "forbidden");
    expect(await getOwnPlant(db, p.id, p.editKey, BEFORE)).toMatchObject({ moment: "bronx", message: "Go!", song: { title: "Juice" }, editable: true });

    await updateOwnPlant(db, p.id, p.editKey, { message: "Bronx is yours", song: song("Toxic", "Britney Spears") }, BEFORE);
    expect(await getOwnPlant(db, p.id, p.editKey, BEFORE)).toMatchObject({ message: "Bronx is yours", song: { title: "Toxic" } });
    await expectCode(updateOwnPlant(db, p.id, p.editKey, { song: song("Titanium", "David Guetta") }, BEFORE), "song_taken");

    await deleteOwnPlant(db, p.id, p.editKey, BEFORE);
    expect((await getRegistry(db, r.id, BEFORE)).moments.find((m) => m.id === "bronx")!.status).toBe("open");
  });

  it("locks once planting closes", async () => {
    const r = await newRace();
    const p = await plantSong(db, r.id, { moment: "bronx", name: "Ana", email: "a@x.com", song: song("Juice", "Lizzo") }, BEFORE);
    expect((await getOwnPlant(db, p.id, p.editKey, RACE_MORNING)).editable).toBe(true);
    expect((await getOwnPlant(db, p.id, p.editKey, LOCKED)).editable).toBe(false);
    await expectCode(updateOwnPlant(db, p.id, p.editKey, { message: "late" }, LOCKED), "closed");
    await expectCode(deleteOwnPlant(db, p.id, p.editKey, LOCKED), "closed");
  });

  it("can't touch the runner's picks", async () => {
    const r = await newRace();
    const [runner] = await db.query<{ id: string }>("select id from plants where race_id = $1 and is_runner", [r.id]);
    await expectCode(getOwnPlant(db, runner.id, r.manageKey, BEFORE), "forbidden");
  });
});

describe("runner view", () => {
  async function planted() {
    const r = await newRace();
    const p = await plantSong(db, r.id, { moment: "bronx", name: "Sarah Connor", email: "s@x.com", message: "Bronx is yours", song: song("Juice", "Lizzo", sid("e")) }, BEFORE);
    return { r, p };
  }

  it("needs the manage key", async () => {
    const { r } = await planted();
    await expectCode(getManage(db, r.id, null, BEFORE), "forbidden");
    await expectCode(getManage(db, r.id, "guess", BEFORE), "forbidden");
  });

  it("keeps friends' songs and notes sealed before race day", async () => {
    const { r } = await planted();
    const m = await getManage(db, r.id, r.manageKey, BEFORE);
    expect(m).toMatchObject({ planted: 1, friendMoments: 13, revealed: false, raceDay: false, canReveal: false });
    const bronx = m.moments.find((x) => x.id === "bronx")!;
    expect(bronx.from).toBe("Sarah Connor");
    expect(bronx.song).toBeUndefined();
    expect(bronx.message).toBeUndefined();
    expect(bronx.playUri).toBeUndefined();
    expect(JSON.stringify(m)).not.toContain("Juice");
    expect(m.moments.find((x) => x.id === "start")!.song!.title).toBe("Empire State of Mind");
  });

  it("unlocks play links (but not titles) on race morning", async () => {
    const { r } = await planted();
    const m = await getManage(db, r.id, r.manageKey, RACE_MORNING);
    expect(m.raceDay).toBe(true);
    const bronx = m.moments.find((x) => x.id === "bronx")!;
    expect(bronx.playUri).toBe(`spotify:track:${sid("e")}`);
    expect(bronx.song).toBeUndefined();
  });

  it("reveals only after the gun, then shows everything", async () => {
    const { r } = await planted();
    await expectCode(revealRace(db, r.id, r.manageKey, RACE_MORNING), "not_yet");
    await revealRace(db, r.id, r.manageKey, AFTER_GUN);
    const m = await getManage(db, r.id, r.manageKey, AFTER_GUN);
    expect(m.revealed).toBe(true);
    expect(m.moments.find((x) => x.id === "bronx")).toMatchObject({ song: { title: "Juice" }, message: "Bronx is yours" });
  });

  it("reveals on its own 30 minutes after the goal time", async () => {
    const { r } = await planted();
    expect((await getManage(db, r.id, r.manageKey, AFTER_FINISH)).revealed).toBe(true);
  });

  it("lets the runner remove a plant", async () => {
    const { r, p } = await planted();
    await expectCode(removePlantAsRunner(db, r.id, "guess", p.id), "forbidden");
    await removePlantAsRunner(db, r.id, r.manageKey, p.id);
    expect((await getManage(db, r.id, r.manageKey, BEFORE)).planted).toBe(0);
  });
});

describe("raceTimes", () => {
  it("derives the time windows from the start and goal", () => {
    const t = raceTimes({ start_time: "2026-11-01T14:10:00Z", goal_sec: 4 * 3600 });
    expect(t.plantingClosesAt.toISOString()).toBe("2026-11-01T12:10:00.000Z");
    expect(t.raceDayOpensAt.toISOString()).toBe("2026-11-01T09:00:00.000Z");
    expect(t.autoRevealAt.toISOString()).toBe("2026-11-01T18:40:00.000Z");
  });
});
