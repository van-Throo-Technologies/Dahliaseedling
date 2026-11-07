import { expect, test, type Page } from "@playwright/test";

/*
 * Capture journeys in the browser. Storage and Observation permissions are tested against the database
 * (tests/db). These tests confirm the flows a grower actually sees, on a phone and on a desktop.
 */

const PASSWORD = "correct-horse-battery";
// A small valid-looking JPEG header. Storage checks the type and size, not the pixels.
const JPEG = Buffer.from(
  "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffda0008010100003f00d2cf20ffd9",
  "hex",
);

function uniqueEmail(label: string): string {
  return `e2e-capture-${label}-${crypto.randomUUID()}@example.test`;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(0);
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

function observationIdFrom(url: string): string {
  const match = /\/observations\/([0-9a-f-]{36})/i.exec(url);
  if (!match?.[1]) throw new Error(`no observation id in ${url}`);
  return match[1];
}

test("a grower captures a photo into a new seedling in one tap and leaves", async ({ page }) => {
  await signUpAndSetUpProfile(page, "new", "Capture Grower");

  // Posting starts in the Feed composer, which has no separate Capture tab.
  await page.goto("/");
  await page.getByText("Add a photo", { exact: true }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Capture" })).toBeVisible();

  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "first-bloom.jpg", mimeType: "image/jpeg", buffer: JPEG });
  await expect(page.getByRole("img", { name: "first-bloom.jpg" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /New seedling/ })).toBeChecked();

  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\/[0-9a-f-]{36}\?saved=1$/);
  await expect(page.getByText(/Saved privately\. Added to Seedling #1\./)).toBeVisible();
  await expect(page.getByText("Nothing is shared.")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("the note stays optional, dictation falls back to typing, and Share opens the publication step", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "note", "Note Grower");
  await page.goto("/capture");
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "note.jpg", mimeType: "image/jpeg", buffer: JPEG });

  // Headless Chromium has no speech recognition: the typed fallback is shown and saving still works.
  await page.getByText("Add a note (optional)").click();
  await expect(
    page
      .getByRole("button", { name: "Dictate a note" })
      .or(page.getByText("Dictation is not available in this browser. Type your note instead.")),
  ).toBeVisible();
  await page.getByLabel("Note").fill("Bud forming on the left stem");
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\//);

  await expect(
    page
      .getByRole("region", { name: "Note", exact: true })
      .getByText("Bud forming on the left stem"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Share selected photos" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("a known identifier attaches the capture to that seedling, without creating another", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "known", "Known Grower");
  await page.goto("/seedlings/new");
  await page.getByLabel("Working name (optional)").fill("Known Ember");
  await page.getByRole("button", { name: "Create seedling" }).click();
  await expect(page).toHaveURL(/\/seedlings\/[0-9a-f-]{36}$/);
  const seedlingUrl = page.url();

  await page.goto("/capture");
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "known.jpg", mimeType: "image/jpeg", buffer: JPEG });
  await page.getByRole("radio", { name: /I know its identifier/ }).check();
  await page.getByLabel("Seedling identifier").fill("#1");
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\//);
  await expect(page.getByText(/Added to Seedling #1/)).toBeVisible();

  // The seedling page shows the observation, and no second seedling was created.
  await page.goto(seedlingUrl);
  await expect(page.getByRole("heading", { name: "Your private observations" })).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByRole("link", { name: /Known Ember/ })).toHaveCount(1);
});

test("an unknown identifier fails without revealing whether a seedling exists", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "unknown", "Unknown Grower");
  await page.goto("/capture");
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "x.jpg", mimeType: "image/jpeg", buffer: JPEG });
  await page.getByRole("radio", { name: /I know its identifier/ }).check();
  await page.getByLabel("Seedling identifier").fill("JV-99-999");
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(
    page.getByText("That seedling is not available to you.", { exact: false }).first(),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/capture$/);
});

