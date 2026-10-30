import { addViaApi, createRace, dragSongTo, expect, marker, openMap, song, test, typeSong } from "./fixtures";

test("a friend drags a song onto a mile", async ({ page, request }) => {
  const race = await createRace(request);
  await page.goto(`/r/${race.id}`);
  await expect(page.getByRole("heading", { name: "Help Matt soundtrack 26.2" })).toBeVisible();
  const intro = page.getByRole("dialog", { name: "How it works" });
  await expect(intro.getByText("Drag it onto a mile")).toBeVisible();
  // The welcome popup asks who you are before you start.
  await expect(intro.getByRole("button", { name: "Let's go" })).toBeDisabled();
  await intro.getByLabel("First, what's your name?").fill("Dana Scully");
  await intro.getByRole("button", { name: "Let's go" }).click();
  await expect(marker(page, 15)).toHaveAccessibleName("Mile 15, Queensboro Bridge: 0 of 3 songs");
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("Dana Scully");

  await typeSong(page, "Mr. Brightside", "The Killers");
  await expect(page.getByRole("button", { name: "Drag Mr. Brightside onto a mile" })).toBeVisible();
  await dragSongTo(page, 15);

  await expect(page.getByRole("status")).toHaveText("Added to Mile 15 · Queensboro Bridge");
  await expect(marker(page, 15)).toHaveAccessibleName("Mile 15, Queensboro Bridge: 1 of 3 songs");
  await expect(page.getByText("1 song on the course")).toBeVisible();

  // The mile's popup shows the song, first name only, and lets you take yours back.
  await marker(page, 15).click();
  const sheet = page.getByRole("dialog", { name: "Mile 15 · Queensboro Bridge" });
  await expect(sheet.getByText("The Killers · from Dana")).toBeVisible();
  await expect(sheet.getByText("Open spot")).toHaveCount(2);
  // The coach's notes on this stretch, credited.
  const notes = sheet.getByRole("region", { name: "Coach's notes" });
  await expect(notes.getByText(/Silvercup Studios/)).toBeVisible();
  await expect(notes.getByText(/toughest hill on the course/)).toHaveCount(0);
  await notes.getByRole("button", { name: "Read more" }).click();
  await expect(notes.getByText(/toughest hill on the course/)).toBeVisible();
  await expect(notes.getByText("Course notes by coach Stuart Calderwood")).toBeVisible();
  await sheet.getByRole("button", { name: "Remove mine" }).click();
  await expect(page.getByRole("status")).toHaveText("Removed your song.");
  await expect(sheet.getByText("Open spot")).toHaveCount(3);

  // The intro only shows once.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Add a song" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "How it works" })).toHaveCount(0);
});

test("one search box suggests songs as you type", async ({ page, request }) => {
  const race = await createRace(request);
  await openMap(page, race.id);
  const box = page.getByRole("combobox", { name: "Search for a song" });
  await box.fill("brights");
  await expect(page.getByRole("option").first()).toContainText("Mr. Brightside");
  await expect(page.getByRole("option").first()).toContainText("The Killers");
  // Arrow keys and Enter work too.
  await box.fill("eye of the");
  await box.press("Enter");
  await expect(page.getByRole("button", { name: "Drag Eye of the Tiger onto a mile" })).toBeVisible();
  await expect(box).toHaveValue("");

  // Not on the list: type it as "Song – Artist".
  await box.fill("Sprawl II");
  await expect(page.getByText("No matches. Type it as Song – Artist to add it anyway.")).toBeVisible();
  await box.fill("Sprawl II – Arcade Fire");
  await page.getByRole("option").filter({ hasText: "Add “Sprawl II”" }).click();
  await expect(page.getByRole("button", { name: "Drag Sprawl II onto a mile" })).toBeVisible();
});

