import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import sharp from "sharp";
import { MESSAGES } from "../../src/i18n/messages";

/*
 * A Seedling-sourced seed offer, end to end through the real flows: the grower captures a photo, shares it as a public
 * Update, offers seedheads from that Seedling, and the offer appears on the Seedling page and in the seeds-filtered Search.
 * A visitor sees the public image and the sign-in gate. Another grower expresses interest, and the holder sees no
 * self-interest action. Screenshots are written to the test output folder for visual inspection.
 */

test.describe.configure({ timeout: 300_000 });

const PASSWORD = "correct-horse-battery";
const tag = "se" + Math.random().toString(36).slice(2, 8);
const EN = MESSAGES.en;
const NL = MESSAGES.nl;

async function signUp(page: Page, label: string, displayName: string, country: string) {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(`e2e-se-${label}-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Country").selectOption(country);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/profile\/setup/);
}

async function jpeg(): Promise<Buffer> {
  return sharp({ create: { width: 900, height: 600, channels: 3, background: "rgb(192,80,128)" } })
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

test("a Seedling's photo, shared publicly, lets the Seedling offer seedheads that are found through Search", async ({
  browser,
}: {
  browser: Browser;
}, testInfo) => {
  const name = `Source ${tag}`;
  const holder = await browser.newContext();
  const page = await holder.newPage();
  await signUp(page, "holder", `Holder ${tag}`, "NL");

  // 1. Capture a photo into a new seedling, through the Capture flow.
  await page.goto("/capture");
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "bloom.jpg", mimeType: "image/jpeg", buffer: await jpeg() });
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\/[0-9a-f-]{36}\?saved=1$/);
  const observation = page.url().split("?")[0]!;
  const seedlingPath = await page.locator('a[href^="/seedlings/"]').first().getAttribute("href");
  expect(seedlingPath).toMatch(/^\/seedlings\/[0-9a-f-]{36}$/);

  // 2. Share the photo as a public Update. This makes the Seedling public and gives it its public image.
  await page.goto(observation);
  await page.getByRole("link", { name: "Share selected photos" }).click();
  await page.getByRole("button", { name: "Make Seedling public & continue" }).click();
  await expect(page).toHaveURL(/\/share\?public=1/);
  await page.getByLabel("Share photo 1").check();
  await page.getByLabel("Caption (optional)").fill(`Public bloom ${tag}`);
  await page.getByRole("button", { name: "Publish update" }).click();
  await expect(page).toHaveURL(/\/updates\/[0-9a-f-]{36}\?published=1/);

  // 3. Rename the seedling so Search can find it by its working name, then offer seedheads from it.
  await page.goto(`${seedlingPath}`);
  await page.getByLabel("Working name").fill(name);
  await page.getByRole("button", { name: "Save changes" }).click();

  await page.goto(`/offers/new?seedling=${seedlingPath!.split("/").pop()}`);
  await page.getByLabel(EN.seeds.material.seedheads, { exact: true }).check();
  await page.getByLabel(EN.seeds.seedheadCount).fill("3");
  await page.getByRole("button", { name: EN.seeds.submit }).click();
  await expect(page).toHaveURL(new RegExp(`${seedlingPath}\\?seedNotice=published$`));
  await expect(page.getByText(EN.seeds.notice.published)).toBeVisible();

  // 4. The holder's view of the Seedling page: the offer reads as seedheads from this Seedling, with the owner's own list.
  const offerCard = page.locator("li", { hasText: EN.seeds.material.seedheads }).first();
  await expect(offerCard.getByText(`${EN.seeds.seedheadCount}: 3`)).toBeVisible();
  await expect(offerCard.getByText(EN.seeds.list.you)).toBeVisible();
  await expect(page.getByRole("button", { name: EN.seeds.list.interest })).toHaveCount(0);
  await expect(page.getByRole("button", { name: EN.seeds.list.close })).toBeVisible();
  await expect(page.getByRole("button", { name: /checkout|cart|buy|pay/i })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await shot(page, testInfo, "holder-seedling-offer");

  // 4b. The same grower also offers an unidentified dahlia (with its photograph) and an unknown or mixed source, so the
  // Search result can show every source state on one screen.
  await page.goto("/offers/new");
  await page.getByLabel(EN.seeds.source.unidentified, { exact: true }).check();
  await page.getByLabel(EN.seeds.description).fill(`Dark burgundy decorative ${tag}`);
  await page
    .getByLabel(EN.seeds.sourcePhoto)
    .setInputFiles({ name: "plant.jpg", mimeType: "image/jpeg", buffer: await jpeg() });
  await page.getByLabel(EN.seeds.material.seedheads, { exact: true }).check();
  await page.getByLabel(EN.seeds.seedheadCount).fill("2");
  await page.getByRole("button", { name: EN.seeds.submit }).click();
  await expect(page.getByText(EN.seeds.notice.published)).toBeVisible();
  await page.goto("/offers/new");
  await page.getByLabel(EN.seeds.source.unknownMixed, { exact: true }).check();
  await page.getByLabel(EN.seeds.material.seeds, { exact: true }).check();
  await page.getByLabel(EN.seeds.packetSize).fill("6");
  await page.getByRole("button", { name: EN.seeds.submit }).click();
  await expect(page.getByText(EN.seeds.notice.published)).toBeVisible();

  // 5. A visitor sees the public image and the sign-in gate, and no private material.
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(seedlingPath!);
  const visitorCard = visitorPage.locator("li", { hasText: EN.seeds.material.seedheads }).first();
  await expect(visitorCard.getByRole("img", { name: EN.seeds.sourcePhoto })).toBeVisible();
  await expect(visitorCard.getByRole("link", { name: EN.seeds.list.signIn })).toBeVisible();
  await expect(visitorPage.locator("main")).not.toContainText("Fixture capture");
  await expectNoHorizontalOverflow(visitorPage);
  await shot(visitorPage, testInfo, "visitor-seedling-offer");

  // 6. Another grower expresses interest with a quantity. The owner's list is theirs alone.
  const buyer = await browser.newContext();
  const buyerPage = await buyer.newPage();
  await signUp(buyerPage, "buyer", `Buyer ${tag}`, "BE");
  await buyerPage.goto(seedlingPath!);
  await buyerPage.getByLabel(EN.seeds.list.quantity).fill("two heads");
  await buyerPage.getByRole("button", { name: EN.seeds.list.interest }).click();
  await expect(buyerPage.getByText(EN.seeds.notice.interestRecorded)).toBeVisible();

  // 7. Through the one Search, the seeds filter finds the offer with its Seedling identity and public image.
  await visitorPage.goto(`/?seeds=1&q=${tag}`);
  await expect(visitorPage.getByLabel(EN.search.seedsLabel)).toBeChecked();
  const results = visitorPage.locator("main");
  await expect(results).toContainText(EN.search.groups.seedOffers);
  const found = results.locator("li", { hasText: name }).first();
  await expect(found.getByRole("link", { name })).toHaveAttribute("href", seedlingPath!);
  await expect(found.getByRole("img", { name: EN.seeds.sourcePhoto })).toBeVisible();
  // The unidentified dahlia shows its own label and the grower's description; unknown or mixed shows the other label.
  await expect(
    results
      .locator("li", { hasText: `Dark burgundy decorative ${tag}` })
      .getByText(EN.seeds.sourceName.unidentified, { exact: true }),
  ).toBeVisible();
  await expect(
    results.locator("li", { hasText: EN.seeds.sourceName.unknownMixed }).first(),
  ).toBeVisible();
  await expectNoHorizontalOverflow(visitorPage);
  await shot(visitorPage, testInfo, "visitor-search-seeds");

  // 8. Clear removes the seeds filter, and the control reflects that.
  await visitorPage.getByRole("link", { name: EN.search.clear }).click();
  await expect(visitorPage).toHaveURL(/\/$/);
  await expect(visitorPage.getByLabel(EN.search.seedsLabel)).not.toBeChecked();

  // 9. Locale switch keeps the canonical seeds filter (Dutch check on the same results).
  await visitorPage.goto(`/?seeds=1&q=${encodeURIComponent(name)}`);
  await visitorPage.locator("#language-select").selectOption("nl");
  await expect(visitorPage).toHaveURL(/seeds=1/);
  await expect(visitorPage.getByLabel(NL.search.seedsLabel)).toBeChecked();

  await visitor.close();
  await buyer.close();
  await holder.close();
});
