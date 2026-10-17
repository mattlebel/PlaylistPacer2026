import { expect, loadDemo, test } from "./fixtures";

/** Rewrite the saved plan as if it came from Strava + Spotify, then reload. */
async function asImported(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const key = "playlistpacer.v2";
    const saved = JSON.parse(localStorage.getItem(key)!);
    saved.state.course.source = "strava-activity";
    saved.state.course.sourceUrl = "https://www.strava.com/activities/12345678901";
    saved.state.course.device = "Garmin Forerunner 965";
    saved.state.playlistSource = "spotify";
    saved.state.playlistUrl = "https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP";
    saved.state.tracks[0].spotifyId = "3n3Ppam7vgaVa1iaRUc9Lp";
    saved.state.tracks[0].art = "/next.svg";
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tracklist" })).toBeVisible();
}

test("Strava data carries Powered by Strava, View on Strava and device credit", async ({ page }) => {
  await loadDemo(page);
  await asImported(page);
  await expect(page.getByText("Powered by Strava").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View on Strava" })).toHaveAttribute("href", "https://www.strava.com/activities/12345678901");
  await expect(page.getByText("Recorded on Garmin Forerunner 965")).toBeVisible();
});

test("Spotify playlists show the Spotify brand and link back", async ({ page }) => {
  await loadDemo(page);
  await asImported(page);
  await expect(page.getByRole("link", { name: "Open Spotify" })).toHaveAttribute(
    "href",
    "https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP",
  );
  const art = page.getByRole("link", { name: /on Spotify$/ }).first();
  await expect(art).toHaveAttribute("href", "https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp");
  await expect(art).toHaveAttribute("target", "_blank");
});

test("demo data shows no third-party branding", async ({ page }) => {
  await loadDemo(page);
  await expect(page.getByText("Powered by Strava")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open Spotify" })).toHaveCount(0);
});
