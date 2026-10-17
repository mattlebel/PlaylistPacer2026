import { expect, test as base, type APIRequestContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { CLOCK_FILE } from "./clock-path";

export const TIMES = {
  weeksBefore: "2026-10-20T12:00:00-04:00",
  // After planting closes (7:10am for a 9:10 wave), before the gun.
  raceMorning: "2026-11-01T07:30:00-05:00",
  afterGun: "2026-11-01T09:45:00-05:00",
};

/** Moves the server's clock (read per request via E2E_CLOCK_FILE). */
export function setClock(iso: string) {
  mkdirSync(dirname(CLOCK_FILE), { recursive: true });
  writeFileSync(CLOCK_FILE, iso);
}

/** Fails the test on any page error or console error (map tiles excepted). */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      setClock(TIMES.weeksBefore);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const text = m.text();
        if (/Failed to load resource|ERR_|cartocdn|tiles/i.test(text)) return;
        errors.push(text);
      });
      await use(errors);
      expect(errors, "console/page errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

const sid = (c: string) => c.repeat(22);
export const song = (title: string, artist: string, idChar?: string) => ({
  title,
  artist,
  ...(idChar ? { spotifyId: sid(idChar), uri: `spotify:track:${sid(idChar)}` } : {}),
});

export async function createRace(request: APIRequestContext, runnerName = "Matt Lebel") {
  const res = await request.post("/api/races", {
    data: {
      runnerName,
      goalSec: 4 * 3600,
      startTime: "09:10",
      songs: {
        start: song("Empire State of Mind", "JAY-Z, Alicia Keys", "a"),
        half: song("Titanium", "David Guetta, Sia", "b"),
        finish: song("'Till I Collapse", "Eminem", "c"),
      },
    },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; manageKey: string; shareUrl: string; manageUrl: string };
}

export async function plantViaApi(
  request: APIRequestContext,
  raceId: string,
  body: { moment: string; name: string; email: string; message?: string; song: ReturnType<typeof song> },
) {
  const res = await request.post(`/api/races/${raceId}/plants`, { data: body });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()) as { id: string; editKey: string; editUrl: string };
}

/** Types a song in (Spotify search isn't configured in tests). */
export async function typeSong(scope: Page | ReturnType<Page["locator"]>, title: string, artist: string) {
  await scope.getByLabel("Song title").first().fill(title);
  await scope.getByLabel("Artist").first().fill(artist);
  await scope.getByRole("button", { name: "Use this song" }).first().click();
}

export const managePath = (r: { id: string; manageKey: string }) => `/r/${r.id}/manage#key=${r.manageKey}`;
