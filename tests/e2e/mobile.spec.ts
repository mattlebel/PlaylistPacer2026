import { createRace, expect, test, typeSong } from "./fixtures";

const overflow = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test("friends can plant from a phone", async ({ page, request }) => {
  const race = await createRace(request);
  await page.goto(`/r/${race.id}`);
  await expect(page.getByRole("heading", { name: "Help Matt run 26.2" })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(1);

  await page.locator("#moment-first-ave").getByRole("button", { name: "Plant a song here" }).tap();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Your name").fill("Jules");
  await dialog.getByLabel("Your email").fill("jules@x.com");
  await typeSong(dialog.locator("form"), "Dog Days Are Over", "Florence + The Machine");
  await dialog.getByRole("button", { name: "Plant my song" }).tap();
  await expect(page.getByRole("dialog", { name: "Planted!" })).toBeVisible();
});

test("home and setup fit a phone", async ({ page }) => {
  await page.goto("/");
  expect(await overflow(page)).toBeLessThanOrEqual(1);
  await page.goto("/new");
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});