test("a failed upload is not reported as saved, and retrying keeps the same photo", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "retry", "Retry Grower");
  await page.goto("/capture");
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "retry.jpg", mimeType: "image/jpeg", buffer: JPEG });

  // Block the first upload to simulate a dropped connection outdoors.
  await page.route("**/storage/v1/object/private-media/**", (route) => route.abort());
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText(
    "Your photos are still here, so try again.",
  );
  await expect(page).toHaveURL(/\/capture$/);
  await expect(page).not.toHaveURL(/\/observations\//);

  await page.unroute("**/storage/v1/object/private-media/**");
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\//);
  await expect(page.getByText(/Saved privately/).first()).toBeVisible();
});

test("a grower changes the seedling of a capture without re-uploading the photo", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "change", "Change Grower");
  await page.goto("/capture");
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "wrong.jpg", mimeType: "image/jpeg", buffer: JPEG });
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\//);
  const observationUrl = page.url();
  const observationId = observationIdFrom(observationUrl);
  const photoBefore = await page
    .getByRole("img", { name: "Your private photo or video" })
    .getAttribute("src");

  await page.getByRole("link", { name: "Change seedling" }).click();
  await expect(page).toHaveURL(new RegExp(`/observations/${observationId}/move$`));
  await page.getByRole("radio", { name: "New seedling" }).check();
  await page.getByRole("button", { name: "Move observation" }).click();

  await expect(page).toHaveURL(new RegExp(`/observations/${observationId}\\?moved=1$`));
  await expect(page.getByText("Moved. The photos were not uploaded again.")).toBeVisible();
  // The same photo, at the same address: nothing was re-uploaded or copied.
  expect(
    await page.getByRole("img", { name: "Your private photo or video" }).getAttribute("src"),
  ).toBe(photoBefore);
  expect(observationIdFrom(page.url())).toBe(observationId);
});

test("a public seedling does not expose its private observation to visitors", async ({
  page,
  browser,
}, testInfo) => {
  await signUpAndSetUpProfile(page, "public", "Public Grower");
  await page.goto("/seedlings/new");
  await page.getByLabel("Working name (optional)").fill("Open Ember");
  await page.getByLabel("Who can see it").selectOption("public");
  await page.getByRole("button", { name: "Create seedling" }).click();
  await expect(page).toHaveURL(/\/seedlings\/[0-9a-f-]{36}$/);
  const seedlingUrl = page.url();

  await page.goto("/capture");
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "private.jpg", mimeType: "image/jpeg", buffer: JPEG });
  await page.getByRole("radio", { name: /I know its identifier/ }).check();
  await page.getByLabel("Seedling identifier").fill("#1");
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\//);
  const observationUrl = page.url();

  const visitor = await browser.newContext({ ...testInfo.project.use });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(seedlingUrl);
  await expect(visitorPage.getByRole("heading", { level: 1, name: "Open Ember" })).toBeVisible();
  await expect(visitorPage.getByRole("heading", { name: "Your private observations" })).toHaveCount(
    0,
  );
  const observation = await visitorPage.goto(observationUrl);
  expect(observation?.status()).toBe(404);
  await visitor.close();
});

test("a deleted observation's photo is no longer served, even to its owner", async ({ page }) => {
  await signUpAndSetUpProfile(page, "delete-media", "Delete Grower");
  await page.goto("/capture");
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "gone.jpg", mimeType: "image/jpeg", buffer: JPEG });
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\//);
  await expect(page.getByText(/Saved privately/).first()).toBeVisible();

  const src = await page.locator('img[src*="/media/"]').first().getAttribute("src");
  const mediaId = /\/media\/([0-9a-f-]{36})/.exec(src ?? "")?.[1];
  expect(mediaId, "the saved photo should be served from /media/<id>").toBeTruthy();

  const before = await page.request.get(`/media/${mediaId}`, { maxRedirects: 0 });
  expect(before.status()).toBe(302);

  await page.getByRole("button", { name: "Delete this observation" }).click();
  await page.getByRole("button", { name: "Yes, delete it" }).click();
  await expect(page).toHaveURL(/\/profile\?deleted=1/);

  const after = await page.request.get(`/media/${mediaId}`, { maxRedirects: 0 });
  expect(after.status()).toBe(404);
});
