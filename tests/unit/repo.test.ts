import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MILES, SONGS_PER_MILE } from "@/lib/race";
import { createDb, type Db } from "@/lib/server/db";
import { addSong, AppError, createRace, deleteOwnSong, getManage, getOwnSong, getRegistry, removeSongAsRunner, songKey } from "@/lib/server/repo";
import { hashKey } from "@/lib/server/crypto";

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

const BEFORE = new Date("2026-10-20T12:00:00-04:00");
const JUST_BEFORE_CLOSE = new Date("2026-11-01T05:59:00-05:00");
const CLOSED = new Date("2026-11-01T06:00:00-05:00");

const newRace = (over: Record<string, unknown> = {}) => createRace(db, { runnerName: "Matt Lebel", runnerEmail: "Matt@Example.com", ...over });
const add = (raceId: string, mile: number, title: string, name = "Sam", now = BEFORE) => addSong(db, raceId, { mile, name, song: song(title) }, now);

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
  it("needs only a name, and keeps a hash of the private key, never the key", async () => {
    const r = await newRace();
    expect(r.id).toMatch(/^[a-z2-9]{10}$/);
    expect(r.manageKey.length).toBeGreaterThan(20);
    const [row] = await db.query<{ manage_key_hash: string; runner_email: string }>("select * from races");
    expect(row.manage_key_hash).toBe(hashKey(r.manageKey));
    expect(row.runner_email).toBe("matt@example.com");
    await expect(createRace(db, { runnerName: "Dana" })).resolves.toBeTruthy();
  });

  it("rejects a missing name or a bad email", async () => {
    await expectCode(newRace({ runnerName: "  " }), "invalid");
    await expectCode(newRace({ runnerEmail: "nope" }), "invalid");
  });
});

describe("the live map", () => {
  it("lists every mile in order with its songs and first names only", async () => {
    const r = await newRace();
    await add(r.id, 15, "Mr. Brightside", "Sarah Connor");
    await add(r.id, 15, "Juice");
    const reg = await getRegistry(db, r.id, BEFORE);
    expect(reg.runnerName).toBe("Matt Lebel");
    expect(reg.open).toBe(true);
    expect(reg.perMile).toBe(SONGS_PER_MILE);
    expect(reg.total).toBe(2);
    expect(reg.miles.map((m) => m.n)).toEqual(MILES.map((m) => m.n));
    const q = reg.miles.find((m) => m.n === 15)!;
    expect(q.songs.map((s) => [s.song.title, s.from])).toEqual([
      ["Mr. Brightside", "Sarah"],
      ["Juice", "Sam"],
    ]);
    expect(JSON.stringify(reg)).not.toContain("Connor");
    expect(JSON.stringify(reg)).not.toContain("edit_key");
  });

  it("404s for unknown links", async () => {
    await expectCode(getRegistry(db, "nope", BEFORE), "not_found");
  });
});

