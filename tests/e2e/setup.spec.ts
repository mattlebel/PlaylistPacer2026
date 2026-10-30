import { expect, test } from "./fixtures";

test("home page explains the idea and starts setup", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Playlist Pacer/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your marathon, soundtracked by your people.");
  await expect(page.getByText("Queensboro Bridge").first()).toBeVisible();
  await page.getByRole("link", { name: "Generate my link" }).click();
  await expect(page.getByRole("heading", { name: "Get your link" })).toBeVisible();
});

test("a runner generates a link and lands on their private page", async ({ page }) => {
  await page.goto("/new");
  const go = page.getByRole("button", { name: "Generate my link" });
  await expect(go).toBeDisabled();
  await page.getByLabel("Your name").fill("Matt Lebel");
  // Wave 1 at 11:00 a mile is the default; the finish estimate follows the pace.
  await expect(page.getByLabel("Start wave")).toHaveValue("09:10");
  await expect(page.getByLabel("Pace per mile")).toHaveValue("11:00");
  await expect(page.getByText("Finish around 1:58 PM")).toBeVisible();
  await page.getByLabel("Pace per mile").fill("4:00");
  await expect(page.getByText("Use minutes:seconds, like 11:00")).toBeVisible();
  await expect(go).toBeDisabled();
  await page.getByLabel("Pace per mile").fill("11:00");
  await page.getByLabel("Bib number (optional)").fill("13302");
  await go.click();

  await expect(page).toHaveURL(/\/r\/[a-z2-9]{10}\/manage\?new=1#key=/);
  await expect(page.getByRole("heading", { name: "Your race, Matt" })).toBeVisible();
  await expect(page.getByText("You're set up. Save this page.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "0 songs on 0 miles" })).toBeVisible();
  await expect(page.getByText("Wave 1 · 9:10 AM · 11:00/mile · bib 13302 · finish ~1:58 PM")).toBeVisible();
  await expect(page.getByLabel("Share link")).toHaveValue(/\/r\/[a-z2-9]{10}$/);
});

test("the private page remembers the key on this device", async ({ page }) => {
  await page.goto("/new");
  await page.getByLabel("Your name").fill("Ana");
  await page.getByRole("button", { name: "Generate my link" }).click();
  await expect(page).toHaveURL(/manage/);
  const url = new URL(page.url());
  await page.goto(url.pathname); // no #key
  await expect(page.getByRole("heading", { name: "Your race, Ana" })).toBeVisible();
});

test("without the key the private page explains what to do", async ({ page }) => {
  await page.goto("/r/abcdefghjk/manage");
  await expect(page.getByRole("heading", { name: "This page needs your private link" })).toBeVisible();
});
