import sharp from "sharp";
import { expect, test, type Page } from "@playwright/test";

/*
 * Capture's two intentions. "Save privately" keeps the photograph private. "Share update" publishes it to the Feed. A private seedling
 * becomes public only after the grower confirms it, and cancelling keeps everything on the form. Accounts are real test accounts in the
 * local database.
 */

const PASSWORD = "correct-horse-battery";

async function photo(): Promise<Buffer> {
  return sharp({ create: { width: 600, height: 400, channels: 3, background: "rgb(120,160,90)" } })
    .jpeg()
    .toBuffer();
}

async function signUpAndSetUpProfile(page: Page, label: string, displayName: string) {
  await page.goto("/sign-up?next=%2F");
  await page.getByLabel("Email").fill(`e2e-share-${label}-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Country").selectOption("NL");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function choosePhoto(page: Page, name: string) {
  await page
    .locator("#capture-photo")
    .setInputFiles({ name, mimeType: "image/jpeg", buffer: await photo() });
}

/** Feed cards that carry the caption. A card's conversation repeats the caption, so the cards are counted, not the text. */
async function feedCardsWith(page: Page, caption: string): Promise<number> {
  await page.goto("/");
  return page.locator("article").filter({ hasText: caption }).count();
}

const SHARE = { name: "Share update", exact: true };
const CONFIRM = { name: "Make seedling public and share", exact: true };

test("Save privately keeps the photograph private and publishes nothing", async ({ page }) => {
  await signUpAndSetUpProfile(page, "private", "Private Grower");
  await page.goto("/capture");
  await choosePhoto(page, "private.jpg");
  await page.getByRole("button", { name: "Save privately", exact: true }).click();
  await expect(page).toHaveURL(/\/observations\/[0-9a-f-]{36}/);
  await expect(page.getByText("Nothing is shared.")).toBeVisible();
});

test("a new seedling is shared only after the grower confirms it, and the caption and photograph are kept until then", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "confirm", "Confirm Grower");
  const caption = `Confirmed bloom ${crypto.randomUUID().slice(0, 8)}`;

  await page.goto("/capture");
  await choosePhoto(page, "bloom.jpg");
  await page.locator("#capture-caption").fill(caption);
  await page.getByRole("button", SHARE).click();

  // The first press asks. Nothing has been saved or published, and the URL has not changed.
  await expect(page.getByRole("heading", { name: "Make this seedling public?" })).toBeVisible();
  await expect(page).toHaveURL(/\/capture$/);
  await expect(page.locator("#capture-caption")).toHaveValue(caption);
  await expect(page.getByRole("img", { name: "bloom.jpg" })).toBeVisible();

  await page.getByRole("button", CONFIRM).click();
  await expect(page).toHaveURL(/\/updates\/[0-9a-f-]{36}/);
  expect(await feedCardsWith(page, caption)).toBe(1);
});

test("cancelling the confirmation publishes nothing and keeps the photograph and caption on the form", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "cancel", "Cancel Grower");
  const caption = `Cancelled bloom ${crypto.randomUUID().slice(0, 8)}`;

  await page.goto("/capture");
  await choosePhoto(page, "cancel.jpg");
  await page.locator("#capture-caption").fill(caption);
  await page.getByRole("button", SHARE).click();
  await expect(page.getByRole("heading", { name: "Make this seedling public?" })).toBeVisible();

  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Make this seedling public?" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/capture$/);
  await expect(page.locator("#capture-caption")).toHaveValue(caption);
  await expect(page.getByRole("img", { name: "cancel.jpg" })).toBeVisible();

  expect(await feedCardsWith(page, caption)).toBe(0);
});

test("a photograph for a public seedling is shared in one press, with no confirmation", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "public", "Public Grower");
  const first = `First bloom ${crypto.randomUUID().slice(0, 8)}`;
  const second = `Second bloom ${crypto.randomUUID().slice(0, 8)}`;

  // The first share makes the seedling public.
  await page.goto("/capture");
  await choosePhoto(page, "first.jpg");
  await page.locator("#capture-caption").fill(first);
  await page.getByRole("button", SHARE).click();
  await page.getByRole("button", CONFIRM).click();
  await expect(page).toHaveURL(/\/updates\/[0-9a-f-]{36}/);

  // A second photograph of that seedling: choose it, and share in one press.
  await page.goto("/capture");
  await page.getByRole("radio", { name: "One of my seedlings" }).check();
  await choosePhoto(page, "second.jpg");
  await page.locator("#capture-caption").fill(second);
  await page.getByRole("button", SHARE).click();
  await expect(page.getByRole("heading", { name: "Make this seedling public?" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/updates\/[0-9a-f-]{36}/);
  expect(await feedCardsWith(page, second)).toBe(1);
});

test("a double press on the confirmation publishes one Update", async ({ page }) => {
  await signUpAndSetUpProfile(page, "double", "Double Grower");
  const caption = `Once bloom ${crypto.randomUUID().slice(0, 8)}`;

  await page.goto("/capture");
  await choosePhoto(page, "once.jpg");
  await page.locator("#capture-caption").fill(caption);
  await page.getByRole("button", SHARE).click();
  const confirm = page.getByRole("button", CONFIRM);
  await confirm.dblclick();
  await expect(page).toHaveURL(/\/updates\/[0-9a-f-]{36}/);
  expect(await feedCardsWith(page, caption)).toBe(1);
});
