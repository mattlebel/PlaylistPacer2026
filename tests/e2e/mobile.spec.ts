import { expect, loadDemo, test } from "./fixtures";

test("landing page fits a phone without sideways scrolling", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("the planner works on a phone", async ({ page }) => {
  await loadDemo(page);
  await expect(page.getByTestId("avg-pace")).toBeVisible();
  await page.getByRole("button", { name: "Sort slow → fast" }).tap();
  await expect(page.getByTestId("tempo-summary")).toContainText("builds to the finish");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
