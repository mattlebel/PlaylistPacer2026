import path from "node:path";
import { expect, loadDemo, test } from "./fixtures";

const fixture = (name: string) => path.join(__dirname, "..", "fixtures", name);

test("a timed GPX upload snaps to 5K and turns on ghost pacing", async ({ page }) => {
  await loadDemo(page);
  await page.getByRole("button", { name: /course NYC Marathon/ }).click();
  const dialog = page.getByRole("dialog", { name: "Pick your course" });
  await dialog.getByRole("tab", { name: "Upload GPX" }).click();
  await dialog.locator('input[type="file"]').setInputFiles(fixture("central-park-5k.gpx"));
  await expect(page.getByRole("status").filter({ hasText: "Ghost pacing on" })).toBeVisible();
  await expect(page.getByRole("button", { name: /course Central Park 5K tune-up/ })).toBeVisible();
  await expect(page.getByText("3.11 mi", { exact: false }).first()).toBeVisible();
  const ghost = page.getByRole("radiogroup", { name: "pacing strategy" }).getByRole("radio", { name: "Ghost" });
  await expect(ghost).toHaveAttribute("aria-checked", "true");
  // The recorded 25:00 becomes the starting goal.
  await expect(page.getByLabel("Goal time (h:mm:ss)")).toHaveValue("0:25:00");
});

test("an Exportify CSV replaces the playlist", async ({ page }) => {
  await loadDemo(page);
  await page.getByRole("button", { name: /playlist/ }).click();
  const dialog = page.getByRole("dialog", { name: "Add your playlist" });
  await dialog.getByRole("tab", { name: "CSV import" }).click();
  await dialog.locator('input[type="file"]').setInputFiles(fixture("race-mix.csv"));
  await expect(page.getByText("8 tracks · drag to reorder")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "8 songs loaded" })).toBeVisible();
  await expect(page.getByTestId("running-time")).toContainText("short");
});

test("without API keys, a pasted Strava link offers the GPX download", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sequence my race" }).click();
  const dialog = page.getByRole("dialog", { name: "Pick your course" });
  await dialog.getByRole("tab", { name: "Strava" }).click();
  await dialog.getByLabel("Paste a Strava activity or route link").fill("https://www.strava.com/activities/12345678901");
  await expect(dialog.getByRole("link", { name: "Download GPX from Strava" })).toHaveAttribute(
    "href",
    "https://www.strava.com/activities/12345678901/export_gpx",
  );
  await expect(dialog.getByText(/isn't set up on this server/)).toBeVisible();
});

test("without a Spotify client id, the Spotify tab points to CSV", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Load the playlist/ }).click();
  await expect(page.getByRole("dialog", { name: "Add your playlist" }).getByText(/Spotify isn't wired up/)).toBeVisible();
});