describe("addSong", () => {
  it("adds a song to a mile and returns a key for removing it later", async () => {
    const r = await newRace();
    const res = await addSong(db, r.id, { mile: 0, name: "Dana", song: song("Empire State of Mind", "JAY-Z", sid("a")) }, BEFORE);
    expect(res.mile).toBe(0);
    expect(res.editKey.length).toBeGreaterThan(20);
    const [row] = await db.query<{ uri: string; slot: number; name: string | null }>("select * from plants");
    expect(row).toMatchObject({ uri: `spotify:track:${sid("a")}`, slot: 0, name: "Dana" });
  });

  it(`fits ${SONGS_PER_MILE} songs on a mile, then says it's full`, async () => {
    const r = await newRace();
    for (let i = 0; i < SONGS_PER_MILE; i++) await add(r.id, 20, `Song ${i}`);
    await expectCode(add(r.id, 20, "One too many"), "mile_full");
    await expect(add(r.id, 21, "One too many")).resolves.toBeTruthy();
  });

  it("never overfills a mile when everyone drops at once", async () => {
    const r = await newRace();
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => add(r.id, 16, `Rush ${i}`)));
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(SONGS_PER_MILE);
    const rows = await db.query<{ slot: number }>("select slot from plants where mile = 16 order by slot");
    expect(rows.map((x) => x.slot)).toEqual([0, 1, 2]);
  });

  it("reuses a freed spot", async () => {
    const r = await newRace();
    const ids = [];
    for (let i = 0; i < SONGS_PER_MILE; i++) ids.push(await add(r.id, 8, `Song ${i}`));
    await deleteOwnSong(db, ids[1].id, ids[1].editKey, BEFORE);
    await expect(add(r.id, 8, "Back in")).resolves.toBeTruthy();
  });

  it("blocks the same song anywhere on the course, including other versions", async () => {
    const r = await newRace();
    await add(r.id, 15, "Mr. Brightside");
    await expectCode(add(r.id, 3, "Mr. Brightside - Remastered"), "song_taken");
  });

  it("refuses miles that don't exist, bad songs and a missing name", async () => {
    const r = await newRace();
    await expectCode(addSong(db, r.id, { mile: 1, song: song("Nameless") }, BEFORE), "invalid");
    await expectCode(add(r.id, 1, "Blank name", "  "), "invalid");
    await expectCode(add(r.id, 27, "Too far"), "invalid");
    await expectCode(add(r.id, -1, "Too early"), "invalid");
    await expectCode(addSong(db, r.id, { mile: 1.5, name: "Sam", song: song("Half") }, BEFORE), "invalid");
    await expectCode(addSong(db, r.id, { mile: 1, name: "Sam", song: { title: "", artist: "x" } }, BEFORE), "invalid");
    await expectCode(addSong(db, r.id, { mile: 1, name: "Sam", song: { ...song("x"), uri: "https://evil" } }, BEFORE), "invalid");
  });

  it("closes at 6am race morning", async () => {
    const r = await newRace();
    await expect(add(r.id, 1, "Just in time", undefined, JUST_BEFORE_CLOSE)).resolves.toBeTruthy();
    await expectCode(add(r.id, 2, "Too late", undefined, CLOSED), "closed");
    expect((await getRegistry(db, r.id, CLOSED)).open).toBe(false);
  });
});

describe("removing your own song", () => {
  it("reads and deletes with the key only", async () => {
    const r = await newRace();
    const s = await add(r.id, 9, "Juice", "Sarah");
    await expectCode(getOwnSong(db, s.id, "wrong", BEFORE), "forbidden");
    expect(await getOwnSong(db, s.id, s.editKey, BEFORE)).toMatchObject({ mile: 9, song: { title: "Juice" }, removable: true });
    await expectCode(deleteOwnSong(db, s.id, null, BEFORE), "forbidden");
    await deleteOwnSong(db, s.id, s.editKey, BEFORE);
    expect((await getRegistry(db, r.id, BEFORE)).total).toBe(0);
  });

  it("locks once adding closes", async () => {
    const r = await newRace();
    const s = await add(r.id, 9, "Juice");
    expect((await getOwnSong(db, s.id, s.editKey, CLOSED)).removable).toBe(false);
    await expectCode(deleteOwnSong(db, s.id, s.editKey, CLOSED), "closed");
  });
});

describe("runner view", () => {
  it("needs the private key", async () => {
    const r = await newRace();
    await expectCode(getManage(db, r.id, null, BEFORE), "forbidden");
    await expectCode(getManage(db, r.id, "wrong", BEFORE), "forbidden");
  });

  it("shows full names and totals", async () => {
    const r = await newRace();
    await add(r.id, 15, "Mr. Brightside", "Sarah Connor");
    await add(r.id, 15, "Juice", "Dana");
    await add(r.id, 20, "Toxic");
    const m = await getManage(db, r.id, r.manageKey, BEFORE);
    expect(m.total).toBe(3);
    expect(m.milesWithSongs).toBe(2);
    expect(m.miles.find((x) => x.n === 15)!.songs[0].from).toBe("Sarah Connor");
  });

  it("can remove any song", async () => {
    const r = await newRace();
    const s = await add(r.id, 15, "Mr. Brightside");
    await expectCode(removeSongAsRunner(db, r.id, "wrong", s.id), "forbidden");
    await removeSongAsRunner(db, r.id, r.manageKey, s.id);
    expect((await getManage(db, r.id, r.manageKey, BEFORE)).total).toBe(0);
  });
});

