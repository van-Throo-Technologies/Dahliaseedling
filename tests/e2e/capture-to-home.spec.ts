import sharp from "sharp";
import { expect, test, type Page } from "@playwright/test";

/*
 * The grower's path from Home to a published Update on Home: the Feed invitation opens Capture, the photograph is saved privately,
 * the observation is shared from its own page, and the Update then appears in the Feed. Accounts are real test accounts in the local
 * database.
 */

const PASSWORD = "correct-horse-battery";

async function photo(): Promise<Buffer> {
  return sharp({ create: { width: 600, height: 400, channels: 3, background: "rgb(120,160,90)" } })
    .jpeg()
    .toBuffer();
}

async function signUpAndSetUpProfile(page: Page, label: string, displayName: string) {
  await page.goto("/sign-up?next=%2F");
  await page.getByLabel("Email").fill(`e2e-journey-${label}-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Country").selectOption("NL");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("a grower takes a photograph from Home to a published Update that appears on Home", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "publish", "Journey Grower");
  const caption = `Journey bloom ${crypto.randomUUID().slice(0, 8)}`;

  // Home → Capture.
  await page.getByRole("link", { name: "What are you growing?" }).first().click();
  await expect(page).toHaveURL(/\/capture$/);

  // Record a photograph as a new seedling. It is saved privately first.
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "bloom.jpg", mimeType: "image/jpeg", buffer: await photo() });
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\/[0-9a-f-]{36}/);

  // Share from the observation page.
  await page.getByRole("link", { name: "Share selected photos" }).click();
  await expect(page).toHaveURL(/\/observations\/[0-9a-f-]{36}\/share/);

  // A new seedling is private until the grower makes it public on this step.
  const makePublic = page.getByRole("button", { name: "Make Seedling public & continue" });
  if (await makePublic.isVisible()) {
    await makePublic.click();
    await expect(page.getByRole("checkbox", { name: /Share photo/ })).toBeVisible();
  }
  await page.getByRole("checkbox", { name: /Share photo/ }).check();
  await page.locator("#caption").fill(caption);
  await page.getByRole("button", { name: "Publish update" }).click();
  await expect(page).toHaveURL(/\/updates\/[0-9a-f-]{36}/);

  // The published Update appears on Home.
  await page.goto("/");
  // The caption is in the card and in its conversation, so the first match is the card.
  await expect(page.getByText(caption).first()).toBeVisible();
});
