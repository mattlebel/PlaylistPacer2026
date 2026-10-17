import { expect, test as base, type Page } from "@playwright/test";

/** Fails the test on any page error or console error (map tile fetches excepted). */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const text = m.text();
        // Map tiles and the Strava/Spotify brand files may be unreachable or absent in CI.
        if (/Failed to load resource|ERR_|tiles|cartocdn|\/brand\//i.test(text)) return;
        errors.push(text);
      });
      await use(errors);
      expect(errors, "console/page errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function loadDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Play the NYC demo" }).click();
  await expect(page.getByRole("heading", { name: "Tracklist" })).toBeVisible();
}
