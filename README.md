# Playlist Pacer — your race, sequenced like an album

Plan your race playlist on the actual course. Drop in a course and a playlist, set a goal time,
and Playlist Pacer puts every song on the miles it covers: Side A for the first half, Side B for the
second. You see what's playing on the Queensboro Bridge, you can build the tempo from easy to fast, and it
lines up your closing track with the final stretch.

Built for road racers, NYRR regulars and the r/runnyc crowd.

## Features

- **Courses**: hand-traced NYC presets (NYC Marathon, Central Park full loop, Brooklyn Half) with
  landmark callouts, plus GPX upload and Strava import (OAuth or paste a link).
- **Playlists**: Spotify (PKCE, your own and collaborative playlists), Exportify/any CSV, or a 65-song sample mix.
- **Pacing models**: even, negative split, hill-smart (grade-adjusted), and **👻 ghost**, which replays the
  pace curve of a past activity (Strava, or a GPX with timestamps), scaled to your new goal.
- **Course chart**: an elevation profile with song bands, landmarks, the closing stretch and hover-to-scrub.
- **Closing track**: mark a finisher ★ and choose where it should start. It tells you if it's early or late, and
  offers a one-click fix (cut, move or swap) that keeps the BPM ramp intact where it can.
- **Sort slow → fast**: orders songs by tempo and places the closing track.
- **Real-runner math**: Spotify crossfade, time in the corral before the start mat, and official-distance
  snapping (your watch will say 26.5).
- **Preview course**: a fly-through with a runner dot that follows the course. Spotify tracks play through the official embed;
  sample/CSV songs play a synth beat at each song's BPM.
- **Share**: an album-sleeve PNG poster, a plain-text cue sheet, and "save this order" as a new Spotify playlist.

Plans live in `localStorage`. There's no database.

## Run it

```bash
npm install          # also copies the MapLibre worker into public/vendor
cp .env.example .env.local   # optional; the demo works without keys
npm run dev
```

Open **http://127.0.0.1:3000** (use 127.0.0.1, not localhost, for Spotify OAuth).

## Tests

```bash
npm test               # unit tests (Vitest): pacing math, song placement, closing-track fixes,
                       # GPX/CSV parsing, Spotify + Strava response handling, the BPM route
npm run test:coverage  # same, with a coverage report in coverage/
npm run test:e2e       # browser tests (Playwright): builds, serves on :3100, and drives the
                       # demo, imports, preview, share and branding flows on desktop + phone
```

First time on a new machine: `npx playwright install chromium`. If your environment already has a
Chromium build, point at it with `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome npm run test:e2e`.

GitHub Actions (`.github/workflows/ci.yml`) runs lint, type check, unit tests, build and the
browser tests on every push to `main` and every pull request. If browser tests fail, the
Playwright report is attached to the run.

The e2e suite runs without API keys, so it covers the "not configured" paths for Spotify and
Strava. The live OAuth flows still need a manual check with real accounts.

## Branding (Spotify + Strava)

Both APIs come with brand rules. What the app does:

- **Spotify**
  - The Spotify icon appears wherever Spotify playlist data is shown: playlist picker, tracklist,
    share poster.
  - Album art links to the track on Spotify, and the playlist links to the playlist ("Open Spotify").
  - Artwork is never cropped, overlaid or animated.
  - The icon is Spotify's official mark, in white or black only.
- **Strava**
  - The official **Connect with Strava** button starts OAuth.
  - **Powered by Strava** appears with the runs list, on the map and on the share poster whenever
    the course came from Strava.
  - Imported courses carry a **View on Strava** link.
  - The recording device gets credit ("Recorded on Garmin Forerunner 965"), as Strava now requires
    for Garmin and other device partners.

**One manual step:** Strava requires its official asset files, and their site can't be reached
from the build environment. Download them from <https://developers.strava.com/guidelines/> and save
two files into `public/brand/strava/`, named as listed in `public/brand/strava/README.md`. Until
then, plain-text stand-ins render.

Before a wider launch, re-read both guideline pages:
[Spotify](https://developer.spotify.com/documentation/design) and
[Strava](https://developers.strava.com/guidelines/). Spotify's quota-extension review checks
attribution closely.

## Deploy on Render

`render.yaml` is a Render Blueprint for one Node web service (free plan).

1. In Render: **New → Blueprint**, connect GitHub, and pick this repo. Render reads `render.yaml`.
2. When prompted, fill in the env vars. Any of them can be left blank and the demo still works:
   - `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`: your Spotify app's client ID
   - `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`: your Strava API app
   - `APP_URL`: only needed with a custom domain
3. After the first deploy, register your Render URL with each provider:
   - Spotify dashboard → Redirect URIs: `https://<your-app>.onrender.com/spotify/callback`
   - Strava API settings → Authorization Callback Domain: `<your-app>.onrender.com`
4. `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` gets baked in at build time, so trigger a redeploy if you change it.

Free instances sleep after ~15 minutes idle, so the first load after that takes a while to wake up.

## API reality check (as of late 2026)

- **Spotify**: development-mode apps need the owner to have Premium, are capped at 5 users, and can
  only read playlists the user owns or collaborates on. The `/tracks` endpoints were renamed to `/items`
  (both are handled). Audio features (BPM) are gone for new apps, so BPM comes from
  [ReccoBeats](https://reccobeats.com) on a best-effort basis, and you can also type it in or tap along.
  Exportify CSV covers anything else.
- **Strava**: Standard-tier API apps need a Strava subscription. They start at 1 athlete and can go up to 10 before review.
  Tokens are stored in an encrypted httpOnly cookie. Without API keys, pasting an activity or route link gives
  you a one-click "Download GPX from Strava" link to drop back in.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · MapLibre GL v6 (CARTO dark tiles, no key) · motion ·
dnd-kit · zustand · html-to-image.

Code map: `src/lib/pace.ts` (pacing models), `src/lib/plan.ts` (song → distance mapping, closing-track
fixes, auto-ramp), `src/lib/courses/` (presets), `src/app/api/strava/*` (OAuth + import), `src/components/*` (UI).
