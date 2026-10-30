import { createRace, dragSongTo, expect, marker, openMap, test, typeSong } from "./fixtures";

const overflow = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test("friends can drag a song onto the map from a phone", async ({ page, request }) => {
  const race = await createRace(request);
  await openMap(page, race.id);
  await expect(page.getByRole("heading", { name: "Help Matt soundtrack 26.2" })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(1);

  await typeSong(page, "Dog Days Are Over", "Florence + The Machine");
  // Picking a song scrolls the map into view, with the song held in a tray at the bottom.
  await expect(marker(page, 16)).toBeInViewport();
  await dragSongTo(page, 16);
  await expect(page.getByRole("status")).toContainText("Added to Mile 16 · First Avenue");
  await expect(marker(page, 16)).toHaveAccessibleName("Mile 16, First Avenue: 1 of 3 songs");
});

test("home and setup fit a phone", async ({ page }) => {
  await page.goto("/");
  expect(await overflow(page)).toBeLessThanOrEqual(1);
  await page.goto("/new");
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});
