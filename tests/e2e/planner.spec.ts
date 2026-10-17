import { expect, loadDemo, test } from "./fixtures";

test.describe("planner with the NYC demo", () => {
  test.beforeEach(async ({ page }) => loadDemo(page));

  test("shows the tracklist split into sides and the liner notes", async ({ page }) => {
    await expect(page.getByText("65 tracks · drag to reorder")).toBeVisible();
    await expect(page.getByText("Side A · from the start")).toBeVisible();
    await expect(page.getByText("Side B · second half")).toBeAttached();
    await expect(page.getByRole("heading", { name: "Liner notes" })).toBeVisible();
    await expect(page.getByText("Closing track", { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("avg-pace")).toHaveText("9:09/mi");
  });

  test("goal time drives the pace", async ({ page }) => {
    const goal = page.getByLabel("Goal time (h:mm:ss)");
    await goal.fill("3:30:00");
    await goal.press("Enter");
    await expect(page.getByTestId("avg-pace")).toHaveText("8:01/mi");
  });

  test("sorting slow to fast builds tempo, and the suggested fix lands the closing track", async ({ page }) => {
    await expect(page.getByTestId("tempo-summary")).not.toContainText("builds to the finish");
    await page.getByRole("button", { name: "Sort slow → fast" }).click();
    await expect(page.getByTestId("tempo-summary")).toContainText("builds to the finish");
    const status = page.getByTestId("closer-status");
    if (!(await status.textContent())?.includes("Right on time")) {
      await page.getByRole("button", { name: /Apply/ }).click();
    }
    await expect(status).toHaveText("Right on time");
  });

  test("any song can become the closing track", async ({ page }) => {
    await page.getByRole("button", { name: "Make Empire State of Mind your closing track" }).click();
    await expect(page.getByRole("button", { name: /is your closing track$/ })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Empire State of Mind is your closing track" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("closer-status")).toHaveText(/early|late|Right on time/);
  });

  test("pacing strategies switch, and ghost needs a timed course", async ({ page }) => {
    const group = page.getByRole("radiogroup", { name: "pacing strategy" });
    await group.getByRole("radio", { name: "Hill-smart" }).click();
    await expect(group.getByRole("radio", { name: "Hill-smart" })).toHaveAttribute("aria-checked", "true");
    await expect(group.getByRole("radio", { name: "Ghost" })).toBeDisabled();
  });

  test("the plan survives a reload", async ({ page }) => {
    await page.getByRole("button", { name: "Sort slow → fast" }).click();
    const first = await page.locator("ol li[data-key]").first().textContent();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Tracklist" })).toBeVisible();
    await expect(page.locator("ol li[data-key]").first()).toHaveText(first!);
  });

  test("play the course moves the runner and exits with Escape", async ({ page }) => {
    await page.getByRole("button", { name: "▶ Play the course" }).click();
    const dist = page.getByTestId("preview-distance");
    await expect(dist).toBeVisible();
    await page.getByRole("button", { name: "Next song" }).click();
    await expect.poll(async () => Number(await dist.textContent())).toBeGreaterThan(0.3);
    await page.keyboard.press("Escape");
    await expect(dist).toBeHidden();
  });

  test("share offers the poster and copies a cue sheet", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Share your plan" });
    await expect(dialog.getByText("your race, sequenced like an album")).toBeVisible();
    await expect(dialog.getByText("Side A", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Copy cue sheet" }).click();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain("NYC Marathon — goal 3:59:59 (9:09/mi)");
    expect(text).toMatch(/★ .*'Till I Collapse — Eminem/);
    expect(text).toContain("made with Playlist Pacer");
  });
});
