import { expect, test, type Page } from "@playwright/test";
import { MESSAGES } from "../../src/i18n/messages";

/*
 * Search & Discovery on Home, as a visitor without an account and as the grower who published the results. The
 * assertions read the dictionaries, so they follow wording changes. Names are unique per run, because the
 * database is shared with the other suites.
 */

test.describe.configure({ timeout: 180_000 });

const PASSWORD = "correct-horse-battery";
const tag = "e" + Math.random().toString(36).slice(2, 8);
const WORKING_NAME = `Sunset Surprise ${tag}`;
const PRIVATE_NAME = `Quiet Ember ${tag}`;
const CULTIVAR = "Wizard of Oz";

function uniqueEmail(label: string): string {
  return `e2e-search-${label}-${crypto.randomUUID()}@example.test`;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(0);
}

async function signUpAndSetUpProfile(page: Page) {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(uniqueEmail("grower"));
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(`Search Grower ${tag}`);
  await page.getByLabel("Country").selectOption("NL");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/profile\/setup/);
}

/** Creates a seedling with a working name and returns its address. */
async function createSeedling(page: Page, workingName: string, visibility: "public" | "private") {
  await page.goto("/seedlings/new");
  await page.getByLabel("Working name (optional)").fill(workingName);
  await page.getByRole("button", { name: "Create seedling" }).click();
  await expect(page).toHaveURL(/\/seedlings\/[0-9a-f-]{36}$/);
  const address = page.url();
  if (visibility === "public") {
    await page.getByLabel("Who can see it").selectOption("public");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.locator('[role="status"]').filter({ hasText: "Your changes are saved" }),
    ).toBeVisible();
  }
  return address;
}

/** Searches from Home, using the labels of the language the page is currently in. */
async function searchIn(
  page: Page,
  labels: (typeof MESSAGES)["en"]["search"],
  query: string,
  country?: string,
) {
  await page.getByLabel(labels.label).fill(query);
  if (country) {
    // The filters are closed by default, so the visitor opens them first. They stay open once a filter is in the address.
    const filters = page.locator("details").first();
    if (!(await filters.evaluate((element) => (element as HTMLDetailsElement).open))) {
      await page.getByText(labels.filters, { exact: true }).click();
    }
    await page.getByLabel(labels.country).selectOption(country);
  }
  await page.getByRole("button", { name: labels.submit }).click();
}

const search = (page: Page, query: string, country?: string) =>
  searchIn(page, MESSAGES.en.search, query, country);

