import { createRace, expect, managePath, plantViaApi, setClock, song, test, TIMES } from "./fixtures";

test("race morning: planting closes and the cue list unlocks without spoilers", async ({ page, request }) => {
  const race = await createRace(request);
  await plantViaApi(request, race.id, { moment: "bronx", name: "Sarah", email: "s@x.com", message: "Bronx is yours", song: song("Juice", "Lizzo", "e") });
  setClock(TIMES.raceMorning);

  await page.goto(`/r/${race.id}`);
  await expect(page.getByText(/Planting is closed/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Plant a song here" })).toHaveCount(0);

  await page.goto(managePath(race));
  const cues = page.getByRole("list", { name: "Race-day cue list" });
  await expect(cues).toBeVisible();
  const play = cues.getByRole("link", { name: "Play the song at The Bronx" });
  await expect(play).toHaveAttribute("href", `https://open.spotify.com/track/${"e".repeat(22)}`);
  await expect(cues.getByText("from Sarah")).toBeVisible();
  await expect(page.getByText("Juice")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /reveal/i })).toHaveCount(0);
});

test("after the gun: the runner reveals every song and note", async ({ page, request }) => {
  const race = await createRace(request);
  await plantViaApi(request, race.id, { moment: "bronx", name: "Sarah", email: "s@x.com", message: "Bronx is yours", song: song("Juice", "Lizzo", "e") });
  await plantViaApi(request, race.id, { moment: "queensboro", name: "Mom", email: "mom@x.com", song: song("Dancing Queen", "ABBA") });
  setClock(TIMES.afterGun);

  await page.goto(managePath(race));
  await page.getByRole("button", { name: "I finished. Reveal my notes" }).click();
  await expect(page.getByText("“Bronx is yours”")).toBeVisible();
  await expect(page.getByText("Juice")).toBeVisible();
  await expect(page.getByText("from Sarah", { exact: true })).toBeVisible();
  await expect(page.getByText("Dancing Queen")).toBeVisible();
  await expect(page.getByRole("link", { name: "Play Juice on Spotify" })).toHaveCount(0); // no art in test data
});

test("the reveal can't be forced early through the API", async ({ request }) => {
  const race = await createRace(request);
  const res = await request.post(`/api/races/${race.id}/reveal`, { headers: { "x-manage-key": race.manageKey } });
  expect(res.status()).toBe(409);
  expect((await res.json()).error).toMatch(/No peeking/);
});
