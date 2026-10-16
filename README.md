# KICKDROP ⚡ time the drop, own the kick

Plan your race playlist on the actual course. Drop in a course and a playlist, set a goal time,
and KICKDROP paints every song onto the miles it covers. You see what's playing on the Queensboro
Bridge, you can ramp the BPM from chill to unhinged, and it lands your finishing song on the final stretch.

Built for road racers, NYRR regulars and the r/runnyc crowd.

## Features

- **Courses**: hand-traced NYC presets (NYC Marathon, Central Park full loop, Brooklyn Half) with
  landmark callouts, plus GPX upload and Strava import (OAuth or paste a link).
- **Playlists**: Spotify (PKCE, your own and collaborative playlists), Exportify/any CSV, or a 65-song sample mix.
- **Pacing models**: even, negative split, hill-smart (grade-adjusted), and **👻 ghost**, which replays the
  pace curve of a past activity (Strava, or a GPX with timestamps), scaled to your new goal.
- **The strip**: an elevation profile with song bands, landmarks, a kick zone and hover-to-scrub.
- **Kick lander**: mark a finisher ⚡ and choose where it should drop. It tells you if it's early or late, and
  offers a one-click fix (cut, move or swap) that keeps the BPM ramp intact where it can.
- **Auto-ramp**: sorts songs slow → fast and places the kick.
- **Real-runner math**: Spotify crossfade, time in the corral before the start mat, and official-distance
  snapping (your watch will say 26.5).
- **Preview course**: a fly-through with a runner dot that follows the course. Spotify tracks play through the official embed;
  sample/CSV songs play a synth beat at each song's BPM.
- **Share**: a story-sized PNG poster, a plain-text cue sheet, and "save this order" as a new Spotify playlist.

Plans live in `localStorage`. There's no database.

## Run it

```bash
npm install          # also copies the MapLibre worker into public/vendor
cp .env.example .env.local   # optional; the demo works without keys
npm run dev
```

Open **http://127.0.0.1:3000** (use 127.0.0.1, not localhost, for Spotify OAuth).

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

Code map: `src/lib/pace.ts` (pacing models), `src/lib/plan.ts` (song → distance mapping, kick
fixes, auto-ramp), `src/lib/courses/` (presets), `src/app/api/strava/*` (OAuth + import), `src/components/*` (UI).
