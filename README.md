# Playlist Pacer

**Your marathon, soundtracked by your people.** Generate one link. Friends and family open a map of
your course, search for a song, and drag it onto a mile marker. Each mile holds 3 songs, and everyone
sees the map fill up live. You hear every song right there on race day.

Built for the **2026 NYC Marathon** (Sunday, November 1). Everything is set up for that one race for now.

## How it works

- **Runner:** go to `/new`, type your name, and get two links:
  - a **share link** (`/r/<id>`)
  - a **private link** (`/r/<id>/manage#key=…`)
- **Friends:** open the share link and see a "how it works" popup (each step has a small looping SVG
  animation, `src/components/HowItWorks.tsx`), then:
  - The map shows 27 markers: START (green flag), miles 1–25, and FINISH (red flag, mile 26 to the
    line). Each marker is a stack of up to 3 chips
    showing how full that mile is, and the big landmarks get a star.
  - Type in one search box and pick a suggestion, and it becomes a bubble you drag onto a marker.
    Suggestions come from Spotify when it's set up (searches are cached on the server for a few hours),
    or otherwise from a built-in list of about 375 popular running songs (`src/lib/popularSongs.ts`). Pause while
    dragging and the map zooms in toward the bubble (up to two steps) so crowded miles spread out.
    Push against an edge to pan. After the drop it zooms back out to the whole course.
  - You can also pick a mile from a dropdown, or tap a mile and add a song from its popup. Both work
    without dragging.
  - Resting on a search result for half a second (or tapping ▶) opens Spotify's preview player for it.
  - After adding, the panel says "Add another song" with your running count, suggests miles that
    still need a song, and the cursor goes back to the search box. A progress bar shows how many of
    the 81 spots are filled. On phones, "＋ Add another" in the message (or a floating button)
    brings the search box back.
  - The welcome popup asks for your first name once; it shows on your songs as "from Sarah". To
    change it, reopen "How it works".
  - You can remove your own song from the same device.
- **Live:** the map refreshes every few seconds, so everyone sees what's been picked and which miles
  still have room. A live feed beside the map (a single line under the title on phones) shows the latest songs ("Sarah added “Juice” to mile 7 ·
  2 min ago"), and each new song sends a glowing pulse along the course line to its mile, which
  then flashes.
- **Race details:** the runner's wave start, pace per mile (default 11:00) and bib. Friends see when
  the runner passes each mile ("around 11:55 AM"), the expected finish, a "Track live" button
  (liveresults.nyrr.org, searched by bib), and a countdown to when adding closes.
- **In each mile's popup:** songs already there (with a Spotify preview player), when the runner
  passes, the coach's notes, and a search box to add one. Search results grey out songs that are
  already on the course.
- **Sounds:** a quiet cowbell "clonk-clonk" and a short crowd cheer after adding a song, a single
  cowbell on "Let's go", and a cheer when the runner saves the playlist. They're generated in the
  browser (`src/lib/sounds.ts`, no audio files), respect the iPhone silent switch, don't interrupt
  music, and "Sound on/off" next to "How it works" turns them off (remembered per device).
- **After adding:** the song flies from your finger into its marker (with a short buzz on Android
  phones), and the message has **Share** (a ready-made message with the link) and **Undo** (takes it
  back off the course and puts it back in your hand).
- **Rules, enforced in the database:**
  - Up to 3 songs per mile (about a mile of music at a typical pace). Each song takes a numbered spot, so two people dropping at once can't
    overfill a mile.
  - No duplicate songs anywhere on the course, including other versions of the same song.
  - Adding closes at 6am on race morning.
- **Runner's private page:**
  - See every song with full names, and remove any of them.
  - Edit wave, pace and bib; see the estimated time at every mile.
  - Download every song as a spreadsheet (CSV), as a backup.
  - Save all the songs to Spotify as one playlist, in course order. Saving again updates the same
    playlist, so the copy downloaded on your phone just refreshes. Songs picked from the built-in
    list are matched on Spotify by title and artist; any it can't find are listed.

Songs from the first version of the app (one song per named "moment") are moved onto the matching
mile automatically when the server starts. `tests/unit/repo.test.ts` covers that upgrade.

The miles and their landmark notes are in `src/lib/race.ts`. Each mile's popup also has longer notes
on that stretch of the course by coach Stuart Calderwood (`src/lib/courseNotes.ts`), credited in the
popup and in the page footer. The NYC course comes from a real GPS
track of the 2025 race, scaled to the certified 42,195 m and stored as positions plus elevation only.
**The street map ships with the app.** `public/basemap` holds the map for the course area (552 small
tiles, zooms 9–14, about 11 MB) from [OpenFreeMap](https://openfreemap.org) (OpenStreetMap data),
trimmed to water, parks, streets and airports and drawn in muted grays by `src/lib/basemapStyle.ts`.
No labels, so no fonts or icons: the map makes no requests to anyone else, and panning stays around
that area. Phones keep the map files for a week (see `headers` in `next.config.ts`), so repeat visits
load the map instantly and use no data. To refresh it, run the **Update basemap** workflow in GitHub Actions (it runs
`scripts/fetch-basemap.mjs` and commits the result).

If those files are missing, the map falls back to CARTO's hosted Dark Matter, and failing that to
the five boroughs' outlines (`src/lib/courses/nyc-boroughs.json`, from NYC Department of City
Planning) on grayscale land and water with borough names.

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
nothing to install. Without Spotify keys, the search box suggests from the built-in song list instead.

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
