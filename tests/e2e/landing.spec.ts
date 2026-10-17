import { expect, test } from "./fixtures";

test("landing page explains the app and offers the three steps", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Playlist Pacer/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your race, sequenced like an album.");
  for (const step of ["Pick the course", "Load the playlist", "Set your goal"]) {
    await expect(page.getByRole("heading", { name: step })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Play the NYC demo" })).toBeVisible();
});

test("goal time edits are validated", async ({ page }) => {
  await page.goto("/");
  const goal = page.getByLabel("Goal time (h:mm:ss)");
  await goal.fill("not a time");
  await goal.blur();
  await expect(goal).toHaveClass(/border-coral/);
  await goal.fill("3:30:00");
  await goal.press("Enter");
  await expect(goal).toHaveValue("3:30:00");
  await page.getByRole("button", { name: "One minute slower" }).click();
  await expect(goal).toHaveValue("3:31:00");
});
