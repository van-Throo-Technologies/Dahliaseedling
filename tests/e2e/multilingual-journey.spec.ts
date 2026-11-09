import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { MESSAGES } from "../../src/i18n/messages";

/*
 * One signed-in journey that switches language on real data. The application language changes around the content;
 * the stored content never does. The identifier is read from the page rather than assumed, because a new Series starts
 * at its first number. The helpers are copies of the ones in publications.spec.ts, which keeps each spec self-contained.
 */

test.describe.configure({ timeout: 180_000 });

const PASSWORD = "correct-horse-battery";
const WORKING_NAME = "Sunset Surprise";
const CULTIVAR = "Wizard of Oz";
const CAPTION = "First flower after the storm.";
const COMMENT = "I love the shape of this one.";

function uniqueEmail(label: string): string {
  return `e2e-lang-${label}-${crypto.randomUUID()}@example.test`;
}

async function signUpAndSetUpProfile(page: Page, label: string, displayName: string) {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(uniqueEmail(label));
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Country").selectOption("NL");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/profile$/);
}

async function makePhoto(): Promise<Buffer> {
  return sharp({ create: { width: 900, height: 600, channels: 3, background: "rgb(192,80,128)" } })
    .jpeg()
    .toBuffer();
}

async function captureOnePhoto(page: Page, photo: Buffer): Promise<string> {
  await page.goto("/capture");
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "bloom.jpg", mimeType: "image/jpeg", buffer: photo });
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\/[0-9a-f-]{36}/);
  return page.url().split("?")[0]!;
}

async function shareOnePhoto(page: Page, observationUrl: string, caption: string): Promise<string> {
  await page.goto(observationUrl);
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

async function switchLanguage(page: Page, from: "en" | "nl" | "fr", to: "en" | "nl" | "fr") {
  await page.getByLabel(MESSAGES[from].app.language.label).selectOption(to);
  await expect(page.locator("html")).toHaveAttribute("lang", to);
}

/** The stored content a grower entered. Each value must read exactly the same in every language. */
async function expectStoredSeedlingContent(page: Page, identifier: string) {
  await expect(page.getByRole("heading", { level: 1, name: WORKING_NAME })).toBeVisible();
  await expect(page.getByText(identifier).first()).toBeVisible();
  await expect(page.getByText(CULTIVAR).first()).toBeVisible();
}

test("a signed-in grower switches language across pages, and the stored content never changes", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "grower", "Lang Grower");

  // A Series, then a Seedling numbered by it, with a working name.
  await page.goto("/series");
  await page.getByLabel("Series name").fill("jv");
  await page.getByRole("button", { name: "Create series" }).click();
  await expect(page.getByRole("status")).toContainText("Series JV is ready");

  await page.goto("/seedlings/new");
  await page.getByLabel("Numbering").selectOption({ label: "Series JV (uses the year)" });
  await page.getByLabel("Working name (optional)").fill(WORKING_NAME);
  await page.getByLabel("First grown year (optional)").fill("2024");
  await page.getByRole("button", { name: "Create seedling" }).click();
  await expect(page).toHaveURL(/\/seedlings\/[0-9a-f-]{36}$/);
  const seedlingUrl = page.url();

  // The identifier is whatever the Series issued; it is read here and then compared, never assumed.
  const identifierText = await page
    .getByRole("listitem")
    .filter({ hasText: /^JV-\d{2}-\d{3}/ })
    .first()
    .innerText();
  const identifier = identifierText.match(/JV-\d{2}-\d{3}/)![0];

  // The cultivar, entered as this seedling's seed parent.
  const parentForm = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: /save seed parent/i }) });
  await parentForm.getByLabel("How is it known?").selectOption({ label: "A named cultivar" });
  await parentForm.getByLabel("Cultivar name").fill(CULTIVAR);
  await parentForm.getByRole("button", { name: /save seed parent/i }).click();
  await expect(page.getByRole("status")).toContainText(MESSAGES.en.seedlings.parent.saved);

  // An Update with a caption, and a comment on it.
  const observation = await captureOnePhoto(page, await makePhoto());
  const updateUrl = await shareOnePhoto(page, observation, CAPTION);
  await page.goto(updateUrl);
  await page.locator("summary", { hasText: MESSAGES.en.publication.comments.add }).click();
  await page
    .getByLabel(MESSAGES.en.publication.comments.yourComment, { exact: true })
    .fill(COMMENT);
  await page.getByRole("button", { name: MESSAGES.en.publication.comments.post }).click();
  await expect(page.getByText(COMMENT).first()).toBeVisible();

  // English baseline on the Seedling.
  await page.goto(seedlingUrl);
  await expectStoredSeedlingContent(page, identifier);

  // English to Dutch on the Seedling page: the address stays, the content stays, the interface changes.
  await switchLanguage(page, "en", "nl");
  expect(page.url()).toBe(seedlingUrl);
  await expectStoredSeedlingContent(page, identifier);
  await expect(page.getByText(MESSAGES.nl.seedlings.page.parentage, { exact: true })).toBeVisible();

  // Refresh keeps Dutch, and the Update keeps its caption and comment in Dutch.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "nl");
  await page.goto(updateUrl);
  await expect(page.getByText(CAPTION).first()).toBeVisible();
  await expect(page.getByText(COMMENT).first()).toBeVisible();
  await expect(
    page.locator("summary", { hasText: MESSAGES.nl.publication.comments.add }),
  ).toBeVisible();

  // Dutch to French on the Update, then the Seedling again.
  await switchLanguage(page, "nl", "fr");
  await expect(page.getByText(CAPTION).first()).toBeVisible();
  await expect(page.getByText(COMMENT).first()).toBeVisible();
  await expect(
    page.locator("summary", { hasText: MESSAGES.fr.publication.comments.add }),
  ).toBeVisible();

  await page.goto(seedlingUrl);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expectStoredSeedlingContent(page, identifier);
  await expect(page.getByText(MESSAGES.fr.seedlings.page.parentage, { exact: true })).toBeVisible();

  // Posting stays in French: the Feed composer is in French, and opening it stays in French.
  await page.goto("/");
  await page.getByRole("link", { name: MESSAGES.fr.publication.feed.createPrompt }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");

  // Back to English: the application changes, the stored content does not.
  await switchLanguage(page, "fr", "en");
  await page.goto(seedlingUrl);
  await expectStoredSeedlingContent(page, identifier);
  await expect(page.getByText(MESSAGES.en.seedlings.page.parentage, { exact: true })).toBeVisible();
});
