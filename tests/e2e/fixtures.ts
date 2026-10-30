import { expect, test as base, type APIRequestContext, type Locator, type Page } from "@playwright/test";
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

/** Songs the stand-in Spotify search knows about (tests run without real Spotify keys). */
const CATALOG: [string, string][] = [
  ["Mr. Brightside", "The Killers"],
  ["Mr. Brightside - Remastered", "The Killers"],
  ["Juice", "Lizzo"],
  ["Can't Hold Us", "Macklemore"],
  ["Toxic", "Britney Spears"],
  ["Dog Days Are Over", "Florence + The Machine"],
  ["Eye of the Tiger", "Survivor"],
  ["Sprawl II (Mountains Beyond Mountains)", "Arcade Fire"],
];
const fakeId = (s: string) => (s.replace(/[^A-Za-z0-9]/g, "") + "x".repeat(22)).slice(0, 22);

/** Answers the app's song search the way Spotify would, so the browser sees "Search by Spotify" results. */
export async function fakeSpotifySearch(page: Page) {
  await page.route("**/api/songs/search**", (route) => {
    const q = new URL(route.request().url()).searchParams.get("q")?.trim().toLowerCase() ?? "";
    const hits = q ? CATALOG.filter(([t, a]) => `${t} ${a}`.toLowerCase().includes(q)) : [];
    const results = (hits.length || !q ? hits : [[q.replace(/\b\w/g, (c) => c.toUpperCase()), "Someone"] as [string, string]]).map(([title, artist]) => {
      const id = fakeId(title);
      return { title, artist, spotifyId: id, uri: `spotify:track:${id}` };
    });
    return route.fulfill({ json: { configured: true, results } });
  });
}

/** Fails the test on any page error or console error (map tiles excepted). */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      setClock(TIMES.weeksBefore);
      await fakeSpotifySearch(page);
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

export async function createRace(request: APIRequestContext, runnerName = "Matt Lebel", extra: { bib?: string; startTime?: string; paceSec?: number } = {}) {
  const res = await request.post("/api/races", { data: { runnerName, ...extra } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; manageKey: string; shareUrl: string; manageUrl: string };
}

export async function addViaApi(request: APIRequestContext, raceId: string, body: { mile: number; name?: string; song: ReturnType<typeof song> }) {
  const res = await request.post(`/api/races/${raceId}/plants`, { data: { name: "Sam", ...body } });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()) as { id: string; editKey: string };
}

/** Searches for a song and picks the result with exactly this title and artist. */
export async function typeSong(scope: Page | Locator, title: string, artist: string) {
  const page = "page" in scope && typeof scope.page === "function" ? scope.page() : (scope as Page);
  await scope.getByRole("combobox", { name: "Search for a song" }).first().fill(title);
  await scope
    .getByRole("listbox", { name: "Search results" })
    .getByRole("option")
    .filter({ has: page.getByText(title, { exact: true }) })
    .filter({ has: page.getByText(artist, { exact: true }) })
    .first()
    .click();
}

/** Answers the welcome popup: your name, then "Let's go". */
export async function welcome(page: Page, name = "Dana") {
  const intro = page.getByRole("dialog", { name: "How it works" });
  await intro.getByLabel("First, what's your name?").fill(name);
  await intro.getByRole("button", { name: "Let's go" }).click();
  await expect(intro).toHaveCount(0);
}

/** Opens a race's map and gets past the welcome popup. */
export async function openMap(page: Page, raceId: string, name = "Dana") {
  await page.goto(`/r/${raceId}`);
  await welcome(page, name);
  await expect(marker(page, 0)).toBeVisible();
}

export const marker = (page: Page, mile: number) => page.locator(`.maplibregl-marker [data-drop-mile="${mile}"]`);

/** Drags the song you're holding onto a mile marker on the map, the way a person would. */
export async function dragSongTo(page: Page, mile: number) {
  const chip = page.getByRole("button", { name: /^Drag / });
  const target = marker(page, mile);
  await expect(target).toBeVisible();
  // Picking a song on a phone smooth-scrolls to the map; aim once the page has stopped moving.
  let last = -1;
  await expect
    .poll(async () => {
      const y = await page.evaluate(() => window.scrollY);
      const settled = y === last;
      last = y;
      return settled;
    }, { intervals: [150] })
    .toBe(true);
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