/** The first version's schema, to check that a live database upgrades in place. */
const OLD_SCHEMA = `
create table if not exists races (
  id text primary key,
  manage_key_hash text not null,
  runner_name text not null,
  runner_email text,
  race text not null,
  goal_sec integer not null check (goal_sec between 7200 and 28800),
  start_time timestamptz not null,
  revealed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists plants (
  id text primary key,
  race_id text not null references races(id) on delete cascade,
  moment text not null,
  is_runner boolean not null default false,
  name text not null,
  email text,
  edit_key_hash text,
  song_key text not null,
  spotify_id text,
  uri text,
  title text not null,
  artist text not null,
  art text,
  duration_sec integer,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plants_moment_unique unique (race_id, moment),
  constraint plants_song_unique unique (race_id, song_key)
);

create index if not exists plants_race_idx on plants (race_id);
`;

describe("upgrading a first-version database", () => {
  it("moves each planted moment onto its mile and keeps every song, name and note", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pp-upgrade-"));
    try {
      const old = new PGlite(dir);
      for (const stmt of OLD_SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) await old.query(stmt);
      await old.query(
        `insert into races (id, manage_key_hash, runner_name, race, goal_sec, start_time) values ('oldrace', $1, 'Matt Lebel', 'nyc-2026', 14400, '2026-11-01T14:10:00Z')`,
        [hashKey("k")],
      );
      const rows: [string, string, boolean, string | null, string | null][] = [
        ["start", "Empire State of Mind", true, "Matt Lebel", null],
        ["queensboro", "Mr. Brightside", false, "Sarah Connor", "The bridge is yours"],
        ["central-park", "Juice", false, "Dana", null],
        ["40k", "Toxic", false, "Eve", null],
        ["finish", "Till I Collapse", true, "Matt Lebel", null],
      ];
      for (const [i, [moment, title, isRunner, name, message]] of rows.entries()) {
        await old.query(
          `insert into plants (id, race_id, moment, is_runner, name, email, song_key, title, artist, message, created_at)
           values ($1, 'oldrace', $2, $3, $4, 'x@y.com', $5, $6, 'Someone', $7, now() + ($8 || ' seconds')::interval)`,
          [`p${i}`, moment, isRunner, name, songKey(song(title)), title, message, String(i)],
        );
      }
      await old.close();

      let upgraded = await createDb({ dataDir: dir });
      try {
        const m = await getManage(upgraded, "oldrace", "k", BEFORE);
        const at = (n: number) => m.miles.find((x) => x.n === n)!.songs.map((s) => s.song.title);
        expect(m.total).toBe(5);
        expect(at(0)).toEqual(["Empire State of Mind"]);
        expect(at(15)).toEqual(["Mr. Brightside"]);
        expect(at(24)).toEqual(["Juice", "Toxic"]);
        expect(at(25)).toEqual(["Till I Collapse"]);
        const q = m.miles.find((x) => x.n === 15)!.songs[0];
        expect(q).toMatchObject({ from: "Sarah Connor", message: "The bridge is yours", isRunner: false });

        // And it keeps working: new songs land in the next free spot, and running the upgrade again (every restart) changes nothing.
        await addSong(upgraded, "oldrace", { mile: 24, name: "Sam", song: song("New one") }, BEFORE);
        await upgraded.close();
        upgraded = await createDb({ dataDir: dir });
        const reg = await getRegistry(upgraded, "oldrace", BEFORE);
        expect(reg.total).toBe(6);
        expect(reg.miles.find((x) => x.n === 24)!.songs.map((s) => s.song.title)).toEqual(["Juice", "Toxic", "New one"]);
      } finally {
        await upgraded.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
