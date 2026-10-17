import { expect, test, typeSong } from "./fixtures";

test("home page explains the idea and starts setup", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Playlist Pacer/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your marathon, soundtracked by your people.");
  await expect(page.getByText("Queensboro Bridge").first()).toBeVisible();
  await page.getByRole("link", { name: "Set up my race" }).click();
  await expect(page.getByRole("heading", { name: "Set up your race" })).toBeVisible();
});

test("a runner sets up a race and lands on their private page", async ({ page }) => {
  await page.goto("/new");
  const create = page.getByRole("button", { name: "Create my share link" });
  await expect(create).toBeDisabled();

  await page.getByLabel("Your name").fill("Matt Lebel");
  await page.getByLabel("Goal time (h:mm:ss)").fill("3:45:00");
  await page.getByLabel("Goal time (h:mm:ss)").press("Enter");
  await page.getByLabel("Start wave").selectOption({ label: "Wave 2 · 9:35 AM" });
  // ETAs follow the wave and goal: the start moment shows the wave time.
  await expect(page.getByText("mile 0.0 · about 9:35 AM")).toBeVisible();

  await typeSong(page, "Empire State of Mind", "JAY-Z, Alicia Keys");
  await typeSong(page, "Titanium", "David Guetta, Sia");
  await typeSong(page, "'Till I Collapse", "Eminem");
  await create.click();

  await expect(page).toHaveURL(/\/r\/[a-z2-9]{10}\/manage\?new=1#key=/);
  await expect(page.getByRole("heading", { name: "Your race, Matt" })).toBeVisible();
  await expect(page.getByText("You're set up. Save this page.")).toBeVisible();
  await expect(page.getByText("Start 9:35 AM · goal 3:45")).toBeVisible();
  await expect(page.getByRole("heading", { name: "0 of 13 moments planted" })).toBeVisible();
  await expect(page.getByText("Your pick · Titanium · David Guetta, Sia")).toBeVisible();
  await expect(page.getByLabel("Share link")).toHaveValue(/\/r\/[a-z2-9]{10}$/);
});

test("the private page remembers the key on this device", async ({ page }) => {
  await page.goto("/new");
  await page.getByLabel("Your name").fill("Ana");
  await typeSong(page, "One", "A");
  await typeSong(page, "Two", "B");
  await typeSong(page, "Three", "C");
  await page.getByRole("button", { name: "Create my share link" }).click();
  await expect(page).toHaveURL(/manage/);
  const url = new URL(page.url());
  await page.goto(url.pathname); // no #key
  await expect(page.getByRole("heading", { name: "Your race, Ana" })).toBeVisible();
});

test("without the key the private page explains what to do", async ({ page }) => {
  await page.goto("/r/abcdefghjk/manage");
  await expect(page.getByRole("heading", { name: "This page needs your private link" })).toBeVisible();
});
