import { expect, test, type Page } from "@playwright/test";
import { MESSAGES } from "../../src/i18n/messages";

/*
 * The language is a visitor's choice. It never changes the address, it is remembered in a cookie, and the
 * browser's language is only the starting point. The assertions read the dictionaries, so they follow wording changes.
 */

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(0);
}

function feedTitle(locale: "en" | "nl" | "fr") {
  return MESSAGES[locale].publication.feed.title;
}

test("a visitor's language choice stays on the same page, survives a reload, and never changes the address", async ({
  page,
}) => {
  await page.goto("/");
  const address = page.url();

  await page.getByLabel(MESSAGES.en.app.language.label).selectOption("fr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(feedTitle("fr"));
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  expect(page.url()).toBe(address);
  await expectNoHorizontalOverflow(page);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(feedTitle("fr"));
});

test("without a saved choice the browser language is used, and a saved choice overrides it", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "nl-NL" });
  const page = await context.newPage();

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(feedTitle("nl"));
  await expect(page.locator("html")).toHaveAttribute("lang", "nl");

  await page.getByLabel(MESSAGES.nl.app.language.label).selectOption("en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(feedTitle("en"));

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(feedTitle("en"));
  await context.close();
});

test("a browser language the app does not support falls back to English", async ({ browser }) => {
  const context = await browser.newContext({ locale: "de-DE" });
  const page = await context.newPage();

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(feedTitle("en"));
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await context.close();
});
