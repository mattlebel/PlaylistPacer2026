import { addViaApi, createRace, dragSongTo, expect, marker, openMap, song, test, typeSong } from "./fixtures";

test("a friend drags a song onto a mile", async ({ page, request }) => {
  const race = await createRace(request);
  await page.goto(`/r/${race.id}`);
  await expect(page.getByRole("heading", { name: "Help Matt soundtrack 26.2" })).toBeVisible();
  const intro = page.getByRole("dialog", { name: "How it works" });
  await expect(intro.getByText("Drag it onto a mile")).toBeVisible();
  await intro.getByRole("button", { name: "Let's go" }).click();
  await expect(marker(page, 15)).toHaveAccessibleName("Mile 15, Queensboro Bridge: 0 of 4 songs");

  await page.getByLabel("Your name (optional)").fill("Dana Scully");
  await typeSong(page, "Mr. Brightside", "The Killers");
  await expect(page.getByRole("button", { name: "Drag Mr. Brightside onto a mile" })).toBeVisible();
  await dragSongTo(page, 15);

  await expect(page.getByRole("status")).toHaveText("Added to Mile 15 · Queensboro Bridge");
  await expect(marker(page, 15)).toHaveAccessibleName("Mile 15, Queensboro Bridge: 1 of 4 songs");
  await expect(page.getByText("1 song on the course")).toBeVisible();

  // The mile's popup shows the song, first name only, and lets you take yours back.
  await marker(page, 15).click();
  const sheet = page.getByRole("dialog", { name: "Mile 15 · Queensboro Bridge" });
  await expect(sheet.getByText("The Killers · from Dana")).toBeVisible();
  await expect(sheet.getByText("Open spot")).toHaveCount(3);
  await sheet.getByRole("button", { name: "Remove mine" }).click();
  await expect(page.getByRole("status")).toHaveText("Removed your song.");
  await expect(sheet.getByText("Open spot")).toHaveCount(4);

  // The intro only shows once.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Add a song" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "How it works" })).toHaveCount(0);
});

test("you can pick a mile without dragging", async ({ page, request }) => {
  const race = await createRace(request);
  await openMap(page, race.id);
  await typeSong(page, "Juice", "Lizzo");
  await page.getByLabel("Or choose a mile").selectOption({ label: "Mile 8 · Barclays Center & Lafayette Ave (4 left)" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Added to Mile 8 · Barclays Center & Lafayette Ave");

  // Or tap a mile and add straight from its popup.
  await page.getByRole("list", { name: "Miles along the course" }).getByRole("button", { name: /^Mile 20, The Bronx/ }).click();
  const sheet = page.getByRole("dialog", { name: "Mile 20 · The Bronx" });
  await typeSong(sheet, "Can't Hold Us", "Macklemore");
  await expect(page.getByRole("status")).toHaveText("Added to Mile 20 · The Bronx");
  await expect(sheet).toHaveCount(0);
  await expect(page.getByText("2 songs on the course")).toBeVisible();
});

test("full miles and repeat songs are refused", async ({ page, request }) => {
  const race = await createRace(request);
  for (const t of ["One", "Two", "Three", "Four"]) await addViaApi(request, race.id, { mile: 20, song: song(t, "X") });
  await addViaApi(request, race.id, { mile: 15, name: "Ana", song: song("Mr. Brightside", "The Killers") });
  await openMap(page, race.id);
  await expect(marker(page, 20)).toHaveAccessibleName("Mile 20, The Bronx: 4 of 4 songs");

  await typeSong(page, "Toxic", "Britney Spears");
  await expect(page.getByRole("option", { name: "Mile 20 · The Bronx (full)" })).toBeDisabled();
  await dragSongTo(page, 20);
  await expect(page.getByRole("status")).toHaveText("Mile 20 is full. Try a mile nearby!");
  // Still holding it: drop it somewhere else.
  await dragSongTo(page, 21);
  await expect(page.getByRole("status")).toHaveText("Added to Mile 21 · Madison Avenue Bridge");

  await typeSong(page, "Mr. Brightside - Remastered", "The Killers");
  await dragSongTo(page, 3);
  await expect(page.getByRole("status")).toHaveText("That song is already on the course. Pick a different one!");
});

test("the map updates live as other people add songs", async ({ page, request }) => {
  const race = await createRace(request);
  await openMap(page, race.id);
  await expect(marker(page, 26)).toHaveAccessibleName("Mile 26, The finish: 0 of 4 songs");
  await addViaApi(request, race.id, { mile: 26, name: "Mom", song: song("Don't Stop Me Now", "Queen") });
  await expect(marker(page, 26)).toHaveAccessibleName("Mile 26, The finish: 1 of 4 songs", { timeout: 15_000 });
  await expect(page.getByText("from Mom")).toBeVisible();
});

test("link previews are personalized", async ({ request }) => {
  const race = await createRace(request, "Priya Patel");
  await addViaApi(request, race.id, { mile: 1, song: song("Run the World", "Beyoncé") });
  const html = await (await request.get(`/r/${race.id}`)).text();
  expect(html).toContain("<title>Help Priya soundtrack the NYC Marathon</title>");
  expect(html).toMatch(/og:description" content="Drop a song on a mile of Priya&#x27;s course[^"]*1 song so far, 27 of 27 miles with room/);
  const img = await request.get(`/r/${race.id}/opengraph-image`);
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toBe("image/png");
});
