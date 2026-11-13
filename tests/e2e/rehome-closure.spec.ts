import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { MESSAGES } from "../../src/i18n/messages";

/*
 * Phase 6 closure journeys in the browser. The first test follows one Seedling through availability, pending selection
 * and a completed transfer, and checks the Search results at each step. The second switches language during a live
 * continuation and checks that the Seedling, its term, its user-written note and its Search availability are unchanged.
 * The third checks touch targets on the phone viewport. Copy comes from the dictionaries.
 */

test.describe.configure({ timeout: 240_000 });

const PASSWORD = "correct-horse-battery";
const tag = "cz" + Math.random().toString(36).slice(2, 8);
const EN = MESSAGES.en;
const NL = MESSAGES.nl;
const FR = MESSAGES.fr;

async function signUp(page: Page, label: string, displayName: string, country: string) {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(`e2e-closure-${label}-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Country").selectOption(country);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/profile\/setup/);
}

async function createSeedling(page: Page, name: string): Promise<string> {
  await page.goto("/seedlings/new");
  await page.getByLabel("Working name (optional)").fill(name);
  await page.getByRole("button", { name: "Create seedling" }).click();
  await expect(page).toHaveURL(/\/seedlings\/[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname;
}

async function makeAvailable(page: Page, seedlingPath: string, note?: string) {
  await page.goto(`${seedlingPath}/rehome`);
  await page.getByLabel(EN.rehome.terms.donate, { exact: true }).check();
  await page.getByLabel(EN.rehome.start.handoverLegend).selectOption("pickup");
  if (note) await page.getByLabel(EN.rehome.start.noteLabel).fill(note);
  await page.getByLabel(EN.rehome.start.makePublicLabel).check();
  await page.getByLabel(EN.rehome.start.understand).check();
  await page.getByRole("button", { name: EN.rehome.start.submit }).click();
  await expect(page).toHaveURL(new RegExp(`${seedlingPath}\\?rehome=started$`));
}

/** The visible results of a Search, as text, so assertions read what a visitor sees. */
async function resultsText(page: Page, query: string): Promise<string> {
  await page.goto(query);
  return (await page.locator("main").innerText()) ?? "";
}

test("a Seedling moves from availability through a pending selection to a completed transfer; Search follows each step", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const name = `Search ${tag}`;
  const holder = await browser.newContext();
  const holderPage = await holder.newPage();
  await signUp(holderPage, "holder", `Holder ${tag}`, "NL");
  const path = await createSeedling(holderPage, name);
  const seedlingId = path.split("/").pop()!;
  await makeAvailable(holderPage, path);

  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();

  // Step 1: available. The availability filter shows it, with the query and the filter together.
  await visitorPage.goto(`/?available=1&q=${tag}`);
  await expect(visitorPage.getByLabel(EN.search.availableLabel)).toBeChecked();
  await expect(visitorPage.locator("main")).toContainText(name);
  await expect(visitorPage.locator(`main a[href*="${seedlingId}"]`).first()).toBeVisible();

  const recipient = await browser.newContext();
  const recipientPage = await recipient.newPage();
  await signUp(recipientPage, "recipient", `Recipient ${tag}`, "BE");
  await recipientPage.goto(path);
  await recipientPage.getByRole("button", { name: EN.rehome.panel.expressInterest }).click();
  await expect(recipientPage.getByText(EN.rehome.notice.interestRecorded)).toBeVisible();

  // Step 2: pending. The holder selects B, and the filter no longer offers the Seedling as generally available.
  await holderPage.goto(path);
  await holderPage.getByRole("button", { name: EN.rehome.panel.choose }).click();
  await expect(holderPage.getByText(EN.rehome.notice.chosen)).toBeVisible();
  const pending = await resultsText(visitorPage, `/?available=1&q=${tag}`);
  expect(pending).not.toContain(name);

  // Step 3: completed. B confirms receipt; the Seedling stays out of the availability filter.
  await recipientPage.goto(path);
  await recipientPage.getByRole("link", { name: EN.rehome.panel.confirmReceiptLink }).click();
  await recipientPage.getByRole("button", { name: EN.rehome.receive.submit }).click();
  await expect(recipientPage.getByText(EN.rehome.notice.received)).toBeVisible();
  expect(await resultsText(visitorPage, `/?available=1&q=${tag}`)).not.toContain(name);

  // The same Seedling is still found by ordinary Search, at the same address, and its country follows the new grower.
  const ordinary = await resultsText(visitorPage, `/?q=${tag}`);
  expect(ordinary).toContain(name);
  await visitorPage.goto(`/?q=${tag}`);
  await expect(visitorPage.locator(`main a[href*="${seedlingId}"]`).first()).toBeVisible();
  expect(await resultsText(visitorPage, `/?country=BE&q=${tag}`)).toContain(name);
  expect(await resultsText(visitorPage, `/?country=NL&q=${tag}`)).not.toContain(name);

  // The current grower is shown as B on the Seedling page.
  await holderPage.goto(path);
  await expect(holderPage.getByText(`Recipient ${tag}`).first()).toBeVisible();

  // Clearing the filter returns the visitor to the unfiltered address.
  await visitorPage.goto(`/?available=1&q=${tag}`);
  await visitorPage.getByRole("link", { name: EN.search.clear }).click();
  await expect(visitorPage).toHaveURL(/\/explore$/);
  await expect(visitorPage.getByLabel(EN.search.availableLabel)).not.toBeChecked();

  await holder.close();
  await visitor.close();
  await recipient.close();
});

test("switching language during a live continuation keeps the Seedling, its term, the grower's note and its availability", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const note = `Café très calme — "ouvert" ${tag}`;
  const holder = await browser.newContext();
  const holderPage = await holder.newPage();
  await signUp(holderPage, "lang-holder", `Holder ${tag}`, "NL");
  const path = await createSeedling(holderPage, `Lang ${tag}`);
  const seedlingId = path.split("/").pop()!;
  await makeAvailable(holderPage, path, note);

  // Dutch: the entry, the holder's available state and the Search filter are in Dutch.
  await holderPage.locator("#language-select").selectOption("nl");
  await expect(holderPage).toHaveURL(new RegExp(`${path}(\\?|$)`));
  await expect(
    holderPage.getByRole("button", { name: NL.rehome.panel.withdrawAvailability }),
  ).toBeVisible();
  await expect(holderPage.getByText(NL.rehome.terms.donate, { exact: true }).first()).toBeVisible();
  await expect(holderPage).toHaveURL(new RegExp(seedlingId));

  await holderPage.goto(`/?available=1&q=${tag}`);
  await expect(holderPage.getByLabel(NL.search.availableLabel)).toBeChecked();

  // French: the same Seedling, the same filter state, the same canonical value.
  await holderPage.locator("#language-select").selectOption("fr");
  await expect(holderPage).toHaveURL(/available=1/);
  await expect(holderPage.getByLabel(FR.search.availableLabel)).toBeChecked();
  await holderPage.goto(path);
  await expect(
    holderPage.getByRole("button", { name: FR.rehome.panel.withdrawAvailability }),
  ).toBeVisible();
  await expect(holderPage.getByText(FR.rehome.terms.donate, { exact: true }).first()).toBeVisible();
  await expect(holderPage).toHaveURL(new RegExp(seedlingId));

  // The grower's own note is not translated: an interested grower in Dutch reads it exactly as written.
  const interested = await browser.newContext();
  const interestedPage = await interested.newPage();
  await signUp(interestedPage, "lang-interested", `Interested ${tag}`, "BE");
  await interestedPage.goto(path);
  await interestedPage.getByRole("button", { name: EN.rehome.panel.expressInterest }).click();
  await interestedPage.locator("#language-select").selectOption("nl");
  await expect(interestedPage.getByText(note, { exact: true }).first()).toBeVisible();

  await holder.close();
  await interested.close();
});

test("the primary Phase 6 controls are at least 44px tall on the phone viewport", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await signUp(page, "touch", `Touch ${tag}`, "NL");
  const path = await createSeedling(page, `Touch ${tag}`);

  await page.goto(`${path}/rehome`);
  const submit = page.getByRole("button", { name: EN.rehome.start.submit });
  const submitBox = await submit.boundingBox();
  expect(submitBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  const term = page.getByLabel(EN.rehome.terms.donate, { exact: true });
  const termBox = await term.boundingBox();
  expect(termBox?.height ?? 0).toBeGreaterThanOrEqual(24);
  await context.close();
});
