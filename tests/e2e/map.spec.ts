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
  // The name is asked once, in the welcome popup, not again in the song panel.
  await expect(page.getByLabel("Your name", { exact: true })).toHaveCount(0);

  await typeSong(page, "Mr. Brightside", "The Killers");
  await expect(page.getByRole("button", { name: "Drag Mr. Brightside onto a mile" })).toBeVisible();
  await dragSongTo(page, 15);

  await expect(page.getByRole("status")).toContainText("Added to Mile 15 · Queensboro Bridge");
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

test("one search box: Spotify results as you type", async ({ page, request }) => {
  const race = await createRace(request);
  await openMap(page, race.id);
  const box = page.getByRole("combobox", { name: "Search for a song" });
  const results = page.getByRole("listbox", { name: "Search results" }).getByRole("option");
  await box.fill("brights");
  await expect(page.getByText("Search by Spotify")).toBeVisible();
  await expect(results.first()).toContainText("Mr. Brightside");
  await expect(results.first()).toContainText("The Killers");
  await expect(page.getByRole("link", { name: "Play Mr. Brightside on Spotify" })).toBeVisible();
  // Arrow keys and Enter work too.
  await box.press("ArrowDown");
  await box.press("Enter");
  await expect(page.getByRole("button", { name: "Drag Mr. Brightside - Remastered onto a mile" })).toBeVisible();
  await expect(box).toHaveValue("");
  // No "add it as you typed it" option: songs come from search results only.
  await box.fill("sprawl");
  await expect(results).toHaveCount(1);
  await expect(page.getByText(/as you typed/)).toHaveCount(0);
});

test("without Spotify keys the box suggests from the built-in song list", async ({ page, request }) => {
  await page.unroute("**/api/songs/search**"); // the real server here has no Spotify keys
  const race = await createRace(request);
  await openMap(page, race.id);
  const box = page.getByRole("combobox", { name: "Search for a song" });
  await box.fill("eye of the");
  await expect(page.getByRole("listbox", { name: "Search results" }).getByRole("option").first()).toContainText("Eye of the Tiger");
  await expect(page.getByText("Search by Spotify")).toHaveCount(0);
  await box.press("Enter");
  await expect(page.getByRole("button", { name: "Drag Eye of the Tiger onto a mile" })).toBeVisible();
  await box.fill("zzzz qqqq");
  await expect(page.getByText("No matches. Try different words.")).toBeVisible();
});

