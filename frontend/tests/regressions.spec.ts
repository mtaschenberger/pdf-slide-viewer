import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const sample = readFileSync(resolve("../sample/four-slides.pdf"));
test.beforeEach(async ({ page }) => {
  await page.route("**/document/2.pdf", (r) =>
    r.fulfill({ contentType: "application/pdf", body: sample }),
  );
});
test("cue-only updates never clear the live canvas", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open PDF" }).click();
  await expect(page.locator("#live-label")).toHaveText("1 / 4");
  await expect
    .poll(() =>
      page.locator("#live-canvas").evaluate((c: HTMLCanvasElement) => c.width),
    )
    .toBeGreaterThan(0);
  await page.locator("#live-canvas").evaluate((c) => {
    c.dataset.mutations = "0";
    new MutationObserver((records) => {
      c.dataset.mutations = String(
        Number(c.dataset.mutations) + records.length,
      );
    }).observe(c, { attributes: true, attributeFilter: ["width", "height"] });
  });
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#cue-label")).toHaveText("3 / 4");
  await page.waitForTimeout(200);
  await expect(page.locator("#live-canvas")).toHaveAttribute(
    "data-mutations",
    "0",
  );
});
test("rapid move and take preserve keyboard order", async ({ page }) => {
  await page.goto("/?delayMove=150");
  await page.getByRole("button", { name: "Open PDF" }).click();
  await expect(page.locator("#live-label")).toHaveText("1 / 4");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.locator("#live-label")).toHaveText("3 / 4");
});
test("Enter in cue input applies typed page and takes it live", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open PDF" }).click();
  await expect(page.locator("#live-label")).toHaveText("1 / 4");
  await page.locator("#page").fill("4");
  await page.locator("#page").press("Enter");
  await expect(page.locator("#live-label")).toHaveText("4 / 4");
});
