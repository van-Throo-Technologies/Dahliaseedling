import { expect, test, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";
import { MESSAGES } from "../../src/i18n/messages";

/*
 * Recording an unidentified dahlia as a parent, through the normal parentage editor. The holder records the seed parent
 * with its photograph, records the pollen parent as unknown, and the two stay independent. A refusal without a photograph
 * creates nothing. A source the grower already owns can be reused. The Dutch display keeps the unidentified dahlia distinct
 * from an unknown parent.
 */

test.describe.configure({ timeout: 240_000 });

const PASSWORD = "correct-horse-battery";
const tag = "sp" + Math.random().toString(36).slice(2, 8);
const EN = MESSAGES.en;
const NL = MESSAGES.nl;

async function signUp(page: Page, label: string, displayName: string) {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(`e2e-sp-${label}-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Country").selectOption("NL");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/profile\/setup/);
}

async function createSeedling(page: Page, name: string): Promise<string> {
  await page.goto("/seedlings/new");
  await page.getByLabel("Working name (optional)").fill(name);
  await page.getByRole("button", { name: "Create seedling" }).click();
  await expect(page).toHaveURL(/\/seedlings\/[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname;
}

async function photo(): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const buffer = await sharp({
    create: { width: 480, height: 360, channels: 3, background: "rgb(140,40,90)" },
  })
    .jpeg()
    .toBuffer();
  return { name: "plant.jpg", mimeType: "image/jpeg", buffer };
}

/** The form for one parent role, found by its heading, so each action touches only its own role. */
function parentForm(page: Page, heading: string) {
  return page.locator("form", { has: page.getByRole("heading", { name: heading, exact: true }) });
}

test("the holder records an unidentified seed parent with its photograph, the pollen parent stays unknown, and the display keeps them apart", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const holder = await browser.newContext();
  const page = await holder.newPage();
  await signUp(page, "holder", `Holder ${tag}`);
  const path = await createSeedling(page, `Parent ${tag}`);

  // Seed parent: an unidentified dahlia, with its photograph and the grower's own description.
  const seed = parentForm(page, EN.glossary.seedParent);
  await seed
    .getByLabel(EN.seedlings.parent.howKnown)
    .selectOption({ label: EN.seeds.parentage.unidentified });
  await seed.getByLabel(EN.seeds.description).fill(`Neighbour's dahlia ${tag}`);
  await seed.getByLabel(EN.seeds.sourcePhoto).setInputFiles(await photo());
  await seed
    .getByRole("button", {
      name: EN.seedlings.parent.submit.replace("{role}", EN.glossary.seedParent.toLowerCase()),
    })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(EN.seedlings.parent.saved)).toBeVisible();

  // Pollen parent: unknown, recorded independently of the seed parent.
  const pollen = parentForm(page, EN.glossary.pollenParent);
  await pollen
    .getByLabel(EN.seedlings.parent.howKnown)
    .selectOption({ label: EN.glossary.unknownParent });
  await pollen
    .getByRole("button", {
      name: EN.seedlings.parent.submit.replace("{role}", EN.glossary.pollenParent.toLowerCase()),
    })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(EN.seedlings.parent.saved)).toBeVisible();

  // The page shows the seed parent as an unidentified dahlia with its description, and the pollen parent as unknown.
  // The pollen save commits just after the network goes idle, so poll for the second row rather than reading once.
  await expect(async () => {
    await page.goto(path);
    await expect(page.locator("main li", { hasText: EN.glossary.pollenParent })).toHaveCount(1);
  }).toPass({ timeout: 20_000 });
  const main = page.locator("main");
  await expect(
    main.getByText(
      EN.seeds.parentage.description.replace("{description}", `Neighbour's dahlia ${tag}`),
    ),
  ).toBeVisible();
  await expect(
    main.locator("span", { hasText: new RegExp(`^${EN.glossary.unknownParent}$`) }).first(),
  ).toBeVisible();
  // The unidentified dahlia is never presented as a cultivar or a seedling identity.
  await expect(
    main.locator("span", { hasText: new RegExp(`^${EN.seeds.sourceName.cultivar}$`) }),
  ).toHaveCount(0);

  await holder.close();
});

