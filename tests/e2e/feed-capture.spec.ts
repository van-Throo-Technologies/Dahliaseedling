import sharp from "sharp";
import { expect, test, type Page } from "@playwright/test";

/*
 * Capture is its own workflow, reached from the Feed. Home holds no capture form, and an older ?compose=… address goes to Capture.
 * Accounts are real test accounts in the local database.
 */

const PASSWORD = "correct-horse-battery";

function uniqueEmail(label: string): string {
  return `e2e-feed-${label}-${crypto.randomUUID()}@example.test`;
}

async function signUpAndSetUpProfile(page: Page, label: string, displayName: string) {
  await page.goto("/sign-up?next=%2F");
  await page.getByLabel("Email").fill(uniqueEmail(label));
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Country").selectOption("NL");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function photo(): Promise<Buffer> {
  return sharp({ create: { width: 600, height: 400, channels: 3, background: "rgb(120,160,90)" } })
    .jpeg()
    .toBuffer();
}

test("the creation invitation on the Feed opens Capture, and a photo is saved privately there", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "feed", "Feed Grower");

  // The invitation is the first match: an empty Feed also offers the same destination further down.
  await page.getByRole("link", { name: "What are you growing?" }).first().click();
  await expect(page).toHaveURL(/\/capture$/);
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "bloom.jpg", mimeType: "image/jpeg", buffer: await photo() });
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\/[0-9a-f-]{36}/);
  await expect(page.getByText("Saved privately").first()).toBeVisible();
});

test("Home shows the Feed and no capture form, and a ?compose link goes to Capture", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "home", "Home Grower");

  await page.goto("/");
  await expect(page.locator("#capture-photo")).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /Share publicly now/ })).toHaveCount(0);

  await page.goto("/?compose=1");
  await expect(page).toHaveURL(/\/capture$/);
  await expect(page.locator("#capture-photo")).toHaveCount(1);
});

test("a visitor who follows a ?compose link is sent to sign in, not to a Home composer", async ({
  page,
}) => {
  await page.goto("/?compose=1");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("from a seedling, adding a photo starts with that seedling already chosen", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "start", "Start Grower");

  // Create a seedling by saving a first photo as a new seedling.
  await page.goto("/capture");
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "first.jpg", mimeType: "image/jpeg", buffer: await photo() });
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\//);
  const seedlingLink = page.getByRole("link", { name: /Seedling #/ }).first();
  await seedlingLink.click();
  await expect(page).toHaveURL(/\/seedlings\/[0-9a-f-]{36}/);
  const seedlingPath = new URL(page.url()).pathname;

  // The seedling page offers adding a photo, and it opens Capture with that seedling chosen.
  await page.getByRole("link", { name: "Add a photo" }).click();
  await expect(page).toHaveURL(/\/capture\?seedling=[0-9a-f-]{36}$/);
  await expect(page.getByRole("radio", { name: "One of my seedlings" })).toBeChecked();
  expect(seedlingPath).toMatch(/\/seedlings\//);
});
