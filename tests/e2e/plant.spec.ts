import { createRace, expect, managePath, plantViaApi, song, test, typeSong } from "./fixtures";

test("a friend plants a song with a note", async ({ page, request }) => {
  const race = await createRace(request);
  await page.goto(`/r/${race.id}`);
  await expect(page.getByRole("heading", { name: "Help Matt run 26.2" })).toBeVisible();
  await expect(page.getByText("0 of 13 moments planted")).toBeVisible();
  // Runner's picks are visible so friends don't double up.
  await expect(page.getByText("Matt's pick").first()).toBeVisible();

  const bronx = page.locator("#moment-bronx");
  await expect(bronx.getByText(/mi 20\.0 · ~\d+:\d\d (AM|PM)/)).toBeVisible();
  await bronx.getByRole("button", { name: "Plant a song here" }).click();
  const dialog = page.getByRole("dialog", { name: "Plant a song at The Bronx" });
  await dialog.getByLabel("Your name").fill("Sarah Connor");
  await dialog.getByLabel("Your email").fill("sarah@example.com");
  await typeSong(dialog.locator("form"), "Mr. Brightside", "The Killers");
  await dialog.getByLabel("A note for Matt (optional)").fill("The Bronx is yours!");
  await expect(dialog.getByText("19/150")).toBeVisible();
  await dialog.getByRole("button", { name: "Plant my song" }).click();

  const done = page.getByRole("dialog", { name: "Planted!" });
  await expect(done.getByText(/Your song plays at The Bronx/)).toBeVisible();
  await expect(done.getByText(/\/p\/[a-z2-9]{12}#key=/)).toBeVisible();
  await done.getByRole("button", { name: "Back to the course" }).click();

  await expect(bronx.getByText("Planted by Sarah")).toBeVisible();
  await expect(page.getByText("1 of 13 moments planted")).toBeVisible();
  await expect(page.getByText("Mr. Brightside")).toHaveCount(0);
});

test("duplicate songs and taken moments are refused", async ({ page, request }) => {
  const race = await createRace(request);
  await plantViaApi(request, race.id, { moment: "queensboro", name: "Ana", email: "ana@x.com", song: song("Mr. Brightside", "The Killers") });

  await page.goto(`/r/${race.id}`);
  await expect(page.locator("#moment-queensboro").getByText("Planted by Ana")).toBeVisible();
  await expect(page.locator("#moment-queensboro").getByRole("button", { name: "Plant a song here" })).toHaveCount(0);

  await page.locator("#moment-5k").getByRole("button", { name: "Plant a song here" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Your name").fill("Dana");
  await dialog.getByLabel("Your email").fill("dana@x.com");
  await typeSong(dialog.locator("form"), "Mr. Brightside - Remastered", "The Killers");
  await dialog.getByRole("button", { name: "Plant my song" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(/already planted/);

  // The runner's own picks count too.
  await typeSong(dialog.locator("form"), "Titanium", "David Guetta");
  await dialog.getByRole("button", { name: "Plant my song" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(/already planted/);

  // Someone grabs this moment while the form is open.
  await plantViaApi(request, race.id, { moment: "5k", name: "Eve", email: "eve@x.com", song: song("Toxic", "Britney Spears") });
  await typeSong(dialog.locator("form"), "Juice", "Lizzo");
  await dialog.getByRole("button", { name: "Plant my song" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(/just claimed/);
  await page.keyboard.press("Escape");
  await expect(page.locator("#moment-5k").getByText("Planted by Eve")).toBeVisible();
});

test("the edit link changes or removes a song", async ({ page, request }) => {
  const race = await createRace(request);
  const p = await plantViaApi(request, race.id, { moment: "bronx", name: "Sarah", email: "s@x.com", message: "Go!", song: song("Juice", "Lizzo") });
  await page.goto(`/p/${p.id}#key=${p.editKey}`);
  await expect(page.getByRole("heading", { name: "The Bronx" })).toBeVisible();
  await expect(page.getByText("Juice")).toBeVisible();
  await page.getByLabel("Your note").fill("The Bronx is yours, Matt");
  await page.getByRole("button", { name: "Change your song" }).click();
  await typeSong(page, "Toxic", "Britney Spears");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await page.reload();
  await expect(page.getByText("Toxic")).toBeVisible();
  await expect(page.getByLabel("Your note")).toHaveValue("The Bronx is yours, Matt");

  await page.getByRole("button", { name: "Remove my song" }).click();
  await page.getByRole("button", { name: "Yes, remove my song" }).click();
  await expect(page.getByRole("heading", { name: "Removed" })).toBeVisible();
  await page.getByRole("link", { name: "Back to the course" }).click();
  await expect(page.locator("#moment-bronx").getByRole("button", { name: "Plant a song here" })).toBeVisible();
});

test("the runner sees who planted, but songs stay sealed", async ({ page, request }) => {
  const race = await createRace(request);
  await plantViaApi(request, race.id, { moment: "bronx", name: "Sarah Connor", email: "s@x.com", message: "Bronx is yours", song: song("Juice", "Lizzo") });
  await page.goto(managePath(race));
  await expect(page.getByRole("heading", { name: "1 of 13 moments planted" })).toBeVisible();
  await expect(page.getByText("Planted by Sarah Connor · sealed")).toBeVisible();
  await expect(page.getByText("Juice")).toHaveCount(0);
  await expect(page.getByText("Bronx is yours")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Race morning" })).toBeVisible();

  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Remove it" }).click();
  await expect(page.getByRole("heading", { name: "0 of 13 moments planted" })).toBeVisible();
});

test("link previews are personalized", async ({ request }) => {
  const race = await createRace(request, "Priya Patel");
  const html = await (await request.get(`/r/${race.id}`)).text();
  expect(html).toContain("<title>Help Priya run the NYC Marathon</title>");
  expect(html).toMatch(/og:description" content="Plant a song, with a short note, at a moment along Priya/);
  const img = await request.get(`/r/${race.id}/opengraph-image`);
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toBe("image/png");
});
