import { addViaApi, createRace, dragSongTo, expect, marker, openMap, song, test, typeSong } from "./fixtures";

/** A silent 8 kHz WAV, standing in for a song's preview clip. */
function silentWav(seconds: number) {
  const n = 8000 * seconds;
  const wav = Buffer.alloc(44 + n);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + n, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(8000, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(n, 40);
  wav.fill(128, 44);
  return wav;
}

test("a friend drags a song onto a mile", async ({ page, request }) => {
  const race = await createRace(request);
  await page.goto(`/r/${race.id}`);
  await expect(page.getByRole("heading", { name: "Help Matt soundtrack his NYC Marathon" })).toBeVisible();
  const intro = page.getByRole("dialog", { name: "How it works" });
  await expect(intro.getByText("Drag it onto a mile")).toBeVisible();
  // Each step has a little animation.
  await expect(intro.getByRole("img", { name: "Typing a song into the search box and picking a result" })).toBeVisible();
  await expect(intro.getByRole("img", { name: "Dragging a song bubble onto a mile marker" })).toBeVisible();
  await expect(intro.getByRole("img", { name: "The runner reaches the mile and the song plays" })).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Preview Mr. Brightside", exact: true })).toBeVisible();
  // Previews only: nothing links out to the Spotify app.
  await expect(page.getByRole("link", { name: /on Spotify/ })).toHaveCount(0);
  await expect(page.getByText("Click a song to pick it")).toBeVisible();
  // The row under the pointer glows, with a hand cursor, so it's clear it can be picked.
  const row = page.getByRole("listbox", { name: "Search results" }).locator("li").nth(1);
  await row.hover({ position: { x: 4, y: 4 } });
  await expect(row).toHaveCSS("cursor", "pointer");
  await expect(row).toHaveCSS("box-shadow", /0px 0px 14px/);
  await expect(page.getByRole("listbox", { name: "Search results" }).locator("li").nth(0)).not.toHaveCSS("box-shadow", /0px 0px 14px/);
  // Arrow keys and Enter work too.
  await page.mouse.move(0, 0);
  await box.fill("bright");
  await box.fill("brights");
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
  await expect(marker(page, 26)).toHaveAccessibleName("Finish, Tavern on the Green: 0 of 3 songs");
  await addViaApi(request, race.id, { mile: 26, name: "Mom", song: song("Don't Stop Me Now", "Queen") });
  await expect(marker(page, 26)).toHaveAccessibleName("Finish, Tavern on the Green: 1 of 3 songs", { timeout: 15_000 });
  await expect(page.getByRole("region", { name: "Live feed" }).getByText(/Mom added “Don't Stop Me Now” to the finish/)).toBeVisible();
});

test("the welcome popup can't be skipped without a name", async ({ page, request }) => {
  const race = await createRace(request, "Matt Lebel", { bib: "13302" });
  await addViaApi(request, race.id, { mile: 3, name: "Ana", song: song("Float On", "Modest Mouse") });
  await addViaApi(request, race.id, { mile: 5, name: "Mom", song: song("Ho Hey", "The Lumineers") });
  await addViaApi(request, race.id, { mile: 7, name: "Sarah", song: song("Toxic", "Britney Spears") });
  await page.goto(`/r/${race.id}`);
  const intro = page.getByRole("dialog", { name: "How it works" });
  await expect(intro).toBeVisible();
  // Whose race this is, and a peek at the live feed, so it's clear why you're here.
  await expect(intro.getByLabel("Bib 13302, Matt, Wave 1").last()).toBeVisible();
  await expect(intro.getByText("Add songs to Matt's NYC Marathon playlist.")).toBeVisible();
  await expect(intro.getByText("Live feed – see what others are adding")).toBeVisible();
  // Two at a time, rolling through the latest songs.
  const peek = intro.getByLabel("Live feed preview");
  await expect(peek.getByText(/Sarah added “Toxic” to mile 7/)).toBeVisible();
  await expect(peek.getByText(/Ana added “Float On” to mile 3/)).toHaveCount(0);
  await expect(peek.getByText(/Ana added “Float On” to mile 3/)).toBeVisible({ timeout: 8_000 });
  await expect(intro.getByText("Get started")).toBeVisible();
  await expect(intro.getByRole("button", { name: "Close" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.mouse.click(10, 10);
  await expect(intro).toBeVisible();
  // The name box is on screen without scrolling.
  await expect(intro.getByLabel("First, what's your name?")).toBeInViewport();
  await intro.getByLabel("First, what's your name?").fill("Jules");
  await intro.getByRole("button", { name: "Let's go" }).click();
  await expect(intro).toHaveCount(0);
  // Opened again later, it can be closed.
  await page.getByRole("button", { name: "How it works" }).click();
  await intro.getByRole("button", { name: "Close" }).click();
  await expect(intro).toHaveCount(0);
  await typeSong(page, "Juice", "Lizzo");
  await page.getByLabel("Or choose a mile").selectOption({ label: "Mile 9 · Bed-Stuy (3 left)" });
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
  // Keep holding: it keeps gliding in, then stops so the miles stay findable.
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
  await sheet.getByRole("button", { name: "Stop preview of Dog Days Are Over" }).click();
  await expect(sheet.locator("iframe")).toHaveCount(0);
});

test("our ▶ starts Spotify's player by itself, so it's one tap", async ({ page, request }) => {
  const race = await createRace(request);
  await addViaApi(request, race.id, { mile: 16, name: "Mom", song: song("Dog Days Are Over", "Florence + The Machine", "d") });
  // A stand-in for Spotify's iFrame API that records play() calls.
  await page.route("https://open.spotify.com/embed/iframe-api/**", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.__played = [];
        window.onSpotifyIframeApiReady({
          createController(el, opts, cb) {
            const f = document.createElement("iframe");
            f.dataset.uri = opts.uri;
            el.replaceWith(f);
            cb({
              addListener(ev, fn) { if (ev === "ready") setTimeout(fn, 50); },
              play() { window.__played.push(opts.uri); },
              destroy() { f.remove(); },
            });
          },
        });`,
    }),
  );
  await openMap(page, race.id);
  await marker(page, 16).click();
  const sheet = page.getByRole("dialog", { name: "Mile 16 · First Avenue" });
  await sheet.getByRole("button", { name: "Preview Dog Days Are Over" }).click();
  await expect(sheet.getByTitle("Preview Dog Days Are Over on Spotify")).toHaveAttribute("data-uri", `spotify:track:${"d".repeat(22)}`);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __played: string[] }).__played)).toEqual([`spotify:track:${"d".repeat(22)}`]);
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
  expect(await heard()).toEqual(["welcome"]); // "Let's go"

  await typeSong(page, "Juice", "Lizzo");
  await dragSongTo(page, 9);
  await expect(page.getByRole("status")).toContainText("Added to Mile 9");
  expect(await heard()).toEqual(["welcome", "cowbell", "cheer"]);

  await page.getByRole("button", { name: "🔔 Sound on" }).click();
  await expect(page.getByRole("button", { name: "🔕 Sound off" })).toHaveAttribute("aria-pressed", "false");
  await typeSong(page, "Toxic", "Britney Spears");
  await dragSongTo(page, 10);
  await expect(page.getByRole("status")).toContainText("Added to Mile 10");
  expect(await heard()).toEqual(["welcome", "cowbell", "cheer"]);

  // Remembered on this device.
  await page.reload();
  await expect(page.getByRole("button", { name: "🔕 Sound off" })).toBeVisible();
});

test("after adding, it's clear you can keep going", async ({ page, request }) => {
  const race = await createRace(request);
  await openMap(page, race.id);
  await expect(page.getByText("0 of 81 spots filled")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add a song" })).toBeVisible();
  // Suggested miles only show once the course is nearly full.
  const needs = page.getByRole("button", { name: /^Add a song to / });
  await expect(needs).toHaveCount(0);

  await typeSong(page, "Juice", "Lizzo");
  await dragSongTo(page, 0);
  await expect(page.getByRole("status")).toContainText("Added to Start");
  await expect(page.getByRole("heading", { name: "Add another song" })).toBeVisible();
  await expect(page.getByText(/You've added 1 song\. Keep them coming/)).toBeVisible();
  await expect(page.getByText("1 of 81 spots filled")).toBeVisible();
  await expect(page.getByText("80 to go. Keep them coming!")).toBeVisible();
  // Ready for the next one.
  await expect(page.getByRole("combobox", { name: "Search for a song" })).toBeFocused();

  // With 15 spots left, the miles that still have room show up, emptiest and landmarks first.
  const miles = Array.from({ length: 26 }, (_, i) => i + 1);
  for (let i = 0, n = 0; n < 65; i++) {
    const mile = miles[i % miles.length];
    if (mile === 1 && i >= 26) continue; // leave room on mile 1
    await addViaApi(request, race.id, { mile, name: `Friend ${i}`, song: song(`Filler ${i}`, "The Testers") });
    n++;
  }
  await expect(page.getByText("66 of 81 spots filled")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("These miles have room")).toBeVisible();
  await expect(needs).toHaveCount(3);
  await expect(needs.nth(0)).toHaveAccessibleName("Add a song to Start, Staten Island");
  await expect(needs.nth(1)).toHaveAccessibleName("Add a song to Mile 1, Top of the Verrazzano");
  // A suggested mile opens its popup, with search right there.
  await needs.nth(1).click();
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
  // ▶ with no clip to play directly falls back to Spotify's player, right under the song; tapping again closes it.
  await page.getByRole("button", { name: "Preview Mr. Brightside - Remastered" }).click();
  await expect(page.getByText("Preview · Mr. Brightside - Remastered")).toBeVisible();
  await page.getByRole("button", { name: "Preview Mr. Brightside - Remastered" }).click();
  await expect(page.getByText(/^Preview · /)).toHaveCount(0);
});

test("▶ on a search result plays the song's preview clip straight away", async ({ page, request }) => {
  const race = await createRace(request);
  // A one-second silent clip stands in for Spotify's 30-second preview.
  const wav = silentWav(1);
  const asked: string[] = [];
  await page.route("**/api/songs/preview**", (route) => {
    asked.push(new URL(route.request().url()).searchParams.get("title") ?? "");
    return route.fulfill({ json: { url: "/clip.wav" } });
  });
  await page.route("**/clip.wav", (route) => route.fulfill({ body: wav, contentType: "audio/wav" }));
  await openMap(page, race.id);
  await page.getByRole("combobox", { name: "Search for a song" }).fill("brightside");
  const play = page.getByRole("button", { name: "Preview Mr. Brightside", exact: true });
  await play.click();
  await expect(play).toHaveAttribute("aria-pressed", "true");
  await expect(play).toHaveText("❚❚");
  expect(asked).toEqual(["Mr. Brightside"]);
  // No Spotify player needed.
  await expect(page.getByText(/^Preview · /)).toHaveCount(0);
  // Tap again to stop.
  await play.click();
  await expect(play).toHaveAttribute("aria-pressed", "false");
});

test("the start and finish markers are flagged, and the live feed shows album art", async ({ page, request }) => {
  const race = await createRace(request);
  await addViaApi(request, race.id, {
    mile: 26,
    name: "Dad",
    song: { ...song("Don't Stop Me Now", "Queen", "q"), art: "https://i.scdn.co/image/test" } as ReturnType<typeof song>,
  });
  await openMap(page, race.id);
  await expect(marker(page, 0)).toContainText(/start/i);
  await expect(marker(page, 26)).toContainText(/finish/i);
  await expect(page.locator(".maplibregl-marker").getByText("GO", { exact: true })).toHaveCount(0);
  const feed = page.getByRole("region", { name: "Live feed" });
  await expect(feed.locator("img")).toHaveAttribute("src", "https://i.scdn.co/image/test");
  await expect(feed.getByRole("link")).toHaveCount(0);
  // ▶ in the feed previews the song (here, with no clip found, Spotify's player under it).
  await feed.getByRole("button", { name: "Preview Don't Stop Me Now" }).click();
  await expect(feed.getByTitle("Preview Don't Stop Me Now on Spotify")).toHaveAttribute("src", /open\.spotify\.com\/embed\/track\/q{22}/);
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

test("the song you're holding plays while you drag it, then the crowd roars as you drop it", async ({ page, request }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { sounds: string[] };
    w.sounds = [];
    window.addEventListener("pp:sound", (e) => w.sounds.push((e as CustomEvent<string>).detail));
  });
  const heard = () => page.evaluate(() => (window as unknown as { sounds: string[] }).sounds);
  await page.route("**/api/songs/preview**", (route) => route.fulfill({ json: { url: "/held.wav" } }));
  await page.route("**/held.wav", (route) => route.fulfill({ body: silentWav(20), contentType: "audio/wav" }));
  const race = await createRace(request);
  await openMap(page, race.id);
  await typeSong(page, "Juice", "Lizzo");
  await expect.poll(heard).toEqual(["welcome", "preview"]);
  await dragSongTo(page, 9);
  await expect(page.getByRole("status")).toContainText("Added to Mile 9");
  // No cowbells this time: the clip fades out under the roar.
  expect(await heard()).toEqual(["welcome", "preview", "roar"]);

  // Put back without adding: just stops.
  await typeSong(page, "Toxic", "Britney Spears");
  await expect.poll(heard).toEqual(["welcome", "preview", "roar", "preview"]);
  await page.getByRole("button", { name: "Put this song back" }).click();
  await expect(page.getByRole("button", { name: "Drag Toxic onto a mile" })).toHaveCount(0);
});

test("one person can add up to 15 songs", async ({ page, request }) => {
  const race = await createRace(request);
  await openMap(page, race.id);
  // This browser's device id, and 14 songs from it already (as if added one by one).
  const device = "testdevice".padEnd(32, "0");
  await page.evaluate((d) => localStorage.setItem("pp.device", d), device);
  const keys: Record<string, string> = {};
  for (let i = 0; i < 14; i++) {
    const res = await request.post(`/api/races/${race.id}/plants`, {
      data: { mile: 1 + (i % 25), name: "Dana", device, song: song(`Mine ${i}`, "Me") },
    });
    const j = (await res.json()) as { id: string; editKey: string };
    keys[j.id] = j.editKey;
  }
  await addViaApi(request, race.id, { mile: 26, name: "Other", song: song("Not mine", "Them") });
  await page.evaluate((k) => localStorage.setItem("pp.edit", JSON.stringify(k)), keys);
  await page.reload();
  await expect(page.getByText(/You've added 14 songs 🔥\. Keep them coming: you can add 1 more\./)).toBeVisible();

  // The 15th is the last one.
  await typeSong(page, "Juice", "Lizzo");
  await page.getByLabel("Or choose a mile").selectOption({ label: "Start · Staten Island (3 left)" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("That's your 15! 🙌");
  await expect(page.getByRole("status").getByRole("button", { name: "＋ Add another" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "That's your 15 🙌" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Search for a song" })).toHaveCount(0);

  // The server holds the line too, even if the page is bypassed.
  const res = await request.post(`/api/races/${race.id}/plants`, { data: { mile: 2, name: "Dana", device, song: song("Sneaky", "Me") } });
  expect(res.status()).toBe(409);
  expect((await res.json()).code).toBe("person_limit");
});
