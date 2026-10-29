import { addViaApi, createRace, expect, managePath, setClock, song, test, TIMES, welcome } from "./fixtures";

test("the runner sees every song with full names and can remove any", async ({ page, request }) => {
  const race = await createRace(request);
  await addViaApi(request, race.id, { mile: 15, name: "Sarah Connor", song: song("Mr. Brightside", "The Killers") });
  await addViaApi(request, race.id, { mile: 15, name: "Dana", song: song("Juice", "Lizzo") });
  await addViaApi(request, race.id, { mile: 20, name: "Jules", song: song("Can't Hold Us", "Macklemore") });
  await page.goto(managePath(race));
  await expect(page.getByRole("heading", { name: "3 songs on 2 miles" })).toBeVisible();
  await expect(page.getByText("from Sarah Connor")).toBeVisible();
  await expect(page.getByText("from Dana")).toBeVisible();
  // No Spotify keys in tests: the page says how to build the playlist instead.
  await expect(page.getByText(/Spotify isn't connected to this app yet/)).toBeVisible();

  await page.getByRole("button", { name: "Remove Juice" }).click();
  await page.getByRole("button", { name: "Remove it" }).click();
  await expect(page.getByRole("heading", { name: "2 songs on 2 miles" })).toBeVisible();
});

test("race morning: adding closes at 6am, and the map stays up", async ({ page, request }) => {
  const race = await createRace(request);
  await addViaApi(request, race.id, { mile: 13, name: "Coach", song: song("Lose Yourself", "Eminem") });
  setClock(TIMES.raceMorning);

  await page.goto(`/r/${race.id}`);
  await welcome(page);
  await expect(page.getByRole("heading", { name: "Adding is closed" })).toBeVisible();
  await expect(page.getByLabel("Search for a song")).toHaveCount(0);
  await expect(page.getByText("from Coach")).toBeVisible();

  const res = await request.post(`/api/races/${race.id}/plants`, { data: { mile: 2, name: "Sam", song: song("Late", "X") } });
  expect(res.status()).toBe(403);
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
  await expect(page.getByRole("heading", { name: "Help Matt soundtrack 26.2" })).toBeVisible();
});
