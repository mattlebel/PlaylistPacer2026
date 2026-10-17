import "server-only";

/**
 * Minimal SQL interface over two drivers:
 *  - Postgres (DATABASE_URL) in production, via postgres.js
 *  - PGlite (embedded Postgres in WASM) for local dev and tests, so no setup is needed.
 */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

const SCHEMA = `
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

async function connectPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, {
    max: 5,
    idle_timeout: 30,
    // Render's managed Postgres requires TLS from outside its network; internal URLs don't.
    ssl: /render\.com|sslmode=require/.test(url) ? "require" : undefined,
    onnotice: () => {},
  });
  return {
    query: async <T,>(text: string, params: unknown[] = []) =>
      (await sql.unsafe(text, params as never[])) as unknown as T[],
    close: () => sql.end(),
  };
}

async function connectPglite(dataDir: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(dataDir);
  return {
    query: async <T,>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows,
    close: () => pg.close(),
  };
}

export async function createDb(opts: { url?: string; dataDir?: string } = {}): Promise<Db> {
  const db = opts.url ? await connectPostgres(opts.url) : await connectPglite(opts.dataDir ?? ".data/pglite");
  for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) await db.query(stmt);
  return db;
}

const g = globalThis as unknown as { __ppDb?: Promise<Db> };

/** Process-wide connection, created on first use. */
export function getDb(): Promise<Db> {
  const url = process.env.DATABASE_URL || undefined;
  // On a host like Render the local disk is wiped on every deploy, so an embedded database
  // there would silently lose every planted song. Require a real database in production
  // unless an embedded location was chosen on purpose (tests use PGLITE_DIR=memory://).
  if (!url && process.env.NODE_ENV === "production" && !process.env.PGLITE_DIR) {
    return Promise.reject(new Error("DATABASE_URL is not set. Add a Postgres database (see README → Deploy on Render)."));
  }
  g.__ppDb ??= createDb({ url, dataDir: process.env.PGLITE_DIR });
  return g.__ppDb;
}

/** Postgres unique-violation → which constraint fired. */
export function uniqueViolation(e: unknown): string | null {
  const err = e as { code?: string; message?: string; constraint_name?: string; constraint?: string };
  if (err?.code !== "23505") return null;
  return err.constraint_name ?? err.constraint ?? err.message?.match(/"([^"]+)"/)?.[1] ?? "unique";
}
