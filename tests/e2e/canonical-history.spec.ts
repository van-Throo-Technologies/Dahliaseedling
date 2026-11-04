import { expect, test, type Page, type TestInfo } from "@playwright/test";
import sharp from "sharp";
import { MESSAGES } from "../../src/i18n/messages";

/*
 * Canonical Update history in the browser (Phase 9). Two Seedlings of one grower each have a public Update. After the merge is
 * confirmed, the canonical Seedling shows both Updates once each, and the retired Update still opens at its own address.
 * Comments and likes are checked in the database tests, where they are attached by Update id.
 */

test.describe.configure({ timeout: 300_000 });

const PASSWORD = "correct-horse-battery";
const tag = "ch" + Math.random().toString(36).slice(2, 8);
const EN = MESSAGES.en;

async function jpeg(): Promise<Buffer> {
  return sharp({ create: { width: 900, height: 600, channels: 3, background: "rgb(90,140,110)" } })
    .jpeg()
    .toBuffer();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(0);
}

async function shot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

async function signUp(page: Page, label: string) {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(`e2e-ch-${label}-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(`Grower ${tag}`);
  await page.getByLabel("Country").selectOption("NL");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/profile\/setup/);
}

/** Captures one photo as a new Seedling and returns the Observation address and the Seedling address it was attached to. */
async function captureNew(page: Page): Promise<{ observation: string; seedling: string }> {
  await page.goto("/capture");
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "bloom.jpg", mimeType: "image/jpeg", buffer: await jpeg() });
  await page.getByRole("button", { name: EN.capture.capture.save }).click();
  await expect(page).toHaveURL(/\/observations\/[0-9a-f-]{36}\?saved=1$/);
  const observation = new URL(page.url()).pathname.replace(/\?.*$/, "");
  const seedling = await page.locator('a[href^="/seedlings/"]').first().getAttribute("href");
  return { observation, seedling: seedling! };
}

/** Shares the Observation's photo as a public Update with a caption, and returns the Update address. */
async function shareOnePhoto(page: Page, observation: string, caption: string): Promise<string> {
  await page.goto(observation);
  await page.getByRole("link", { name: "Share selected photos" }).click();
  await expect(page).toHaveURL(/\/share$/);
  await page.getByRole("button", { name: "Make Seedling public & continue" }).click();
  await expect(page).toHaveURL(/\/share\?public=1/);
  await page.getByLabel("Share photo 1").check();
  await page.getByLabel("Caption (optional)").fill(caption);
  await page.getByRole("button", { name: "Publish update" }).click();
  await expect(page).toHaveURL(/\/updates\/[0-9a-f-]{36}\?published=1/);
  return page.url().split("?")[0]!;
}

test("after a merge, the canonical Seedling shows both public Updates once, and the retired Update still opens", async ({
  page,
}, testInfo) => {
  await signUp(page, "history");

  const first = await captureNew(page);
  const firstCaption = `Keep bloom ${tag}`;
  await shareOnePhoto(page, first.observation, firstCaption);

  const second = await captureNew(page);
  const secondCaption = `Duplicate bloom ${tag}`;
  const secondUpdate = await shareOnePhoto(page, second.observation, secondCaption);

  await page.goto(first.seedling);
  await page.getByRole("link", { name: EN.assistive.merge.open }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("radio", { name: EN.assistive.merge.keepThis }).check();
  await page.getByRole("checkbox", { name: EN.assistive.merge.confirm }).check();
  await page.getByRole("button", { name: EN.assistive.merge.submit }).click();
  await expect(page).toHaveURL(new RegExp(`${first.seedling}\\?mergeNotice=done$`));

  // The canonical Seedling shows the history of both, each Update exactly once.
  await expectNoHorizontalOverflow(page);
  await expect(page.getByText(firstCaption, { exact: true })).toHaveCount(1);
  await expect(page.getByText(secondCaption, { exact: true })).toHaveCount(1);
  await shot(page, testInfo, "canonical-history");

  // The retired Update keeps its own address and its caption.
  await page.goto(secondUpdate);
  await expect(page.getByText(secondCaption, { exact: true })).toBeVisible();
  await expect(page).toHaveURL(secondUpdate);
});
