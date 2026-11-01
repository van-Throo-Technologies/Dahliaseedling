import { expect, test, type Page } from "@playwright/test";

/*
 * Phase 2 journeys in the browser. Authorization is tested directly against the database in
 * tests/db; these tests confirm the flows a grower and a visitor actually see.
 */

const PASSWORD = "correct-horse-battery";

function uniqueEmail(label: string): string {
  return `e2e-${label}-${crypto.randomUUID()}@example.test`;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(0);
}

/** Creates an account and completes profile setup through the real forms. */
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

function seedlingIdFrom(url: string): string {
  const match = /\/seedlings\/([0-9a-f-]{36})$/i.exec(url);
  if (!match?.[1]) throw new Error(`no seedling id in ${url}`);
  return match[1];
}

test("a grower creates a Series and a seedling, then shares it deliberately", async ({
  page,
  browser,
}, testInfo) => {
  await signUpAndSetUpProfile(page, "grower", "Janine Grower");

  // Series
  await page.goto("/series");
  await page.getByLabel("Series name").fill("jv");
  await page.getByRole("button", { name: "Create series" }).click();
  await expect(page.getByRole("status")).toContainText("Series JV is ready");
  await expect(page.getByText("JV", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // Seedling core, no media
  await page.goto("/seedlings/new");
  await page.getByLabel("Numbering").selectOption({ label: "Series JV (uses the year)" });
  await page.getByLabel("Working name (optional)").fill("Velvet Dusk");
  await page.getByLabel("First grown year (optional)").fill("2024");
  await page.getByRole("button", { name: "Create seedling" }).click();

  await expect(page).toHaveURL(/\/seedlings\/[0-9a-f-]{36}$/);
  const seedlingUrl = page.url();
  const seedlingId = seedlingIdFrom(seedlingUrl);
  await expect(page.getByRole("heading", { level: 1, name: "Velvet Dusk" })).toBeVisible();
  await expect(page.getByText("Private", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /^JV-\d{2}-001/ })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /^#1/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // Deliberate publication
  await page.getByLabel("Who can see it").selectOption("public");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Your changes are saved");

  // A visitor sees the public record, with no management controls.
  const visitor = await browser.newContext({ ...testInfo.project.use });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`/seedlings/${seedlingId}`);
  await expect(visitorPage.getByRole("heading", { level: 1, name: "Velvet Dusk" })).toBeVisible();
  await expect(
    visitorPage.getByRole("listitem").filter({ hasText: /^JV-\d{2}-001/ }),
  ).toBeVisible();
  await expect(visitorPage.getByRole("heading", { name: "Manage this seedling" })).toHaveCount(0);
  await visitor.close();
});

test("a private seedling is invisible to other growers and to visitors, but not to its owner", async ({
  page,
  browser,
}, testInfo) => {
  await signUpAndSetUpProfile(page, "owner", "Private Owner");
  await page.goto("/seedlings/new");
  await page.getByLabel("Working name (optional)").fill("Quiet Ember");
  await page.getByRole("button", { name: "Create seedling" }).click();
  await expect(page).toHaveURL(/\/seedlings\/[0-9a-f-]{36}$/);
  const url = page.url();
  const seedlingId = seedlingIdFrom(url);

  // The owner still sees it.
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1, name: "Quiet Ember" })).toBeVisible();

  // Another signed-in grower gets the same answer as for a seedling that does not exist.
  const other = await browser.newContext({ ...testInfo.project.use });
  const otherPage = await other.newPage();
  await signUpAndSetUpProfile(otherPage, "other", "Other Grower");
  const otherResponse = await otherPage.goto(`/seedlings/${seedlingId}`);
  expect(otherResponse?.status()).toBe(404);
  await other.close();

  // A visitor gets the same 404, and so does a malformed identifier.
  const visitor = await browser.newContext({ ...testInfo.project.use });
  const visitorPage = await visitor.newPage();
  const visitorResponse = await visitorPage.goto(`/seedlings/${seedlingId}`);
  expect(visitorResponse?.status()).toBe(404);
  const malformed = await visitorPage.goto("/seedlings/not-a-seedling");
  expect(malformed?.status()).toBe(404);
  await visitor.close();
});

