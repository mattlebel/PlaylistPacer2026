# Playlist Pacer

**Your marathon, soundtracked by your people.** Generate one link. Friends and family open a map of
your course, search for a song, and drag it onto a mile marker. Each mile holds 3 songs, and everyone
sees the map fill up live. You hear every song right there on race day.

Built for the **2026 NYC Marathon** (Sunday, November 1). Everything is set up for that one race for now.

## How it works

- **Runner:** go to `/new`, type your name, and get two links:
  - a **share link** (`/r/<id>`)
  - a **private link** (`/r/<id>/manage#key=…`)
- **Friends:** open the share link and see a quick "how it works" popup, then:
  - The map shows 27 markers (the start and miles 1–26). Each marker is a stack of up to 3 chips
    showing how full that mile is, and the big landmarks get a star.
  - Search for a song (or type it in), and it becomes a bubble you drag onto a marker. Pause while
    dragging and the map zooms in toward the bubble (up to two steps) so crowded miles spread out.
    Push against an edge to pan. After the drop it zooms back out to the whole course.
  - You can also pick a mile from a dropdown, or tap a mile and add a song from its popup. Both work
    without dragging.
  - The welcome popup asks for your first name; it shows on your songs as "from Sarah".
  - You can remove your own song from the same device.
- **Live:** the map refreshes every few seconds, so everyone sees what's been picked and which miles
  still have room.
- **Rules, enforced in the database:**
  - Up to 3 songs per mile (about a mile of music at a typical pace). Each song takes a numbered spot, so two people dropping at once can't
    overfill a mile.
  - No duplicate songs anywhere on the course, including other versions of the same song.
  - Adding closes at 6am on race morning.
- **Runner's private page:**
  - See every song with full names, and remove any of them.
  - Save all the songs to Spotify as one playlist, in course order.

Songs from the first version of the app (one song per named "moment") are moved onto the matching
mile automatically when the server starts. `tests/unit/repo.test.ts` covers that upgrade.

The miles and their landmark notes are in `src/lib/race.ts`. Each mile's popup also has longer notes
on that stretch of the course by coach Stuart Calderwood (`src/lib/courseNotes.ts`), credited in the
popup and in the page footer. The NYC course comes from a real GPS
track of the 2025 race, scaled to the certified 42,195 m and stored as positions plus elevation only.
On the map, markers sit beside the course, on whichever side covers the least of the route and the
other markers. On small screens they shrink to numbered dots with a ring that fills as songs are added.

To add or refresh a course from any GPX (your own Strava or Garmin export works):

```bash
node scripts/import-course.mjs race.gpx src/lib/courses/<race>.json   # drops times, heart rate, etc.
```

`tests/unit/courses.test.ts` checks that mile markers sit near the landmarks they're named for.

## Run it locally

```bash
npm install
cp .env.example .env.local   # optional
npm run dev
```

Open **http://127.0.0.1:3000**. Use 127.0.0.1, not localhost; Spotify login rejects "localhost".
Without `DATABASE_URL`, data goes into an embedded Postgres (PGlite) under `.data/`, so there's
nothing to install. Without Spotify keys, friends type songs in instead of searching.

## Deploy on Render

`render.yaml` is a Blueprint: one free web service plus a free Postgres database, already wired together.

1. In Render: **New → Blueprint**, connect GitHub, and pick this repo.
2. Fill in the prompted env vars. Any of these can be blank to start:
   - `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`: from your Spotify app's dashboard.
     They enable song search for friends and saving the race-day playlist.
   - `RESEND_API_KEY` and `EMAIL_FROM`: emails the runner their private link.
   - `APP_URL`: only needed for a custom domain.
3. In the Spotify dashboard, add the redirect URI `https://<your-app>.onrender.com/spotify/callback`.
4. The Spotify client ID is baked in at build time, so redeploy after changing it.

Things to know about the free plans:
- **The free database expires after 30 days.** That covers race day, but upgrade it if you want to keep
  the notes.
- **The free web service sleeps when idle.** The first visit after a nap takes 30–60 seconds. Friends
  open the share link at random times, so the $7/month Starter plan is worth it for the two weeks
  before the race.

## Tests

```bash
npm test               # unit tests (Vitest): per-mile limits, simultaneous drops, duplicates, closing
                       # time, upgrading old data, mile positions, Spotify client + search
npm run test:e2e       # browser tests (Playwright): setup, drag and drop, full miles, live updates,
                       # runner page, race morning, link previews, phone layout
```

The browser tests use a fresh in-memory database and a fake clock (`E2E_CLOCK_FILE`), so they can
jump to race morning. First time on a new machine, run `npx playwright install chromium`,
or point `PLAYWRIGHT_CHROMIUM_EXECUTABLE` at an existing Chromium.

GitHub Actions runs lint, type check, unit tests, build and the browser tests on every push and pull request.

## Spotify branding

Wherever Spotify data appears (search results, the song you're holding, the songs on each mile), the Spotify
icon is shown, artwork links back to the track, and artwork is never cropped, overlaid or animated.
Spotify's design guidelines require this. Re-read them before a wider launch:
[developer.spotify.com/documentation/design](https://developer.spotify.com/documentation/design).

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · Postgres (postgres.js; PGlite locally) · zod ·
MapLibre GL (CARTO tiles) · motion · Vitest · Playwright.

**Code map:**
- `src/lib/race.ts`: race config, miles and landmark notes.
- `src/lib/server/repo.ts`: every rule (per-mile limits, duplicates, closing time).
- `src/components/CourseMap.tsx`: the map and marker placement; `Registry.tsx` is the friend page with drag and drop.
- `src/lib/server/db.ts`: schema and drivers.
- `src/app/api/*`: API routes.
- `src/components/*`: UI.

The earlier route-planner and Strava version of the app lives in git history.
