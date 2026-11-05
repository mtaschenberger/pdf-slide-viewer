import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const sample = readFileSync(resolve("../sample/four-slides.pdf"));
test("real PDF renders, cue browsing stays independent, take syncs audience", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.route("**/document/2.pdf", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: sample,
    }),
  );
  const operator = await context.newPage();
  const audience = await context.newPage();
  await audience.goto("/?audience");
  await operator.goto("/");
  await operator.getByRole("button", { name: "Open PDF" }).click();
  await expect(operator.locator("#live-label")).toHaveText("1 / 4");
  await expect(operator.locator("#cue-label")).toHaveText("2 / 4");
  await expect
    .poll(() =>
      audience.locator("canvas").evaluate((c: HTMLCanvasElement) => c.width),
    )
    .toBeGreaterThan(0);
  await operator.keyboard.press("ArrowRight");
  await expect(operator.locator("#cue-label")).toHaveText("3 / 4");
  await expect(operator.locator("#live-label")).toHaveText("1 / 4");
  await audience.keyboard.press("Enter");
  await expect(operator.locator("#live-label")).toHaveText("3 / 4");
  await expect(operator.locator("#cue-label")).toHaveText("4 / 4");
  await operator.keyboard.press("ArrowRight");
  await expect(operator.locator("#cue-label")).toHaveText("4 / 4");
  await audience.keyboard.press("ArrowLeft");
  await expect(operator.locator("#cue-label")).toHaveText("3 / 4");
  await audience.keyboard.press("ArrowUp");
  await expect(operator.locator("#cue-label")).toHaveText("2 / 4");
  await expect(operator.locator("#live-label")).toHaveText("3 / 4");
  await operator.keyboard.press("Enter");
  await expect(operator.locator("#live-label")).toHaveText("2 / 4");
  await audience.keyboard.press("ArrowDown");
  await expect(operator.locator("#cue-label")).toHaveText("4 / 4");
  await audience.keyboard.press("Space");
  await expect(operator.locator("#live-label")).toHaveText("4 / 4");
  await expect
    .poll(() =>
      audience.locator("canvas").evaluate((c: HTMLCanvasElement) => c.width),
    )
    .toBeGreaterThan(0);
  await context.close();
});
test("invalid PDF shows an operator error and leaves audience blank", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.route("**/document/2.pdf", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: "not a pdf",
    }),
  );
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Open PDF" }).click();
  await expect(page.locator("#status")).toContainText("Could not open PDF");
  await expect(page.locator("#take")).toBeDisabled();
  await context.close();
});
