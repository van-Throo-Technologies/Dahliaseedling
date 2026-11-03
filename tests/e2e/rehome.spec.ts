import { expect, test, type Browser, type Page } from "@playwright/test";
import { MESSAGES } from "../../src/i18n/messages";

/*
 * Continuation, the principal happy path, in three browsers: the holder makes a private seedling available through the
 * deliberate public step; a visitor sees the availability and the sign-in gate; a second grower expresses interest;
 * the holder chooses; the chosen grower confirms receipt; the seedling keeps its address, its origin and its history.
 * The copy comes from the dictionaries, so the assertions follow wording changes.
 */

test.describe.configure({ timeout: 240_000 });

const PASSWORD = "correct-horse-battery";
const tag = "rh" + Math.random().toString(36).slice(2, 8);
const WORKING_NAME = `Continue ${tag}`;
const HOLDER = `Holder ${tag}`;
const RECIPIENT = `Recipient ${tag}`;

const R = MESSAGES.en.rehome;

async function signUp(page: Page, label: string, displayName: string, country: string) {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(`e2e-rehome-${label}-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Country").selectOption(country);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/profile\/setup/);
}

test("a seedling is made available, a grower is chosen and confirms receipt, and the identity and history stay", async ({
  browser,
  page,
}: {
  browser: Browser;
  page: Page;
}, testInfo) => {
  // Holder: a private seedling, made available through the deliberate public step.
  await signUp(page, "holder", HOLDER, "NL");
  await page.goto("/seedlings/new");
  await page.getByLabel("Working name (optional)").fill(WORKING_NAME);
  await page.getByRole("button", { name: "Create seedling" }).click();
  await expect(page).toHaveURL(/\/seedlings\/[0-9a-f-]{36}$/);
  const seedlingPath = new URL(page.url()).pathname;
  const seedlingId = seedlingPath.split("/").pop()!;

  await page.getByRole("link", { name: R.panel.notKeepingLink }).click();
  await expect(page).toHaveURL(new RegExp(`${seedlingPath}/rehome$`));
  await page.getByLabel(R.terms.donate, { exact: true }).check();
  await page.getByLabel(R.start.handoverLegend).selectOption("pickup");
  await page.getByLabel(R.start.makePublicLabel).check();
  await page.getByLabel(R.start.understand).check();
  await page.getByRole("button", { name: R.start.submit }).click();
  await expect(page).toHaveURL(new RegExp(`${seedlingPath}\\?rehome=started$`));
  await expect(page.getByText(R.notice.started)).toBeVisible();

  // Visitor with no account: the availability and terms are visible, with a sign-in gate for interest.
  const visitor = await browser.newContext({ ...testInfo.project.use });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(seedlingPath);
  await expect(visitorPage.getByRole("heading", { name: R.panel.availableTitle })).toBeVisible();
  await expect(visitorPage.getByRole("link", { name: R.panel.signInToInterest })).toBeVisible();
  await expect(visitorPage.getByText(HOLDER).first()).toBeVisible();
  await visitor.close();

  // Second grower: expresses interest. Nothing transfers.
  const second = await browser.newContext({ ...testInfo.project.use });
  const secondPage = await second.newPage();
  await signUp(secondPage, "recipient", RECIPIENT, "BE");
  await secondPage.goto(seedlingPath);
  await secondPage.getByRole("button", { name: R.panel.expressInterest }).click();
  await expect(secondPage.getByText(R.notice.interestRecorded)).toBeVisible();

  // Holder: sees the interested grower, chooses them. The holder remains the holder.
  await page.goto(seedlingPath);
  await expect(page.getByText(RECIPIENT).first()).toBeVisible();
  await page.getByRole("button", { name: R.panel.choose }).click();
  await expect(page.getByText(R.notice.chosen)).toBeVisible();
  await expect(page.getByRole("heading", { name: R.panel.chosenTitle })).toBeVisible();

  // Recipient: the receipt action is theirs alone. Confirming transfers the holder.
  await secondPage.goto(seedlingPath);
  await secondPage.getByRole("link", { name: R.panel.confirmReceiptLink }).click();
  await expect(secondPage).toHaveURL(new RegExp(`${seedlingPath}/receive$`));
  await secondPage.getByRole("button", { name: R.receive.submit }).click();
  await expect(secondPage).toHaveURL(new RegExp(`${seedlingPath}\\?rehome=received$`));
  await expect(secondPage.getByText(R.notice.received)).toBeVisible();

  // The same seedling: the same address, the originator unchanged, and the transfer in its history.
  await expect(secondPage.getByRole("heading", { name: WORKING_NAME })).toBeVisible();
  await expect(secondPage.getByText(/Continued on /).first()).toBeVisible();
  await expect(secondPage.getByText(RECIPIENT).first()).toBeVisible();
  await expect(secondPage.getByText(HOLDER).first()).toBeVisible();
  expect(new URL(secondPage.url()).pathname.startsWith(seedlingPath)).toBe(true);
  expect(seedlingId).toMatch(/^[0-9a-f-]{36}$/);

  // The completed seedling is no longer offered as available.
  await visitorPageCheck(browser, testInfo, seedlingPath);

  await second.close();
});

async function visitorPageCheck(
  browser: Browser,
  testInfo: { project: { use: object } },
  seedlingPath: string,
) {
  const context = await browser.newContext({ ...testInfo.project.use });
  const page = await context.newPage();
  await page.goto(seedlingPath);
  await expect(page.getByRole("heading", { name: R.panel.availableTitle })).toHaveCount(0);
  await context.close();
}