test("you can pick a mile without dragging", async ({ page, request }) => {
  const race = await createRace(request);
  await openMap(page, race.id);
  await typeSong(page, "Juice", "Lizzo");
  await page.getByLabel("Or choose a mile").selectOption({ label: "Mile 8 · Barclays & the Bank Tower (3 left)" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Added to Mile 8 · Barclays & the Bank Tower");

  // Or tap a mile and add straight from its popup.
  await marker(page, 20).click();
  const sheet = page.getByRole("dialog", { name: "Mile 20 · The Bronx" });
  await typeSong(sheet, "Can't Hold Us", "Macklemore");
  await expect(page.getByRole("status")).toContainText("Added to Mile 20 · The Bronx");
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
  await expect(page.getByRole("status")).toContainText("Added to Mile 21 · Madison Avenue Bridge");

  // Repeats are greyed out in search, and the server refuses them too (another version of the same song).
  const res = await request.post(`/api/races/${race.id}/plants`, { data: { mile: 3, name: "Sam", song: song("Mr. Brightside - Remastered", "The Killers") } });
  expect(res.status()).toBe(409);
  expect((await res.json()).error).toBe("That song is already on the course. Pick a different one!");
});

test("the map updates live as other people add songs", async ({ page, request }) => {
  const race = await createRace(request);
  await openMap(page, race.id);
  await expect(marker(page, 26)).toHaveAccessibleName("Mile 26, The finish: 0 of 3 songs");
  await addViaApi(request, race.id, { mile: 26, name: "Mom", song: song("Don't Stop Me Now", "Queen") });
  await expect(marker(page, 26)).toHaveAccessibleName("Mile 26, The finish: 1 of 3 songs", { timeout: 15_000 });
  await expect(page.getByRole("region", { name: "Live feed" }).getByText(/Mom added “Don't Stop Me Now” to mile 26/)).toBeVisible();
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
  await expect(page.getByRole("status")).toContainText("Added to Mile 9 · Bed-Stuy");
  await expect(page.getByRole("region", { name: "Live feed" }).getByText(/Jules added “Juice” to mile 9/)).toBeVisible();
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
  await expect(page.getByRole("status")).toContainText("Added to Mile 17 · Upper East Side");
  await expect.poll(gap, { timeout: 5000 }).toBeLessThan(before * 1.2);
});

test("friends see when Matt passes each mile, his bib, and when adding closes", async ({ page, request }) => {
  const race = await createRace(request, "Matt Lebel", { bib: "13302" });
  await openMap(page, race.id);
  await expect(page.getByText("Matt starts at 9:10 AM (Wave 1), runs about 11:00 a mile, and should finish around 1:58 PM.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Track Matt live · bib 13302" })).toHaveAttribute("href", "https://liveresults.nyrr.org");
  // The fake server clock says Oct 20, noon (EDT): 11 days and 19 hours before 6am EST on race day.
  await expect(page.getByText(/^Adding closes in 11 days, 1[89] hrs$/)).toBeVisible();
  await marker(page, 15).click();
  await expect(page.getByRole("dialog", { name: "Mile 15 · Queensboro Bridge" }).getByText("Matt passes here around 11:55 AM")).toBeVisible();
});

test("a live feed beside the map shows the latest songs, and search greys out songs already on the course", async ({ page, request }) => {
  const race = await createRace(request);
  await addViaApi(request, race.id, { mile: 15, name: "Sarah Connor", song: song("Mr. Brightside", "The Killers") });
  await openMap(page, race.id);
  const feed = page.getByRole("region", { name: "Live feed" });
  await expect(feed.getByText(/Sarah added “Mr\. Brightside” to mile 15/)).toBeVisible();
  await feed.getByRole("button", { name: /Sarah added/ }).click();
  await expect(page.getByRole("dialog", { name: "Mile 15 · Queensboro Bridge" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Both versions count as the same song, so both are greyed out.
  await page.getByRole("combobox", { name: "Search for a song" }).fill("brightside");
  const taken = page.getByRole("listbox", { name: "Search results" }).getByRole("option").filter({ hasText: "Already on mile 15" });
  await expect(taken).toHaveCount(2);
  await expect(taken.first()).toBeDisabled();
});

test("after adding, Share sends a ready-made message with the link", async ({ page, request }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      value: async (d?: ShareData) => {
        (window as unknown as { shared?: ShareData }).shared = d;
      },
    });
  });
  const race = await createRace(request);
  await openMap(page, race.id);
  await typeSong(page, "Juice", "Lizzo");
  await page.getByLabel("Or choose a mile").selectOption({ label: "Mile 15 · Queensboro Bridge (3 left)" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("status").getByRole("button", { name: "Share" }).click();
  const shared = (await page.evaluate(() => (window as unknown as { shared?: ShareData }).shared))!;
  expect(shared.text).toBe("I put “Juice” on Matt's mile 15 (Queensboro Bridge) of the NYC Marathon 🎵 Add a song for them:");
  expect(shared.url).toMatch(new RegExp(`/r/${race.id}$`));
});

test("a new song charges up the course line to its mile", async ({ page, request }) => {
  const race = await createRace(request);
  await openMap(page, race.id);
  await expect(marker(page, 20)).not.toHaveAttribute("data-charged");
  await addViaApi(request, race.id, { mile: 20, name: "Jules", song: song("Can't Hold Us", "Macklemore") });
  // Someone else's song shows up on the next live refresh, and the pulse ends with the marker flashing.
  await expect(marker(page, 20)).toHaveAttribute("data-charged", "", { timeout: 15_000 });
});

test("songs from Spotify can be previewed in the mile popup", async ({ page, request }) => {
  const race = await createRace(request);
  await addViaApi(request, race.id, { mile: 16, name: "Mom", song: song("Dog Days Are Over", "Florence + The Machine", "d") });
  await openMap(page, race.id);
  await marker(page, 16).click();
  const sheet = page.getByRole("dialog", { name: "Mile 16 · First Avenue" });
  await sheet.getByRole("button", { name: "Preview Dog Days Are Over" }).click();
  await expect(sheet.locator("iframe")).toHaveAttribute("src", /open\.spotify\.com\/embed\/track\/d{22}/);
  await sheet.getByRole("button", { name: "Hide preview of Dog Days Are Over" }).click();
  await expect(sheet.locator("iframe")).toHaveCount(0);
});

test("Undo takes a song back off the course and puts it back in your hand", async ({ page, request }) => {
  const race = await createRace(request);
  await openMap(page, race.id);
  await typeSong(page, "Juice", "Lizzo");
  await page.getByLabel("Or choose a mile").selectOption({ label: "Mile 8 · Barclays & the Bank Tower (3 left)" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(marker(page, 8)).toHaveAccessibleName(/1 of 3 songs/);
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("status")).toHaveText("Took it back. Drop it somewhere else.");
  await expect(marker(page, 8)).toHaveAccessibleName(/0 of 3 songs/);
  await expect(page.getByRole("button", { name: "Drag Juice onto a mile" })).toBeVisible();
});

test("dropping a song gives a little buzz on phones that support it", async ({ page, request }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "vibrate", {
      value: (ms: number) => {
        (window as unknown as { buzzed?: number }).buzzed = ms;
        return true;
      },
    });
  });
  const race = await createRace(request);
  await openMap(page, race.id);
  await typeSong(page, "Toxic", "Britney Spears");
  await dragSongTo(page, 13);
  await expect(page.getByRole("status")).toContainText("Added to Mile 13");
  expect(await page.evaluate(() => (window as unknown as { buzzed?: number }).buzzed)).toBe(35);
});

test("phones keep the map files, so repeat visits load the map instantly", async ({ request }) => {
  const tile = await request.get("/basemap/tiles/14/4824/6160.pbf");
  expect(tile.status()).toBe(200);
  expect(tile.headers()["cache-control"]).toBe("public, max-age=604800, stale-while-revalidate=2592000");
  const meta = await request.get("/basemap/basemap.json");
  expect(meta.headers()["cache-control"]).toBe("public, max-age=86400, stale-while-revalidate=604800");
});

test("adding a song plays a cowbell and a little cheer, and Sound off keeps it quiet", async ({ page, request }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { sounds: string[] };
    w.sounds = [];
    window.addEventListener("pp:sound", (e) => w.sounds.push((e as CustomEvent<string>).detail));
  });
  const heard = () => page.evaluate(() => (window as unknown as { sounds: string[] }).sounds);
  const race = await createRace(request);
  await openMap(page, race.id);
  expect(await heard()).toEqual(["cowbell"]); // "Let's go"

  await typeSong(page, "Juice", "Lizzo");
  await dragSongTo(page, 9);
  await expect(page.getByRole("status")).toContainText("Added to Mile 9");
  expect(await heard()).toEqual(["cowbell", "cowbell", "cheer"]);

  await page.getByRole("button", { name: "🔔 Sound on" }).click();
  await expect(page.getByRole("button", { name: "🔕 Sound off" })).toHaveAttribute("aria-pressed", "false");
  await typeSong(page, "Toxic", "Britney Spears");
  await dragSongTo(page, 10);
  await expect(page.getByRole("status")).toContainText("Added to Mile 10");
  expect(await heard()).toEqual(["cowbell", "cowbell", "cheer"]);

  // Remembered on this device.
  await page.reload();
  await expect(page.getByRole("button", { name: "🔕 Sound off" })).toBeVisible();
});

