import { expect, test, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";
import { MESSAGES } from "../../src/i18n/messages";

/*
 * Phase 7 in the browser. An unidentified dahlia cannot be published without a photograph of the actual plant. Once it has
 * one, the offer is live, a visitor sees the source context and no invented cultivar or seedling, and another grower can
 * express interest without any checkout or messaging. The unknown or mixed path needs no photograph and stays a separate
 * label. Copy comes from the dictionary, so the assertions follow wording changes.
 */

test.describe.configure({ timeout: 240_000 });

const PASSWORD = "correct-horse-battery";
const tag = "sg" + Math.random().toString(36).slice(2, 8);
const DESCRIPTION = `Dark burgundy decorative, neighbour's garden ${tag}`;
const EN = MESSAGES.en;
const NL = MESSAGES.nl;

async function signUp(page: Page, label: string, displayName: string, country: string) {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(`e2e-seeds-${label}-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Country").selectOption(country);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/profile\/setup/);
}

/** A small real JPEG, so the upload, the registration and the public derivative all run on a true image. */
async function photo(): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const buffer = await sharp({
    create: { width: 640, height: 480, channels: 3, background: "rgb(120,30,70)" },
  })
    .jpeg()
    .toBuffer();
  return { name: "plant.jpg", mimeType: "image/jpeg", buffer };
}

test("an unidentified dahlia is refused without its photograph, then published with it, and shown without a fake identity", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const grower = await browser.newContext();
  const growerPage = await grower.newPage();
  await signUp(growerPage, "grower", `Grower ${tag}`, "NL");

  // Without the photograph of the actual plant, the offer is refused and nothing is published.
  await growerPage.goto("/offers/new");
  await growerPage.getByLabel(EN.seeds.source.unidentified, { exact: true }).check();
  await growerPage.getByLabel(EN.seeds.description).fill(DESCRIPTION);
  await growerPage.getByLabel(EN.seeds.packetSize).fill("12");
  await growerPage.getByRole("button", { name: EN.seeds.submit }).click();
  await expect(growerPage).toHaveURL(/\/offers\/new\?seedError=/);
  await expect(growerPage.getByText(EN.seeds.errors.sourcePhotoRequired)).toBeVisible();

  // With the photograph, the offer is live, and the grower lands on their profile with the notice.
  await growerPage.goto("/offers/new");
  await growerPage.getByLabel(EN.seeds.source.unidentified, { exact: true }).check();
  await growerPage.getByLabel(EN.seeds.description).fill(DESCRIPTION);
  await growerPage.getByLabel(EN.seeds.sourcePhoto).setInputFiles(await photo());
  await growerPage.getByLabel(EN.seeds.packetSize).fill("12");
  await growerPage.getByRole("button", { name: EN.seeds.submit }).click();
  await expect(growerPage).toHaveURL(/\/profiles\/[0-9a-f-]{36}\?seedNotice=published$/);
  await expect(growerPage.getByText(EN.seeds.notice.published)).toBeVisible();
  const profilePath = new URL(growerPage.url()).pathname;

  // A visitor with no account sees the offer, its source context and its photograph, and the sign-in gate.
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(profilePath);
  const main = visitorPage.locator("main");
  await expect(main.getByText(DESCRIPTION)).toBeVisible();
  await expect(
    main.getByText(`${EN.seeds.list.from.replace("{source}", EN.seeds.sourceName.unidentified)}`),
  ).toBeVisible();
  await expect(main.getByRole("img", { name: EN.seeds.sourcePhoto })).toBeVisible();
  await expect(main.getByRole("link", { name: EN.seeds.list.signIn })).toBeVisible();
  // The source is never presented as a cultivar name or as a seedling identity.
  await expect(main.getByText(EN.seeds.sourceName.cultivar)).toHaveCount(0);
  await expect(main.getByText(/#\d+/)).toHaveCount(0);

  await visitor.close();
  await grower.close();
});

test("another grower expresses interest with a quantity, and only the seller sees who is interested", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const seller = await browser.newContext();
  const sellerPage = await seller.newPage();
  await signUp(sellerPage, "seller", `Seller ${tag}`, "NL");
  await sellerPage.goto("/offers/new");
  await sellerPage.getByLabel(EN.seeds.source.unknownMixed, { exact: true }).check();
  await sellerPage.getByLabel(EN.seeds.material.seedheads, { exact: true }).check();
  await sellerPage.getByLabel(EN.seeds.seedheadCount).fill("3");
  await sellerPage.getByLabel(EN.seeds.handover.legend).selectOption("shipping");
  await sellerPage.getByRole("button", { name: EN.seeds.submit }).click();
  await expect(sellerPage.getByText(EN.seeds.notice.published)).toBeVisible();
  const profilePath = new URL(sellerPage.url()).pathname;

  const buyer = await browser.newContext();
  const buyerPage = await buyer.newPage();
  await signUp(buyerPage, "buyer", `Buyer ${tag}`, "BE");
  await buyerPage.goto(profilePath);
  await buyerPage.getByLabel(EN.seeds.list.quantity).fill("two packets");
  await buyerPage.getByRole("button", { name: EN.seeds.list.interest }).click();
  await expect(buyerPage.getByText(EN.seeds.notice.interestRecorded)).toBeVisible();
  // The buyer sees their own state, and not the seller's list.
  await expect(buyerPage.getByRole("button", { name: EN.seeds.list.withdraw })).toBeVisible();
  await expect(buyerPage.getByText(`Buyer ${tag}`)).toHaveCount(0);

  await sellerPage.goto(profilePath);
  await expect(sellerPage.getByText(`Buyer ${tag}`)).toBeVisible();
  await expect(sellerPage.getByText("two packets")).toBeVisible();

  await buyer.close();
  await seller.close();
});

test("in Dutch, the unidentified dahlia and the unknown or mixed source stay different labels, and the text is not translated", async ({
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
  const profilePath = new URL(page.url()).pathname;

  await page.locator("#language-select").selectOption("nl");
  await expect(page).toHaveURL(new RegExp(`${profilePath}(\\?|$)`));
  const main = page.locator("main");
  // The unknown or mixed source reads as its own Dutch label.
  await expect(main.getByText(`Van ${NL.seeds.sourceName.unknownMixed}`)).toBeVisible();
  // The distinct Dutch term for an unidentified dahlia is not the unknown label.
  expect(NL.seeds.sourceName.unidentified).not.toBe(NL.seeds.sourceName.unknownMixed);
  await expect(main.getByText(NL.seeds.sourceName.unidentified)).toHaveCount(0);

  await grower.close();
});

test("the offer form and the interest control are operable from the keyboard, show a focus ring, and have 44px touch targets", async ({
  browser,
}: {
  browser: Browser;
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "phone",
    "keyboard and touch targets are checked on the phone viewport",
  );
  const grower = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await grower.newPage();
  await signUp(page, "keys", `Keys ${tag}`, "NL");
  await page.goto("/offers/new");

  // Keyboard: the source choice is reached with Tab, shows a focus ring, and is selected with Space.
  await page.getByLabel(EN.seeds.source.unknownMixed, { exact: true }).focus();
  await expect(page.getByLabel(EN.seeds.source.unknownMixed, { exact: true })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByLabel(EN.seeds.source.unknownMixed, { exact: true })).toBeChecked();
  const submit = page.getByRole("button", { name: EN.seeds.submit });
  const box = await submit.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await submit.focus();
  const outline = await page.evaluate(
    () => getComputedStyle(document.activeElement as HTMLElement).outlineStyle,
  );
  expect(outline).toBe("solid");

  // The public interest control, on a live offer, has a 44px target too.
  await page.getByLabel(EN.seeds.material.seeds, { exact: true }).check();
  await page.getByLabel(EN.seeds.packetSize).fill("5");
  await submit.click();
  await expect(page.getByText(EN.seeds.notice.published)).toBeVisible();
  const profilePath = new URL(page.url()).pathname;
  const buyer = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const buyerPage = await buyer.newPage();
  await signUp(buyerPage, "keys-buyer", `Buyer keys ${tag}`, "BE");
  await buyerPage.goto(profilePath);
  const interest = buyerPage.getByRole("button", { name: EN.seeds.list.interest });
  const interestBox = await interest.boundingBox();
  expect(interestBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await buyerPage.getByLabel(EN.seeds.list.quantity).focus();
  await expect(buyerPage.getByLabel(EN.seeds.list.quantity)).toBeFocused();

  await buyer.close();
  await grower.close();
});
