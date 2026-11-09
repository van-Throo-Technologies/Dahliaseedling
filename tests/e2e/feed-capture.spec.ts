import sharp from "sharp";
import { expect, test, type Page } from "@playwright/test";

/*
 * Feed-first capture and adding a photo to a seedling the grower already holds. Accounts are real test accounts in the local database.
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

test("a grower adds a photo from the Feed without leaving it, and it is saved privately", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "feed", "Feed Grower");

  // The creation row on the Feed opens the composer in place.
  await page.getByRole("link", { name: "What are you growing?" }).click();
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "bloom.jpg", mimeType: "image/jpeg", buffer: await photo() });
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\/[0-9a-f-]{36}/);
  await expect(page.getByText("Saved privately").first()).toBeVisible();
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

  // The seedling page offers adding a photo, and it opens with that seedling chosen.
  await page.getByRole("link", { name: "Add a photo" }).click();
  await expect(page).toHaveURL(/\/\?compose=[0-9a-f-]{36}$/);
  await expect(page.getByRole("radio", { name: "One of my seedlings" })).toBeChecked();
  expect(seedlingPath).toMatch(/\/seedlings\//);
});

test("a grower posts a photograph to the Feed in one composer submission, with a caption, and a visitor sees it", async ({
  page,
  browser,
}) => {
  await signUpAndSetUpProfile(page, "post", "Post Grower");
  const caption = `Composer bloom ${crypto.randomUUID().slice(0, 8)}`;

  // Photo → share now → caption → Post. The seedling is created with the photograph, as in Capture.
  await page.getByRole("link", { name: "What are you growing?" }).click();
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "bloom.jpg", mimeType: "image/jpeg", buffer: await photo() });
  await page.getByRole("checkbox", { name: /Share publicly now/ }).check();
  await page.locator("#composer-caption").fill(caption);
  await page.getByRole("button", { name: "Post photo" }).click();
  await expect(page).toHaveURL(/\/updates\/[0-9a-f-]{36}\?published=1/);

  // A visitor, with no account, sees the post in the Feed, with its public picture.
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto("/");
  await expect(visitorPage.getByText(caption)).toBeVisible();
  await visitor.close();
});

test("from a seedling page, a second photograph is posted with that seedling already chosen", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "second", "Second Grower");
  await page.goto("/capture");
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "first.jpg", mimeType: "image/jpeg", buffer: await photo() });
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\//);
  await page
    .getByRole("link", { name: /Seedling #/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/seedlings\/[0-9a-f-]{36}/);

  // Add a photo → photo → share now → Post. The seedling is already chosen and nothing is re-entered.
  await page.getByRole("link", { name: "Add a photo" }).click();
  await expect(page.getByRole("radio", { name: "One of my seedlings" })).toBeChecked();
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "second.jpg", mimeType: "image/jpeg", buffer: await photo() });
  await page.getByRole("checkbox", { name: /Share publicly now/ }).check();
  await page.getByRole("button", { name: "Post photo" }).click();
  await expect(page).toHaveURL(/\/updates\/[0-9a-f-]{36}\?published=1/);
});

test("from the Feed, a new photograph of an existing seedling is posted once the grower chooses that seedling", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "feedsecond", "Feed Second Grower");
  await page.goto("/capture");
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "first.jpg", mimeType: "image/jpeg", buffer: await photo() });
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\//);

  // Prompt → photo → choose the seedling → share now → Post. Nothing is preselected, so the grower chooses it.
  await page.goto("/");
  await page.getByRole("link", { name: "What are you growing?" }).click();
  await expect(page.getByRole("radio", { name: "One of my seedlings" })).toBeChecked();
  await page.locator('select:has(option[value=""])').selectOption({ index: 1 });
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "second.jpg", mimeType: "image/jpeg", buffer: await photo() });
  await page.getByRole("checkbox", { name: /Share publicly now/ }).check();
  await page.getByRole("button", { name: "Post photo" }).click();
  await expect(page).toHaveURL(/\/updates\/[0-9a-f-]{36}\?published=1/);
});

test("the Feed composer files a photo only under a seedling the grower chooses", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "choose", "Choice Grower");
  // Two seedlings, so the most recent one is not the only choice.
  for (const name of ["first.jpg", "second.jpg"]) {
    await page.goto("/capture");
    await page
      .locator("#capture-photo")
      .setInputFiles({ name, mimeType: "image/jpeg", buffer: await photo() });
    await page.getByRole("button", { name: "Save privately" }).click();
    await expect(page).toHaveURL(/\/observations\//);
  }

  await page.goto("/");
  await page.getByRole("link", { name: "What are you growing?" }).click();
  // The seedling list opens with nothing chosen, so the grower has to choose.
  const seedlingChoice = page.locator('select:has(option[value=""])');
  await expect(seedlingChoice).toHaveValue("");
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "bloom.jpg", mimeType: "image/jpeg", buffer: await photo() });
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(
    page.locator('p[role="alert"]').filter({ hasText: "Choose a seedling" }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/\/observations\//);

  // Once a seedling is chosen, the same photo goes to it.
  await seedlingChoice.selectOption({ index: 1 });
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\//);
});