test("after adding, it's clear you can keep going", async ({ page, request }) => {
  const race = await createRace(request);
  await openMap(page, race.id);
  await expect(page.getByText("0 of 81 spots filled")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add a song" })).toBeVisible();
  // The miles that still need a song, landmarks first.
  const needs = page.getByRole("button", { name: /^Add a song to / });
  await expect(needs).toHaveCount(3);
  await expect(needs.first()).toHaveAccessibleName("Add a song to Start, The start");

  await typeSong(page, "Juice", "Lizzo");
  await dragSongTo(page, 0);
  await expect(page.getByRole("status")).toContainText("Added to Start");
  await expect(page.getByRole("heading", { name: "Add another song" })).toBeVisible();
  await expect(page.getByText(/You've added 1 song\. Keep them coming/)).toBeVisible();
  await expect(page.getByText("1 of 81 spots filled")).toBeVisible();
  await expect(page.getByText("80 to go. Keep them coming!")).toBeVisible();
  // Ready for the next one.
  await expect(page.getByRole("combobox", { name: "Search for a song" })).toBeFocused();
  // A suggested mile opens its popup, with search right there.
  await needs.first().click();
  await expect(page.getByRole("dialog", { name: "Mile 1 · Top of the Verrazzano" })).toBeVisible();
});

test("resting on a search result opens Spotify's preview player for it", async ({ page, request }) => {
  const race = await createRace(request);
  await openMap(page, race.id);
  await page.getByRole("combobox", { name: "Search for a song" }).fill("brightside");
  const results = page.getByRole("listbox", { name: "Search results" }).getByRole("option");
  await results.first().hover();
  const player = page.getByTitle(/^Preview Mr\. Brightside on Spotify$/);
  await expect(player).toHaveAttribute("src", /open\.spotify\.com\/embed\/track\//);
  await expect(page.getByText("Preview · Mr. Brightside")).toBeVisible();
  // Or tap ▶ (phones have no hover); tapping again closes it.
  await page.getByRole("button", { name: "Preview Mr. Brightside - Remastered" }).click();
  await expect(page.getByText("Preview · Mr. Brightside - Remastered")).toBeVisible();
  await page.getByRole("button", { name: "Preview Mr. Brightside - Remastered" }).click();
  await expect(page.getByText(/^Preview · /)).toHaveCount(0);
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
