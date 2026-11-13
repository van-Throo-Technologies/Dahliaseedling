import { expect, test, type Page } from "@playwright/test";
import { MESSAGES } from "../../src/i18n/messages";
import { withSuperuser } from "../support/local-supabase";

/*
 * Search continuation. A search with more legitimate matches than one page shows can be continued, group by group,
 * without repeating or losing results. The grower creates one Seedling through the real form, and the remaining
 * thirteen are inserted as test setup, so the search has fourteen legitimate matches to page through.
 */

test.describe.configure({ timeout: 240_000 });

const PASSWORD = "correct-horse-battery";
const tag = "pn" + Math.random().toString(36).slice(2, 8);
const PREFIX = `Page ${tag}`;
const PAGE = 12;

async function signUpAndSetUpProfile(page: Page, email: string) {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(`Pager Grower ${tag}`);
  await page.getByLabel("Country").selectOption("NL");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/profile\/setup/);
}

/** The seedling cards on the page, by their addresses. */
async function cardAddresses(page: Page): Promise<string[]> {
  return page
    .locator('a[href^="/seedlings/"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
}

test("a search with more than one page of seedlings can be continued, and the query and locale survive", async ({
  page,
  browser,
}, testInfo) => {
  const email = `e2e-page-${tag}@example.test`;
  await signUpAndSetUpProfile(page, email);
  await page.goto("/seedlings/new");
  await page.getByLabel("Working name (optional)").fill(`${PREFIX} 01`);
  await page.getByRole("button", { name: "Create seedling" }).click();
  await expect(page).toHaveURL(/\/seedlings\/[0-9a-f-]{36}$/);
  const firstSeedling = page.url().split("/seedlings/")[1]!;
  await page.getByLabel("Who can see it").selectOption("public");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.locator('[role="status"]').filter({ hasText: "Your changes are saved" }),
  ).toBeVisible();

  // Thirteen more public seedlings with the same prefix, inserted as test setup for the same grower.
  await withSuperuser(async (db) => {
    const owner = await db.query("select id from auth.users where email = $1", [email]);
    const ownerId = owner.rows[0].id as string;
    await db.query("set session_replication_role = replica");
    for (let n = 2; n <= 14; n++) {
      await db.query(
        "insert into public.seedlings (id, originator_id, current_holder_id, visibility, working_name) values ($1,$2,$2,'public',$3)",
        [crypto.randomUUID(), ownerId, `${PREFIX} ${String(n).padStart(2, "0")}`],
      );
    }
  });

  // A visitor with no account searches for the prefix.
  const visitor = await browser.newContext({ ...testInfo.project.use });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`/?q=${encodeURIComponent(PREFIX)}`);
  await expect(
    visitorPage.getByRole("heading", { level: 2, name: `Results for ${PREFIX}` }),
  ).toBeVisible();

  const firstPage = await cardAddresses(visitorPage);
  expect(firstPage.length).toBe(PAGE);
  expect(new Set(firstPage).size).toBe(PAGE);
  const next = visitorPage.getByRole("link", { name: MESSAGES.en.search.more.seedlings });
  await expect(next).toBeVisible();
  const box = await next.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

  // Continue: the second page holds the rest, with nothing repeated from the first.
  await next.click();
  await expect(visitorPage).toHaveURL(/seedlings=/);
  expect(new URL(visitorPage.url()).searchParams.get("q")).toBe(PREFIX);
  // The URL changes before the results render, so wait for the remaining cards before reading them.
  await expect(visitorPage.locator('a[href^="/seedlings/"]')).toHaveCount(2);
  const secondPage = await cardAddresses(visitorPage);
  expect(secondPage.length).toBe(2);
  expect(secondPage.some((address) => firstPage.includes(address))).toBe(false);
  expect(new Set([...firstPage, ...secondPage]).size).toBe(14);
  expect([...firstPage, ...secondPage]).toContain(`/seedlings/${firstSeedling}`);

  // The last page offers a way back, and no further "Show more".
  await expect(
    visitorPage.getByRole("link", { name: MESSAGES.en.search.more.seedlings }),
  ).toHaveCount(0);
  await expect(visitorPage.getByRole("link", { name: MESSAGES.en.search.first })).toBeVisible();

  // Switching language on a continued search keeps the query, the position, and the names exactly as written.
  const beforeSwitch = visitorPage.url();
  await visitorPage.getByLabel(MESSAGES.en.app.language.label).selectOption("nl");
  await expect(visitorPage.locator("html")).toHaveAttribute("lang", "nl");
  expect(visitorPage.url()).toBe(beforeSwitch);
  await expect(visitorPage.getByRole("link", { name: MESSAGES.nl.search.first })).toBeVisible();
  await expect(visitorPage.getByText(`${PREFIX} 14`).first()).toBeVisible();
  expect(await cardAddresses(visitorPage)).toEqual(secondPage);

  // French keeps the same position and the same names.
  await visitorPage.getByLabel(MESSAGES.nl.app.language.label).selectOption("fr");
  await expect(visitorPage.locator("html")).toHaveAttribute("lang", "fr");
  expect(visitorPage.url()).toBe(beforeSwitch);
  await expect(visitorPage.getByRole("link", { name: MESSAGES.fr.search.first })).toBeVisible();
  expect(await cardAddresses(visitorPage)).toEqual(secondPage);
  await visitorPage.getByLabel(MESSAGES.fr.app.language.label).selectOption("nl");
  await expect(visitorPage.locator("html")).toHaveAttribute("lang", "nl");

  // Back to the first results returns the first page.
  await visitorPage.getByRole("link", { name: MESSAGES.nl.search.first }).click();
  await expect(visitorPage).not.toHaveURL(/seedlings=/);
  // The URL changes before the results render, so wait for the first page's cards before reading them.
  await expect(visitorPage.locator('a[href^="/seedlings/"]')).toHaveCount(firstPage.length);
  expect(await cardAddresses(visitorPage)).toEqual(firstPage);

  // A malformed cursor is refused safely: the first page is shown, and the page says why.
  await visitorPage.goto(`/?q=${encodeURIComponent(PREFIX)}&seedlings=not-a-cursor`);
  await expect(visitorPage.getByText(MESSAGES.nl.search.cursorInvalid)).toBeVisible();
  expect(await cardAddresses(visitorPage)).toEqual(firstPage);

  // Clearing the search returns to the default Explore view.
  await visitorPage.goto(`/?q=${encodeURIComponent(PREFIX)}&seedlings=`);
  await visitorPage.getByRole("link", { name: MESSAGES.nl.search.clear }).click();
  await expect(visitorPage).toHaveURL(/\/explore$/);
  await expect(visitorPage.getByRole("heading", { level: 1 })).toHaveText(
    MESSAGES.nl.publication.feed.explore,
  );

  await visitor.close();
});
