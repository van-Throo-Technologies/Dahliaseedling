import { expect, test, type Browser, type Page } from "@playwright/test";
import { MESSAGES } from "../../src/i18n/messages";

/*
 * The real parent editor in Dutch and French. The unidentified dahlia must read as its own concept: a dahlia with an unknown
 * name, distinct from an explicit Unknown parent. Each role's controls stay associated with that role's own label, now that
 * the ids are scoped by role. The French form uses the masculine agreement, and the old feminine wording never appears.
 */

test.describe.configure({ timeout: 240_000 });

const PASSWORD = "correct-horse-battery";

async function signUp(page: Page, label: string) {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(`e2e-pl-${label}-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(`Pl ${label}`);
  await page.getByLabel("Country").selectOption("NL");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/profile\/setup/);
}

/** The parent editor for one role, found by its own heading in the active language. */
function editor(page: Page, heading: string) {
  return page.locator("form", { has: page.getByRole("heading", { name: heading, exact: true }) });
}

async function runLocale(browser: Browser, locale: "nl" | "fr") {
  const dict = MESSAGES[locale];
  const holder = await browser.newContext();
  const page = await holder.newPage();
  await signUp(page, locale);
  await page.goto("/seedlings/new");
  await page.getByRole("button", { name: "Create seedling" }).click();
  await expect(page).toHaveURL(/\/seedlings\/[0-9a-f-]{36}$/);
  await page.locator("#language-select").selectOption(locale);

  const seed = editor(page, dict.glossary.seedParent);
  const pollen = editor(page, dict.glossary.pollenParent);
  await expect(seed).toBeVisible();

  // Every option a holder can choose, in the active language. The unidentified and unknown options are distinct.
  const options = await seed.locator("select").first().locator("option").allInnerTexts();
  expect(options).toContain(dict.seeds.parentage.unidentified);
  expect(options).toContain(dict.glossary.unknownParent);
  expect(options).toContain(dict.glossary.aSeedling);
  expect(options).toContain(dict.glossary.namedCultivar);
  expect(options.filter((text) => text === dict.seeds.parentage.unidentified)).toHaveLength(1);
  expect(dict.seeds.parentage.unidentified).not.toBe(dict.glossary.unknownParent);

  // Each role's select is labelled by its own form, so the labels point at the right controls.
  await expect(seed.getByLabel(dict.seedlings.parent.howKnown)).toBeVisible();
  await expect(pollen.getByLabel(dict.seedlings.parent.howKnown)).toBeVisible();
  await seed
    .getByLabel(dict.seedlings.parent.howKnown)
    .selectOption({ label: dict.seeds.parentage.unidentified });
  // Selecting the unidentified dahlia reveals its photograph control, with an accessible label and the requirement text.
  await expect(seed.getByLabel(dict.seeds.sourcePhoto)).toBeVisible();
  await expect(seed.getByText(dict.seeds.sourcePhotoHint)).toBeVisible();
  // The pollen form is unaffected by the seed choice.
  await expect(pollen.getByLabel(dict.seeds.sourcePhoto)).toHaveCount(0);

  // The editor has no duplicate element ids, so each label targets its own control.
  const duplicates = await page.evaluate(() => {
    const seen = new Map<string, number>();
    document.querySelectorAll("[id]").forEach((el) => seen.set(el.id, (seen.get(el.id) ?? 0) + 1));
    return [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  });
  expect(duplicates).toEqual([]);

  // Keyboard focus on the role's control is visible.
  await seed.getByLabel(dict.seedlings.parent.howKnown).focus();
  const outline = await page.evaluate(
    () => getComputedStyle(document.activeElement as HTMLElement).outlineStyle,
  );
  expect(outline).toBe("solid");

  return { holder, page, dict };
}

test("in Dutch, the parent editor offers Dahlia met onbekende naam as a distinct choice, and each role's controls stay with their role", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const { holder, dict } = await runLocale(browser, "nl");
  expect(dict.seeds.parentage.unidentified).toBe("Dahlia met onbekende naam");
  expect(dict.glossary.unknownParent).toBe("Onbekend");
  await holder.close();
});

test("in French, the parent editor uses the masculine agreement for Dahlia non identifié, and the feminine form never appears", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const { holder, page, dict } = await runLocale(browser, "fr");
  expect(dict.seeds.parentage.unidentified).toBe("Dahlia non identifié");
  const body = await page.locator("body").innerText();
  expect(body).not.toContain("Une dahlia non identifiée");
  expect(body).not.toContain("Dahlia non identifiée");
  await holder.close();
});