test("you can pick a mile without dragging", async ({ page, request }) => {
  const race = await createRace(request);
  await openMap(page, race.id);
  await typeSong(page, "Juice", "Lizzo");
  await page.getByLabel("Or choose a mile").selectOption({ label: "Mile 8 · Barclays & the Bank Tower (3 left)" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Added to Mile 8 · Barclays & the Bank Tower");

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
  for (const t of ["One", "Two", "Three"]) await addViaApi(request, race.id, { mile: 20, song: song(t, "X") });
  await addViaApi(request, race.id, { mile: 15, name: "Ana", song: song("Mr. Brightside", "The Killers") });
  await openMap(page, race.id);
  await expect(marker(page, 20)).toHaveAccessibleName("Mile 20, The Bronx: 3 of 3 songs");

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
  await expect(marker(page, 26)).toHaveAccessibleName("Mile 26, The finish: 0 of 3 songs");
  await addViaApi(request, race.id, { mile: 26, name: "Mom", song: song("Don't Stop Me Now", "Queen") });
  await expect(marker(page, 26)).toHaveAccessibleName("Mile 26, The finish: 1 of 3 songs", { timeout: 15_000 });
  await expect(page.getByText("from Mom")).toBeVisible();
});

test("skipping the name in the welcome popup brings it back when you add a song", async ({ page, request }) => {
  const race = await createRace(request);
  await page.goto(`/r/${race.id}`);
  await page.getByRole("dialog", { name: "How it works" }).getByRole("button", { name: "Close" }).click();
  await typeSong(page, "Juice", "Lizzo");
  await page.getByLabel("Or choose a mile").selectOption({ label: "Mile 9 · Bed-Stuy (3 left)" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Add your name first, so Matt knows who picked it.");
  const intro = page.getByRole("dialog", { name: "How it works" });
  await intro.getByLabel("First, what's your name?").fill("Jules");
  await intro.getByRole("button", { name: "Let's go" }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Added to Mile 9 · Bed-Stuy");
  await expect(page.getByText("from Jules")).toBeVisible();
});

test("pausing mid-drag zooms the map in, and it zooms back out after the drop", async ({ page, request }) => {
  const race = await createRace(request);
  await openMap(page, race.id);
  await typeSong(page, "Juice", "Lizzo");
  // Distance on screen between the course points for miles 16 and 17 (the cards beside them can switch sides).
  const gap = () =>
    page.evaluate(() => {
      const at = (n: number) => document.querySelector(`[data-drop-mile="${n}"]`)!.closest(".maplibregl-marker")!.getBoundingClientRect();
      const [a, b] = [at(16), at(17)];
      return Math.hypot(a.x - b.x, a.y - b.y);
    });
  const before = await gap();

  const chip = (await page.getByRole("button", { name: /^Drag / }).boundingBox())!;
  const m = (await marker(page, 17).boundingBox())!;
  const from = { x: chip.x + 24, y: chip.y + chip.height / 2 };
  const near = { x: m.x + m.width / 2 + 20, y: m.y + m.height / 2 + 20 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(from.x + ((near.x - from.x) * i) / 12, from.y + ((near.y - from.y) * i) / 12);
  // Hold still over the map: it zooms in toward the pointer, spreading the miles apart.
  await expect.poll(gap, { timeout: 5000 }).toBeGreaterThan(before * 1.8);
  // Keep holding: it zooms one more step, then stops so the miles stay findable.
  await expect.poll(gap, { timeout: 5000 }).toBeGreaterThan(before * 3.5);
  await page.waitForTimeout(1500);
  expect(await gap()).toBeLessThan(before * 4.5);

  const t = (await marker(page, 17).boundingBox())!;
  for (let i = 1; i <= 4; i++) await page.mouse.move(near.x + ((t.x + t.width / 2 - near.x) * i) / 4, near.y + ((t.y + t.height / 2 - near.y) * i) / 4);
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Added to Mile 17 · Upper East Side");
  await expect.poll(gap, { timeout: 5000 }).toBeLessThan(before * 1.2);
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
