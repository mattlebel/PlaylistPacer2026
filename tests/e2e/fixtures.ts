import { expect, test as base, type APIRequestContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { CLOCK_FILE } from "./clock-path";

export const TIMES = {
  weeksBefore: "2026-10-20T12:00:00-04:00",
  // Adding closes at 6am race morning.
  raceMorning: "2026-11-01T06:30:00-05:00",
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
  const res = await request.post("/api/races", { data: { runnerName } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; manageKey: string; shareUrl: string; manageUrl: string };
}

export async function addViaApi(request: APIRequestContext, raceId: string, body: { mile: number; name?: string; song: ReturnType<typeof song> }) {
  const res = await request.post(`/api/races/${raceId}/plants`, { data: body });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()) as { id: string; editKey: string };
}

/** Types a song in (Spotify search isn't configured in tests). */
export async function typeSong(scope: Page | ReturnType<Page["locator"]>, title: string, artist: string) {
  await scope.getByLabel("Song title").first().fill(title);
  await scope.getByLabel("Artist").first().fill(artist);
  await scope.getByRole("button", { name: "Use this song" }).first().click();
}

/** Opens a race's map and gets past the how-it-works popup. */
export async function openMap(page: Page, raceId: string) {
  await page.goto(`/r/${raceId}`);
  await page.getByRole("button", { name: "Let's go" }).click();
  await expect(marker(page, 0)).toBeVisible();
}

export const marker = (page: Page, mile: number) => page.locator(`.maplibregl-marker [data-drop-mile="${mile}"]`);

/** Drags the song you're holding onto a mile marker on the map, the way a person would. */
export async function dragSongTo(page: Page, mile: number) {
  const chip = page.getByRole("button", { name: /^Drag / });
  const target = marker(page, mile);
  await expect(target).toBeVisible();
  const a = (await chip.boundingBox())!;
  const b = (await target.boundingBox())!;
  const from = { x: a.x + 24, y: a.y + a.height / 2 };
  const to = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12);
  await page.mouse.up();
}

export const managePath = (r: { id: string; manageKey: string }) => `/r/${r.id}/manage#key=${r.manageKey}`;
