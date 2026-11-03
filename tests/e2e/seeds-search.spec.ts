import { expect, test, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";
import { MESSAGES } from "../../src/i18n/messages";

/*
 * Seed and seedhead offers in the one Home Search. A visitor finds a live offer with the seeds filter, sees each source
 * state honestly, and loses a closed offer from the results. The filter survives a locale switch, Clear resets it, and no
 * Explore or marketplace destination appears. Copy comes from the dictionary.
 */

test.describe.configure({ timeout: 240_000 });

const PASSWORD = "correct-horse-battery";
const tag = "sf" + Math.random().toString(36).slice(2, 8);
const EN = MESSAGES.en;
const NL = MESSAGES.nl;

async function signUp(page: Page, label: string, displayName: string, country: string) {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(`e2e-sf-${label}-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Country").selectOption(country);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/profile\/setup/);
}

async function photo(): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const buffer = await sharp({
    create: { width: 640, height: 480, channels: 3, background: "rgb(90,20,60)" },
  })
    .jpeg()
    .toBuffer();
  return { name: "plant.jpg", mimeType: "image/jpeg", buffer };
}

test("a live seed offer is found through the one Search, shows its honest source, and disappears when closed", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const grower = await browser.newContext();
  const page = await grower.newPage();
  await signUp(page, "grower", `Zaad ${tag}`, "NL");

  // An unidentified dahlia, with its photograph and the grower's own description.
  await page.goto("/offers/new");
  await page.getByLabel(EN.seeds.source.unidentified, { exact: true }).check();
  await page.getByLabel(EN.seeds.description).fill(`Dark burgundy decorative ${tag}`);
  await page.getByLabel(EN.seeds.sourcePhoto).setInputFiles(await photo());
  await page.getByLabel(EN.seeds.material.seedheads, { exact: true }).check();
  await page.getByLabel(EN.seeds.seedheadCount).fill("3");
  await page.getByRole("button", { name: EN.seeds.submit }).click();
  await expect(page.getByText(EN.seeds.notice.published)).toBeVisible();
  const profilePath = new URL(page.url()).pathname;

  // A visitor finds it through the one Search, with the seeds filter.
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`/?seeds=1&q=${tag}`);
  await expect(visitorPage.getByLabel(EN.search.seedsLabel)).toBeChecked();
  await expect(visitorPage.locator("main")).toContainText(EN.search.groups.seedOffers);
  const main = visitorPage.locator("main");
  await expect(main.getByText(`Dark burgundy decorative ${tag}`)).toBeVisible();
  await expect(
    main.getByText(EN.seeds.sourceName.unidentified, { exact: true }).first(),
  ).toBeVisible();
  await expect(main.getByRole("img", { name: EN.seeds.sourcePhoto }).first()).toBeVisible();
  // No Explore or marketplace destination appears anywhere on the page.
  await expect(visitorPage.getByRole("link", { name: /explore|marketplace/i })).toHaveCount(0);

  // The grower closes the offer: it leaves the results.
  await page.goto(profilePath);
  await page.getByRole("button", { name: EN.seeds.list.close }).click();
  await expect(page.getByText(EN.seeds.notice.closed)).toBeVisible();
  await visitorPage.goto(`/?seeds=1&q=${tag}`);
  await expect(visitorPage.locator("main")).not.toContainText(`Dark burgundy decorative ${tag}`);

  await visitor.close();
  await grower.close();
});

test("unknown or mixed and unidentified dahlia stay distinct in Dutch, and the Dutch filter survives a locale switch", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const grower = await browser.newContext();
  const page = await grower.newPage();
  await signUp(page, "dutch", `Nederlands ${tag}`, "NL");

  await page.goto("/offers/new");
  await page.getByLabel(EN.seeds.source.unknownMixed, { exact: true }).check();
  await page.getByLabel(EN.seeds.material.seeds, { exact: true }).check();
  await page.getByLabel(EN.seeds.packetSize).fill("8");
  await page.getByRole("button", { name: EN.seeds.submit }).click();
  await expect(page.getByText(EN.seeds.notice.published)).toBeVisible();

  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`/?seeds=1&q=${tag}`);
  await visitorPage.locator("#language-select").selectOption("nl");
  await expect(visitorPage).toHaveURL(/seeds=1/);
  await expect(visitorPage.getByLabel(NL.search.seedsLabel)).toBeChecked();
  await expect(visitorPage.locator("main")).toContainText(NL.search.groups.seedOffers);
  // The unknown or mixed source reads in Dutch as its own label, distinct from the unidentified dahlia's.
  await expect(
    visitorPage
      .locator("main")
      .getByText(NL.seeds.sourceName.unknownMixed, { exact: true })
      .first(),
  ).toBeVisible();
  expect(NL.seeds.sourceName.unidentified).not.toBe(NL.seeds.sourceName.unknownMixed);

  // Clear removes the seeds filter, and the address returns to the Feed.
  await visitorPage.getByRole("link", { name: NL.search.clear }).click();
  await expect(visitorPage).toHaveURL(/\/$/);
  await expect(visitorPage.getByLabel(NL.search.seedsLabel)).not.toBeChecked();

  await visitor.close();
  await grower.close();
});
