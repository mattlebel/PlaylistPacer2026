import { createRace, dragSongTo, expect, marker, openMap, test, typeSong, welcome } from "./fixtures";

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
  // "Add another" in the message takes you straight back to the search box.
  await page.getByRole("status").getByRole("button", { name: "＋ Add another" }).click();
  await expect(page.getByRole("combobox", { name: "Search for a song" })).toBeFocused();
  await expect(page.getByRole("combobox", { name: "Search for a song" })).toBeInViewport();

  // Scrolled down to the map, a search bar at the bottom opens search over the whole screen.
  await page.getByRole("status").waitFor({ state: "detached", timeout: 8_000 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole("button", { name: "Add another song" }).click();
  const search = page.getByRole("dialog", { name: "Add another song" });
  await expect(search.getByRole("combobox", { name: "Search for a song" })).toBeFocused();
  await typeSong(search, "Juice", "Lizzo");
  await expect(search).toBeHidden();
  await expect(page.getByRole("button", { name: "Drag Juice onto a mile" })).toBeInViewport();
});

test("on a phone the intro is one short line", async ({ page, request }) => {
  const race = await createRace(request);
  await openMap(page, race.id);
  await expect(page.getByText("Search for a song, drag it onto a mile, and Matt hears it right there on race day.")).toBeVisible();
  await expect(page.getByText(/each mile holds 3/)).toBeHidden();
  await expect(page.getByText(/Matt starts at 9:10 AM/)).toBeHidden();
});

for (const ui of ["dock", "bar"]) {
  test(`?add=${ui}: the "Add a song" button scrolls back to the search box`, async ({ page, request }) => {
    const race = await createRace(request);
    await page.goto(`/r/${race.id}?add=${ui}`);
    await welcome(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.getByRole("button", { name: /Add a song/ }).click();
    await expect(page.getByRole("combobox", { name: "Search for a song" })).toBeInViewport();
    await expect(page.getByRole("combobox", { name: "Search for a song" })).toBeFocused();
  });
}

test("home and setup fit a phone", async ({ page }) => {
  await page.goto("/");
  expect(await overflow(page)).toBeLessThanOrEqual(1);
  await page.goto("/new");
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});
