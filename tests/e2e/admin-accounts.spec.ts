import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { MESSAGES } from "../../src/i18n/messages";
import { withSuperuser } from "../support/local-supabase";

/*
 * Direct administrator suspension in the browser (Phase 10A). An ordinary grower gets the same not-found page as any missing resource. An
 * administrator suspends a grower without a report, with a reason, and the grower's own profile then shows the suspended notice. The
 * administrator is refused for their own account and for a blank reason, and reinstatement restores the grower.
 */

test.describe.configure({ timeout: 300_000 });

const PASSWORD = "correct-horse-battery";
const tag = "ac" + Math.random().toString(36).slice(2, 8);
const EN = MESSAGES.en;

async function signUp(page: Page, label: string, displayName: string) {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(`e2e-ac-${label}-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Country").selectOption("NL");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/profile\/setup/);
}

async function ownProfileId(page: Page): Promise<string> {
  await page.goto("/profile");
  const href = await page.locator('a[href^="/profiles/"]').first().getAttribute("href");
  expect(href).toMatch(/^\/profiles\/[0-9a-f-]{36}$/);
  return href!.split("/").pop()!;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(0);
}

async function shot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

test("an administrator suspends and reinstates a grower directly, and an ordinary grower cannot see the page", async ({
  browser,
}, testInfo) => {
  const target = await browser.newContext();
  const targetPage = await target.newPage();
  await signUp(targetPage, "target", `Target ${tag}`);
  const targetId = await ownProfileId(targetPage);

  // An ordinary grower is refused the surface, as for any missing resource.
  const refused = await targetPage.goto("/admin/accounts");
  expect(refused?.status()).toBe(404);

  const admin = await browser.newContext();
  const adminPage = await admin.newPage();
  await signUp(adminPage, "admin", `Admin ${tag}`);
  const adminId = await ownProfileId(adminPage);
  await withSuperuser((db) =>
    db.query("insert into public.admin_users (user_id) values ($1)", [adminId]),
  );

  try {
    await adminPage.goto("/admin/accounts");
    await expect(
      adminPage.getByRole("heading", { name: EN.admin.accounts.title, exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(adminPage);
    await shot(adminPage, testInfo, "admin-accounts");

    // The administrator cannot suspend their own account.
    await adminPage.getByLabel(EN.admin.accounts.profileId).fill(adminId);
    await adminPage.getByLabel(EN.admin.accounts.reason).fill("Testing my own account suspension");
    await adminPage.getByRole("button", { name: EN.admin.accounts.suspend, exact: true }).click();
    await expect(
      adminPage.getByText(EN.admin.accounts.errors.ownAccount, { exact: true }),
    ).toBeVisible();

    // A reason made only of spaces is refused, and nothing changes.
    await adminPage.goto("/admin/accounts");
    await adminPage.getByLabel(EN.admin.accounts.profileId).fill(targetId);
    await adminPage.getByLabel(EN.admin.accounts.reason).fill("            ");
    await adminPage.getByRole("button", { name: EN.admin.accounts.suspend, exact: true }).click();
    await expect(
      adminPage.getByText(EN.admin.accounts.errors.reason, { exact: true }),
    ).toBeVisible();

    // A valid reason suspends the grower, with no report.
    await adminPage.goto("/admin/accounts");
    await adminPage.getByLabel(EN.admin.accounts.profileId).fill(targetId);
    await adminPage
      .getByLabel(EN.admin.accounts.reason)
      .fill("Repeated unwanted contact after a clear request to stop");
    await adminPage.getByRole("button", { name: EN.admin.accounts.suspend, exact: true }).click();
    await expect(
      adminPage.getByText(EN.admin.accounts.notices.suspended, { exact: true }),
    ).toBeVisible();

    // The grower's own profile shows the suspended notice.
    await targetPage.goto("/profile");
    await expect(
      targetPage.getByText(EN.identity.profile.suspended, { exact: true }),
    ).toBeVisible();

    // Reinstatement restores the grower.
    await adminPage.goto("/admin/accounts");
    await adminPage.getByLabel(EN.admin.accounts.profileId).fill(targetId);
    await adminPage
      .getByLabel(EN.admin.accounts.reason)
      .fill("Review finished and the account is restored");
    await adminPage.getByRole("button", { name: EN.admin.accounts.restore, exact: true }).click();
    await expect(
      adminPage.getByText(EN.admin.accounts.notices.restored, { exact: true }),
    ).toBeVisible();
    await targetPage.goto("/profile");
    await expect(targetPage.getByText(EN.identity.profile.suspended, { exact: true })).toHaveCount(
      0,
    );
  } finally {
    await withSuperuser((db) =>
      db.query("delete from public.admin_users where user_id = $1", [adminId]),
    );
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = false where id = $1", [targetId]),
    );
    await target.close();
    await admin.close();
  }
});
