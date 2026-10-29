import { expect, test } from "./fixtures";

test("home page explains the idea and starts setup", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Playlist Pacer/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your marathon, soundtracked by your people.");
  await expect(page.getByText("Queensboro Bridge").first()).toBeVisible();
  await page.getByRole("link", { name: "Generate my link" }).click();
  await expect(page.getByRole("heading", { name: "Get your link" })).toBeVisible();
});

test("a runner generates a link with just a name and lands on their private page", async ({ page }) => {
  await page.goto("/new");
  const go = page.getByRole("button", { name: "Generate my link" });
  await expect(go).toBeDisabled();
  await page.getByLabel("Your name").fill("Matt Lebel");
  await go.click();

  await expect(page).toHaveURL(/\/r\/[a-z2-9]{10}\/manage\?new=1#key=/);
  await expect(page.getByRole("heading", { name: "Your race, Matt" })).toBeVisible();
  await expect(page.getByText("You're set up. Save this page.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "0 songs on 0 miles" })).toBeVisible();
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
