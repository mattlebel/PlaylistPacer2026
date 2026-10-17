# Playlist Pacer

**Your marathon, soundtracked by your people.** You pick your start, halfway and finish songs, then
share one link. Friends and family each claim a moment along the course, like a wedding registry,
and plant a song with a short note. You hear their songs on the course and read every note after
you finish.

Built for the **2026 NYC Marathon** (Sunday, November 1). Everything is set up for that one race for now.

## How it works

- **Runner:** go to `/new` and enter your name, goal time and start wave, and pick 3 songs.
  You get a **share link** (`/r/<id>`) and a **private link** (`/r/<id>/manage#key=…`).
- **Friends:** open the share link and see the course map and 16 moments with estimated times of day,
  marked open, claimed ("Planted by Sarah") or the runner's pick. Then:
  - Claim an open moment with just a name and email.
  - Pick a song (Spotify search, or type it in) and write a note of up to 150 characters.
  - Get an edit link (shown on screen, and emailed if email is set up).
- **Rules, enforced in the database:**
  - One song per moment.
  - No duplicate songs, including the runner's picks and other versions of the same song.
  - Two songs per email.
  - Planting closes two hours before the runner's wave.
- **Before race day:** you see who planted where, but songs and notes stay sealed.
- **Race morning (from 4am):**
  - Save a "Don't peek" Spotify playlist of every song in course order.
  - Use a cue list that says when each song is coming ("~11:35 · Queensboro Bridge · from Sarah · ▶ Play")
    without showing the title.
- **After the gun:** tap reveal (it also happens automatically 30 minutes after your goal time) to see every
  song and read every note.

The moments are in `src/lib/race.ts`. The NYC course comes from a real GPS track of the 2025 race,
scaled to the certified 42,195 m and stored as positions plus elevation only. Estimated times use
hill-adjusted pacing on that course. Race day runs on EST, since daylight saving ends at 2am that morning.

To add or refresh a course from any GPX (your own Strava or Garmin export works):

```bash
node scripts/import-course.mjs race.gpx src/lib/courses/<race>.json   # drops times, heart rate, etc.
```

`tests/unit/courses.test.ts` checks that every moment sits near the landmark it's named for.

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
   - `RESEND_API_KEY` and `EMAIL_FROM`: confirmation emails with edit links.
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
npm test               # unit tests (Vitest): claim rules, duplicates, time windows, reveal gating,
                       # pacing/ETAs, Spotify client + search; repo tests run on in-memory Postgres
npm run test:e2e       # browser tests (Playwright): setup, planting, conflicts, editing, race morning,
                       # reveal, link previews, phone layout
```

The browser tests use a fresh in-memory database and a fake clock (`E2E_CLOCK_FILE`), so they can
jump to race morning or past the finish. First time on a new machine, run `npx playwright install chromium`,
or point `PLAYWRIGHT_CHROMIUM_EXECUTABLE` at an existing Chromium.

GitHub Actions runs lint, type check, unit tests, build and the browser tests on every push and pull request.

## Spotify branding

Wherever Spotify data appears (search results, the runner's picks, revealed songs), the Spotify
icon is shown, artwork links back to the track, and artwork is never cropped, overlaid or animated.
Spotify's design guidelines require this. Re-read them before a wider launch:
[developer.spotify.com/documentation/design](https://developer.spotify.com/documentation/design).

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · Postgres (postgres.js; PGlite locally) · zod ·
MapLibre GL (CARTO tiles) · motion · Vitest · Playwright.

**Code map:**
- `src/lib/race.ts`: race config and moments.
- `src/lib/server/repo.ts`: every rule (claims, duplicates, time windows, reveal).
- `src/lib/server/db.ts`: schema and drivers.
- `src/app/api/*`: API routes.
- `src/components/*`: UI.

The earlier route-planner and Strava version of the app lives in git history.