test("a visitor finds public seedlings and cultivars without an account, and a private one never appears", async ({
  page,
  browser,
}, testInfo) => {
  // The grower publishes a seedling with a cultivar as its seed parent, and keeps a second seedling private.
  await signUpAndSetUpProfile(page);
  const publicAddress = await createSeedling(page, WORKING_NAME, "public");
  const parentForm = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: /save seed parent/i }) });
  await parentForm.getByLabel("How is it known?").selectOption({ label: "A named cultivar" });
  await parentForm.getByLabel("Cultivar name").fill(CULTIVAR);
  await parentForm.getByRole("button", { name: /save seed parent/i }).click();
  await expect(
    page.locator('[role="status"]').filter({ hasText: "Parentage is saved." }),
  ).toBeVisible();
  await createSeedling(page, PRIVATE_NAME, "private");

  // A visitor with no account searches from Explore.
  const visitor = await browser.newContext({ ...testInfo.project.use });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto("/explore");
  await expect(visitorPage.getByRole("heading", { level: 1 })).toHaveText(
    MESSAGES.en.publication.feed.explore,
  );
  await expect(visitorPage.getByRole("search")).toBeVisible();

  await search(visitorPage, WORKING_NAME);
  await expect(visitorPage).toHaveURL(/\?q=/);
  const seedlingLink = visitorPage.locator(`a[href="${new URL(publicAddress).pathname}"]`);
  await expect(seedlingLink).toBeVisible();
  await expect(seedlingLink.getByText(WORKING_NAME)).toBeVisible();
  await expectNoHorizontalOverflow(visitorPage);

  // Cultivar: found by name, and its parentage is shown.
  await search(visitorPage, CULTIVAR);
  await expect(
    visitorPage.getByRole("heading", { level: 3, name: MESSAGES.en.search.groups.cultivars }),
  ).toBeVisible();
  await expect(visitorPage.getByText(CULTIVAR, { exact: true }).first()).toBeVisible();
  // The count depends on how many public seedlings in the shared database record this cultivar, so the test
  // checks the sentence, not a number.
  await expect(
    visitorPage.getByText(/have it as their seed parent|has it as its seed parent/).first(),
  ).toBeVisible();

  // The private seedling is not found, and the zero-result state reveals nothing about it.
  await search(visitorPage, PRIVATE_NAME);
  await expect(visitorPage.getByText(MESSAGES.en.search.empty.title)).toBeVisible();
  // The query is echoed in the heading, so the check is for a result link, not for the text.
  await expect(visitorPage.getByRole("link", { name: new RegExp(PRIVATE_NAME) })).toHaveCount(0);

  // Clearing the search returns the Feed.
  await visitorPage.getByRole("link", { name: MESSAGES.en.search.clear }).click();
  await expect(visitorPage).toHaveURL(/\/$/);
  await expect(visitorPage.getByRole("heading", { level: 1 })).toHaveText(
    MESSAGES.en.publication.feed.title,
  );

  await visitor.close();
});

test("the country filter uses the grower's canonical country, and switching language keeps the query and the names", async ({
  page,
  browser,
}) => {
  await signUpAndSetUpProfile(page);
  await createSeedling(page, WORKING_NAME, "public");

  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto("/explore");

  // The grower is in the Netherlands, so NL finds the seedling and BE does not.
  await search(visitorPage, WORKING_NAME, "NL");
  await expect(visitorPage.getByText(WORKING_NAME).first()).toBeVisible();
  await search(visitorPage, WORKING_NAME, "BE");
  await expect(visitorPage.getByText(MESSAGES.en.search.empty.title)).toBeVisible();

  // Switching to Dutch keeps the address, the query, and the user-authored name exactly as written.
  await search(visitorPage, WORKING_NAME, "NL");
  const address = visitorPage.url();
  await visitorPage.getByLabel(MESSAGES.en.app.language.label).selectOption("nl");
  await expect(visitorPage.locator("html")).toHaveAttribute("lang", "nl");
  expect(visitorPage.url()).toBe(address);
  await expect(visitorPage.getByLabel(MESSAGES.nl.search.label)).toHaveValue(WORKING_NAME);
  await expect(visitorPage.getByText(WORKING_NAME).first()).toBeVisible();

  // In Dutch the country is a Dutch name, and the cultivar keeps its English name.
  await expect(visitorPage.getByLabel(MESSAGES.nl.search.country)).toHaveValue("NL");
  // A country filter leaves cultivars out, because a cultivar has no country. Clear it before searching by name.
  await visitorPage.getByLabel(MESSAGES.nl.search.country).selectOption("");
  await searchIn(visitorPage, MESSAGES.nl.search, CULTIVAR);
  await expect(visitorPage.getByText(CULTIVAR, { exact: true }).first()).toBeVisible();

  // French keeps the same names and the same address.
  await visitorPage.getByLabel(MESSAGES.nl.app.language.label).selectOption("fr");
  await expect(visitorPage.locator("html")).toHaveAttribute("lang", "fr");
  await expect(visitorPage.getByText(CULTIVAR, { exact: true }).first()).toBeVisible();
  await expect(visitorPage.getByLabel(MESSAGES.fr.search.label)).toBeVisible();
  await expectNoHorizontalOverflow(visitorPage);

  await visitor.close();
});