test("a seedling without a year gets its automatic number, and the Series identifier is added once the year is known", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "late-year", "Late Year Grower");

  await page.goto("/series");
  await page.getByLabel("Series name").fill("jv");
  await page.getByRole("button", { name: "Create series" }).click();
  await expect(page.getByRole("status")).toContainText("Series JV is ready");

  // A year-based series without a year is explained on the year field, and nothing is created.
  await page.goto("/seedlings/new");
  await page.getByLabel("Numbering").selectOption({ label: "Series JV (uses the year)" });
  await page.getByLabel("Working name (optional)").fill("Patient Ember");
  await page.getByRole("button", { name: "Create seedling" }).click();
  await expect(page.locator("#field-firstGrownYear-error")).toContainText(
    "Enter a first grown year to use series JV.",
  );
  await expect(page.getByLabel("Working name (optional)")).toHaveValue("Patient Ember");

  // Without the series, the seedling is created with its automatic number.
  await page.getByLabel("Numbering").selectOption({ label: "Automatic number only" });
  await page.getByRole("button", { name: "Create seedling" }).click();
  await expect(page).toHaveURL(/\/seedlings\/[0-9a-f-]{36}$/);
  const seedlingId = seedlingIdFrom(page.url());
  await expect(page.getByRole("listitem").filter({ hasText: /^#1/ })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /^JV-/ })).toHaveCount(0);

  // The grower enters the year, then adds the series identifier. The UUID and #1 stay the same.
  await page.getByLabel("First grown year").fill("2026");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Existing identifiers stay as they are");
  await page
    .getByLabel("Add a series identifier")
    .selectOption({ label: "Series JV (uses the year)" });
  await page.getByRole("button", { name: "Add series identifier" }).click();
  // The attached identifier shows in the Identifiers list. The form then has no series left to offer.
  await expect(page.getByRole("listitem").filter({ hasText: /^JV-26-001/ })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /^#1/ })).toBeVisible();
  expect(seedlingIdFrom(page.url())).toBe(seedlingId);
  await expectNoHorizontalOverflow(page);
});

test("the parent search offers another grower's public seedling, and never their private one", async ({
  page,
  browser,
}, testInfo) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const other = await browser.newContext({ ...testInfo.project.use });
  const otherPage = await other.newPage();
  await signUpAndSetUpProfile(otherPage, "parent-owner", "Parent Owner");
  await otherPage.goto("/seedlings/new");
  await otherPage.getByLabel("Working name (optional)").fill(`${suffix} Glow`);
  await otherPage.getByLabel("Who can see it").selectOption("public");
  await otherPage.getByRole("button", { name: "Create seedling" }).click();
  await expect(otherPage).toHaveURL(/\/seedlings\/[0-9a-f-]{36}$/);
  await otherPage.goto("/seedlings/new");
  await otherPage.getByLabel("Working name (optional)").fill(`${suffix} Secret`);
  await otherPage.getByRole("button", { name: "Create seedling" }).click();
  await expect(otherPage).toHaveURL(/\/seedlings\/[0-9a-f-]{36}$/);
  await other.close();

  await signUpAndSetUpProfile(page, "child-grower", "Child Grower");
  await page.goto("/seedlings/new");
  await page.getByLabel("Working name (optional)").fill("Child Seedling");
  await page.getByRole("button", { name: "Create seedling" }).click();
  await expect(page).toHaveURL(/\/seedlings\/[0-9a-f-]{36}$/);

  await page.getByLabel("How is it known?").first().selectOption("seedling");
  await page.getByLabel("Find a seedling").first().fill(suffix);
  const results = page.getByRole("list", { name: "Matching seedlings" }).first();
  await expect(results.getByRole("button", { name: new RegExp(`${suffix} Glow`) })).toBeVisible();
  await expect(results.getByRole("button", { name: new RegExp(`${suffix} Secret`) })).toHaveCount(
    0,
  );
  await expect(results.getByText("Grown by Parent Owner")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await results.getByRole("button", { name: new RegExp(`${suffix} Glow`) }).click();
  await page.getByRole("button", { name: "Save seed parent" }).click();
  await expect(page.getByRole("status").first()).toHaveText("Parentage is saved.");
  await expect(page.getByRole("link", { name: new RegExp(`${suffix} Glow`) })).toBeVisible();
});