test("without a photograph the parent is refused and nothing is recorded; an owned source can be reused without a new photograph", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const holder = await browser.newContext();
  const page = await holder.newPage();
  await signUp(page, "reuse", `Reuse ${tag}`);
  const path = await createSeedling(page, `Reuse parent ${tag}`);

  // Refused: no photograph for a new unidentified source.
  const seed = parentForm(page, EN.glossary.seedParent);
  await seed
    .getByLabel(EN.seedlings.parent.howKnown)
    .selectOption({ label: EN.seeds.parentage.unidentified });
  await seed
    .getByRole("button", {
      name: EN.seedlings.parent.submit.replace("{role}", EN.glossary.seedParent.toLowerCase()),
    })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(EN.seeds.errors.sourcePhotoRequired)).toBeVisible();
  await page.goto(path);
  // Only the recorded parentage display counts here; the select's own option list also names the choice.
  await expect(page.locator("main span", { hasText: EN.seeds.parentage.unidentified })).toHaveCount(
    0,
  );

  // Record one with a photograph first, so the grower owns a source.
  await page.goto(path);
  const first = parentForm(page, EN.glossary.seedParent);
  await first
    .getByLabel(EN.seedlings.parent.howKnown)
    .selectOption({ label: EN.seeds.parentage.unidentified });
  await first.getByLabel(EN.seeds.description).fill(`Owned source ${tag}`);
  await first.getByLabel(EN.seeds.sourcePhoto).setInputFiles(await photo());
  await first
    .getByRole("button", {
      name: EN.seedlings.parent.submit.replace("{role}", EN.glossary.seedParent.toLowerCase()),
    })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(EN.seedlings.parent.saved)).toBeVisible();

  // A second seedling reuses that source: no new photograph is required.
  const second = await createSeedling(page, `Second parent ${tag}`);
  await page.goto(second);
  const reuse = parentForm(page, EN.glossary.seedParent);
  await reuse
    .getByLabel(EN.seedlings.parent.howKnown)
    .selectOption({ label: EN.seeds.parentage.unidentified });
  await reuse.getByLabel(EN.seeds.parentage.source).selectOption({ label: `Owned source ${tag}` });
  await reuse
    .getByRole("button", {
      name: EN.seedlings.parent.submit.replace("{role}", EN.glossary.seedParent.toLowerCase()),
    })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(EN.seedlings.parent.saved)).toBeVisible();

  await holder.close();
});

test("in Dutch the unidentified dahlia reads as a dahlia with an unknown name, distinct from an unknown parent", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const holder = await browser.newContext();
  const page = await holder.newPage();
  await signUp(page, "dutch", `Nederlands ${tag}`);
  const path = await createSeedling(page, `Nl parent ${tag}`);

  const seed = parentForm(page, EN.glossary.seedParent);
  await seed
    .getByLabel(EN.seedlings.parent.howKnown)
    .selectOption({ label: EN.seeds.parentage.unidentified });
  await seed.getByLabel(EN.seeds.sourcePhoto).setInputFiles(await photo());
  await seed
    .getByRole("button", {
      name: EN.seedlings.parent.submit.replace("{role}", EN.glossary.seedParent.toLowerCase()),
    })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(EN.seedlings.parent.saved)).toBeVisible();

  await page.locator("#language-select").selectOption("nl");
  await expect(page).toHaveURL(new RegExp(`${path}(\\?|$)`));
  const main = page.locator("main");
  await expect(
    main.getByText(NL.seeds.parentage.unidentified, { exact: true }).first(),
  ).toBeVisible();
  expect(NL.seeds.parentage.unidentified).not.toBe(NL.glossary.unknownParent);

  await holder.close();
});
