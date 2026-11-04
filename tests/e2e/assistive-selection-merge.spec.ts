import { expect, test, type Page, type TestInfo } from "@playwright/test";
import sharp from "sharp";
import { MESSAGES } from "../../src/i18n/messages";

/*
 * Phase 9 in the browser. A Capture asks "Which Seedling is this?" and attaches only to the Seedling the grower chooses. A wrong
 * attachment is corrected without re-uploading the photo. Two Seedlings of the same holder can be merged after an irreversible
 * confirmation, and a merge blocked by an active continuation changes nothing and says why. No voice engine or external service is
 * used: dictation needs the browser's speech engine, which automated tests do not have, so command rules are covered by unit tests.
 */

test.describe.configure({ timeout: 300_000 });

const PASSWORD = "correct-horse-battery";
const tag = "as" + Math.random().toString(36).slice(2, 8);
const EN = MESSAGES.en;

async function jpeg(): Promise<Buffer> {
  return sharp({ create: { width: 800, height: 600, channels: 3, background: "rgb(120,60,140)" } })
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
  await page.getByLabel("Email").fill(`e2e-as-${label}-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(`Grower ${tag}`);
  await page.getByLabel("Country").selectOption("NL");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/profile\/setup/);
}

/** Saves a private capture as a new Seedling and returns the Observation and the Seedling it was attached to. */
async function captureNew(
  page: Page,
  name: string,
): Promise<{ observation: string; seedling: string }> {
  await page.goto("/capture");
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: `${name}.jpg`, mimeType: "image/jpeg", buffer: await jpeg() });
  await page.getByRole("button", { name: EN.capture.capture.save }).click();
  await expect(page).toHaveURL(/\/observations\/[0-9a-f-]{36}\?saved=1$/);
  const observation = new URL(page.url()).pathname.replace(/\?.*$/, "");
  const seedling = await page.locator('a[href^="/seedlings/"]').first().getAttribute("href");
  return { observation, seedling: seedling! };
}

test("a Capture asks which Seedling it is, the grower chooses one of their own, and it saves privately", async ({
  page,
}, testInfo) => {
  await signUp(page, "choose");
  const first = await captureNew(page, "first");

  await page.goto("/capture");
  await expect(page.getByText(EN.assistive.capture.question, { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: EN.capture.capture.existing }).check();
  await expect(page.getByLabel(EN.assistive.capture.searchLabel, { exact: true })).toBeVisible();
  await expect(page.getByText("Possible match")).toHaveCount(0);
  await expect(page.getByText("Likely match")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await shot(page, testInfo, "capture-which-seedling");

  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "second.jpg", mimeType: "image/jpeg", buffer: await jpeg() });
  await page.getByRole("button", { name: EN.capture.capture.save }).click();
  await expect(page).toHaveURL(/\/observations\/[0-9a-f-]{36}\?saved=1$/);
  const attached = await page.locator('a[href^="/seedlings/"]').first().getAttribute("href");
  expect(attached).toBe(first.seedling);
});

test("a Capture with New Seedling creates a new Seedling and saves privately", async ({ page }) => {
  await signUp(page, "new");
  const created = await captureNew(page, "fresh");
  expect(created.seedling).toMatch(/^\/seedlings\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/Saved privately/).first()).toBeVisible();
});

test("a wrong attachment is corrected without re-uploading the photo, and the Observation keeps its identity", async ({
  page,
}) => {
  await signUp(page, "change");
  const wrong = await captureNew(page, "wrong");
  const photoBefore = await page
    .getByRole("img", { name: EN.capture.observation.yourPhoto })
    .first()
    .getAttribute("src");

  await page.getByRole("link", { name: EN.capture.observation.change }).click();
  await expect(page).toHaveURL(new RegExp(`${wrong.observation}/move$`));
  await page.getByRole("radio", { name: EN.capture.move.newSeedling }).check();
  await page.getByRole("button", { name: EN.capture.move.submit }).click();

  await expect(page).toHaveURL(new RegExp(`${wrong.observation}\\?moved=1$`));
  await expect(page.getByText(EN.capture.move.moved)).toBeVisible();
  expect(
    await page
      .getByRole("img", { name: EN.capture.observation.yourPhoto })
      .first()
      .getAttribute("src"),
  ).toBe(photoBefore);
});

test("two Seedlings of the same holder merge after an irreversible confirmation, and the duplicate leads to the canonical Seedling", async ({
  page,
}, testInfo) => {
  await signUp(page, "merge");
  const keep = await captureNew(page, "keep");
  const duplicate = await captureNew(page, "duplicate");
  await page.goto(keep.seedling);

  await page.getByRole("link", { name: EN.assistive.merge.open }).click();
  await expect(page.getByText(EN.assistive.merge.warning)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, testInfo, "merge-confirmation");

  await page.getByRole("radio").first().check();
  await page.getByRole("radio", { name: EN.assistive.merge.keepThis }).check();
  await page.getByRole("checkbox", { name: EN.assistive.merge.confirm }).check();
  await page.getByRole("button", { name: EN.assistive.merge.submit }).click();

  await expect(page).toHaveURL(new RegExp(`${keep.seedling}\\?mergeNotice=done$`));
  await expect(page.getByText(EN.assistive.merge.done)).toBeVisible();

  await page.goto(duplicate.seedling);
  await expect(page).toHaveURL(new RegExp(`${keep.seedling}$`));
});

test("a merge blocked by an active continuation changes nothing and says why", async ({ page }) => {
  await signUp(page, "blocked");
  const kept = await captureNew(page, "kept");
  const blocked = await captureNew(page, "blocked");
  await page.goto(`${blocked.seedling}/rehome`);
  await page.getByLabel(MESSAGES.en.rehome.terms.donate, { exact: true }).check();
  await page.getByLabel(MESSAGES.en.rehome.start.handoverLegend).selectOption("pickup");
  await page.getByLabel(MESSAGES.en.rehome.start.makePublicLabel).check();
  await page.getByLabel(MESSAGES.en.rehome.start.understand).check();
  await page.getByRole("button", { name: MESSAGES.en.rehome.start.submit }).click();

  await page.goto(`${kept.seedling}/merge`);
  await page.getByRole("radio").first().check();
  await page.getByRole("radio", { name: EN.assistive.merge.keepThis }).check();
  await page.getByRole("checkbox", { name: EN.assistive.merge.confirm }).check();
  await page.getByRole("button", { name: EN.assistive.merge.submit }).click();
  await expect(
    page.getByText(EN.assistive.merge.errors.continuation, { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: EN.assistive.merge.title })).toBeVisible();
});
