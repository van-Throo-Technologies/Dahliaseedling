import { expect, test, type Browser, type Page } from "@playwright/test";
import { MESSAGES } from "../../src/i18n/messages";
import { withSuperuser } from "../support/local-supabase";

/*
 * Phase 10C in the browser. A grower finds feedback and installation guidance from their profile, sends feedback (empty input is refused,
 * a double tap stores one item), and sees the review-pending legal pages. An administrator reviews the feedback and changes its status, and
 * an ordinary grower gets the same not-found page as any missing resource. The manifest and its icons are served, and no service worker is
 * registered.
 */

test.describe.configure({ timeout: 300_000 });

const PASSWORD = "correct-horse-battery";
const tag = "lc" + Math.random().toString(36).slice(2, 8);
const EN = MESSAGES.en;

async function signUp(page: Page, label: string) {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(`e2e-lc-${label}-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(`${label} ${tag}`);
  await page.getByLabel("Country").selectOption("NL");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/profile\/setup/);
}

async function ownProfileId(page: Page): Promise<string> {
  await page.goto("/profile");
  const href = await page.locator('a[href^="/profiles/"]').first().getAttribute("href");
  return href!.split("/").pop()!;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(0);
}

async function openWithBrowser(
  browser: Browser,
  label: string,
): Promise<{ page: Page; close: () => Promise<void>; profileId: string }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signUp(page, label);
  const profileId = await ownProfileId(page);
  return { page, close: () => context.close(), profileId };
}

test("a grower sends feedback privately, and a double tap stores one item", async ({ browser }) => {
  const grower = await openWithBrowser(browser, "grower");
  const page = grower.page;
  try {
    await page.goto("/profile");
    await expect(
      page.getByRole("heading", { name: EN.launch.install.heading, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("link", { name: EN.feedback.title, exact: true }),
    ).toBeVisible();

    await page.goto("/feedback");
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: EN.feedback.submit, exact: true }).click();
    await expect(page.getByText(EN.feedback.errors.category, { exact: true })).toBeVisible();
    await expect(page.getByText(EN.feedback.errors.message, { exact: true })).toBeVisible();

    await page.getByLabel(EN.feedback.category.idea, { exact: true }).check();
    await page
      .getByLabel(EN.feedback.message.label, { exact: true })
      .fill(`Please add a bloom calendar ${tag}`);
    await page.getByRole("button", { name: EN.feedback.submit, exact: true }).click();
    await expect(page.getByText(EN.feedback.sent, { exact: true })).toBeVisible();

    // A double tap on a second message is stored once.
    await page.getByLabel(EN.feedback.category.problem, { exact: true }).check();
    await page
      .getByLabel(EN.feedback.message.label, { exact: true })
      .fill(`Double tap check ${tag}`);
    await page.getByRole("button", { name: EN.feedback.submit, exact: true }).dblclick();
    await expect(page.getByText(EN.feedback.sent, { exact: true })).toBeVisible();
    // The author is checked by the display name this test set, so the count is for this grower's feedback only. The check polls, because
    // the second submission may still be in flight when the page is read.
    const countStored = async () =>
      (
        await withSuperuser((db) =>
          db.query(
            `select count(*)::int as n from public.feedback f join public.profiles p on p.id = f.author_id
              where f.message = $1 and p.display_name = $2`,
            [`Double tap check ${tag}`, `grower ${tag}`],
          ),
        )
      ).rows[0].n as number;
    await expect.poll(countStored, { timeout: 15_000 }).toBe(1);
    await page.waitForTimeout(1000);
    expect(await countStored()).toBe(1);

    // The footer leads to the review-pending legal pages, which say so.
    await page.goto("/profile");
    await expect(
      page.getByRole("link", { name: EN.launch.footer.privacyInfo, exact: true }),
    ).toBeVisible();
    await page.goto("/legal/privacy");
    await expect(page.getByRole("note")).toContainText(EN.launch.legal.banner);
    await expectNoHorizontalOverflow(page);
  } finally {
    await grower.close();
  }
});

test("manifest and icons are served, and no service worker is registered", async ({
  browser,
  request,
}) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: "DahliaSeedling",
    start_url: "/",
    scope: "/",
    display: "standalone",
  });
  for (const icon of manifest.icons as Array<{ src: string }>) {
    const asset = await request.get(icon.src);
    expect(asset.status(), icon.src).toBe(200);
    expect(asset.headers()["content-type"]).toContain("image/png");
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto("/legal/terms");
    const registrations = await page.evaluate(async () =>
      navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0,
    );
    expect(registrations).toBe(0);
  } finally {
    await context.close();
  }
});

test("an administrator reviews feedback and changes its status, and a grower gets the not-found page", async ({
  browser,
}) => {
  const grower = await openWithBrowser(browser, "reporter");
  const message = `Admin review ${tag}`;
  await grower.page.goto("/feedback");
  await grower.page.getByLabel(EN.feedback.category.experience, { exact: true }).check();
  await grower.page.getByLabel(EN.feedback.message.label, { exact: true }).fill(message);
  await grower.page.getByRole("button", { name: EN.feedback.submit, exact: true }).click();
  await expect(grower.page.getByText(EN.feedback.sent, { exact: true })).toBeVisible();

  const refused = await grower.page.goto("/admin/feedback");
  expect(refused?.status()).toBe(404);
  await grower.close();

  const admin = await openWithBrowser(browser, "admin");
  try {
    await withSuperuser((db) =>
      db.query("insert into public.admin_users (user_id) values ($1)", [admin.profileId]),
    );
    const page = admin.page;
    await page.goto("/admin/feedback");
    await expect(
      page.getByRole("heading", { name: EN.feedback.admin.title, exact: true }),
    ).toBeVisible();
    await expect(page.getByText(message, { exact: true })).toBeVisible();

    // Filter to experience, then move the item to resolved.
    await page.getByRole("link", { name: EN.feedback.category.experience, exact: true }).click();
    const card = page.locator("article", { hasText: message });
    await card
      .getByRole("combobox", { name: EN.feedback.admin.setStatus, exact: true })
      .selectOption("resolved");
    await card.getByRole("button", { name: EN.feedback.admin.setStatus, exact: true }).click();
    await expect(page.getByText(EN.feedback.admin.notices.updated, { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expect(page.locator("article", { hasText: message })).toContainText(
      EN.feedback.admin.status.resolved,
    );
    await withSuperuser((db) =>
      db.query("delete from public.admin_users where user_id = $1", [admin.profileId]),
    );
  } finally {
    await admin.close();
  }
});
