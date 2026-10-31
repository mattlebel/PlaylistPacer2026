import { addViaApi, createRace, expect, managePath, setClock, song, test, TIMES } from "./fixtures";

test("the runner sees every song with full names and can remove any", async ({ page, request }) => {
  const race = await createRace(request);
  await addViaApi(request, race.id, { mile: 15, name: "Sarah Connor", song: song("Mr. Brightside", "The Killers") });
  await addViaApi(request, race.id, { mile: 15, name: "Dana", song: song("Juice", "Lizzo") });
  await addViaApi(request, race.id, { mile: 20, name: "Jules", song: song("Can't Hold Us", "Macklemore") });
  await page.goto(managePath(race));
  await expect(page.getByRole("heading", { name: "3 songs on 2 miles" })).toBeVisible();
  await expect(page.getByText("from Sarah Connor")).toBeVisible();
  await expect(page.getByText("from Dana")).toBeVisible();
  // Wrapped and a leaderboard, all along on the runner's page.
  const wrapped = page.getByRole("region", { name: "Race playlist, wrapped" });
  await expect(wrapped.getByText("So far · wrapped")).toBeVisible();
  await expect(wrapped.getByText("Leaderboard · who added the most")).toBeVisible();
  await expect(wrapped.getByText("Top artist:")).toHaveCount(0); // no artist twice yet
  await expect(wrapped.getByRole("listitem").filter({ hasText: "Sarah" })).toContainText("1 song");
  // No Spotify keys in tests: the page says how to build the playlist instead.
  await expect(page.getByText(/Spotify isn't connected to this app yet/)).toBeVisible();

  await page.getByRole("button", { name: "Remove Juice" }).click();
  await page.getByRole("button", { name: "Remove it" }).click();
  await expect(page.getByRole("heading", { name: "2 songs on 2 miles" })).toBeVisible();
});

test("the runner edits race details and downloads every song as a spreadsheet", async ({ page, request }) => {
  const race = await createRace(request, "Matt Lebel", { bib: "13302" });
  await addViaApi(request, race.id, { mile: 15, name: "Sarah Connor", song: song("Mr. Brightside", "The Killers", "b") });
  await page.goto(managePath(race));
  await expect(page.getByText("Wave 1 · 9:10 AM · 11:00/mile · bib 13302 · finish ~1:58 PM")).toBeVisible();
  await expect(page.getByText("~11:55 AM")).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download as a spreadsheet (CSV)" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("matt-nyc-marathon-songs.csv");
  const csv = (await (await import("node:fs/promises")).readFile((await file.path())!, "utf8")).replace(/^\ufeff/, "");
  expect(csv.split("\r\n")).toEqual([
    '"Mile","Spot","Around","Song","Artist","From","Note","Spotify link"',
    `"Mile 15","Queensboro Bridge","11:55 AM","Mr. Brightside","The Killers","Sarah Connor","","https://open.spotify.com/track/${"b".repeat(22)}"`,
  ]);

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Start wave").selectOption("09:35");
  await page.getByLabel("Pace per mile").fill("10:00");
  await page.getByRole("button", { name: "Save race details" }).click();
  await expect(page.getByText("Wave 2 · 9:35 AM · 10:00/mile · bib 13302 · finish ~1:57 PM")).toBeVisible();
  await expect(page.getByText("~12:05 PM")).toBeVisible();
});

test("race morning: adding closes at 6am, and the map stays up", async ({ page, request }) => {
  const race = await createRace(request);
  await addViaApi(request, race.id, { mile: 13, name: "Coach", song: song("Lose Yourself", "Eminem") });
  await addViaApi(request, race.id, { mile: 20, name: "Coach Stu", song: song("Stronger", "Kanye West") });
  setClock(TIMES.raceMorning);

  await page.goto(`/r/${race.id}`);
  // No welcome popup or name once adding has closed: straight to the recap.
  await expect(page.getByRole("dialog", { name: "How it works" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Adding is closed" })).toBeVisible();
  await expect(page.getByText("Adding songs is closed. Matt is heading to the start!", { exact: false })).toBeVisible();
  const recap = page.getByRole("region", { name: "Race playlist, wrapped" });
  await expect(recap.getByText("Race recap · wrapped")).toBeVisible();
  await expect(recap.getByRole("listitem").filter({ hasText: "Coach" }).first()).toContainText("2 songs");
  await expect(page.getByLabel("Search for a song")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Live feed" }).getByText(/Coach added “Lose Yourself” to mile 13/)).toBeVisible();

  const res = await request.post(`/api/races/${race.id}/plants`, { data: { mile: 2, name: "Sam", song: song("Late", "X") } });
  expect(res.status()).toBe(403);

  // After the race, the page is a keepsake.
  setClock(TIMES.afterRace);
  await page.reload();
  await expect(page.getByText("Matt ran the NYC Marathon to the soundtrack you all built. Here's the recap.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Matt's NYC Marathon soundtrack" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Track Matt live/ })).toHaveCount(0);
});

test("an edit link from the first version still works", async ({ page, request }) => {
  const race = await createRace(request);
  const s = await addViaApi(request, race.id, { mile: 20, name: "Sarah", song: song("Juice", "Lizzo") });
  await page.goto(`/p/${s.id}#key=${s.editKey}`);
  await expect(page.getByRole("heading", { name: "Mile 20 · The Bronx" })).toBeVisible();
  await expect(page.getByText("Juice")).toBeVisible();
  await page.getByRole("button", { name: "Remove my song" }).click();
  await page.getByRole("button", { name: "Yes, remove my song" }).click();
  await expect(page.getByRole("heading", { name: "Removed" })).toBeVisible();
  await page.getByRole("link", { name: "See the live map" }).click();
  await expect(page.getByRole("heading", { name: "Help Matt soundtrack his NYC Marathon" })).toBeVisible();
});
