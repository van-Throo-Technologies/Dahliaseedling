import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import sharp from "sharp";
import { MESSAGES } from "../../src/i18n/messages";
import { withSuperuser } from "../support/local-supabase";

/*
 * Moderation in the browser. A grower reports a public Update, a comment and a profile, and the reporter sees a confirmation
 * without the reported grower being told. An administrator reviews the report from the protected surface and marks it reviewed;
 * an ordinary grower gets the same not-found page as any missing resource. The reporting journey is split across the two
 * projects: the Update and profile on phone, the comment on desktop.
 */

test.describe.configure({ timeout: 300_000 });

const PASSWORD = "correct-horse-battery";
const tag = "mo" + Math.random().toString(36).slice(2, 8);
const EN = MESSAGES.en;

async function signUp(page: Page, label: string, displayName: string, country: string) {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(`e2e-mo-${label}-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Country").selectOption(country);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/profile\/setup/);
}

/** The signed-in grower's public profile path, read from their own profile page. */
async function ownProfilePath(page: Page): Promise<string> {
  await page.goto("/profile");
  const href = await page.locator('a[href^="/profiles/"]').first().getAttribute("href");
  expect(href).toMatch(/^\/profiles\/[0-9a-f-]{36}$/);
  return href!;
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

/** Captures a photo into a new public Seedling and shares it as a public Update; returns the Update path. */
async function publishUpdate(page: Page): Promise<string> {
  const photo = await sharp({
    create: { width: 900, height: 600, channels: 3, background: "rgb(192,80,128)" },
  })
    .jpeg()
    .toBuffer();
  await page.goto("/capture");
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "bloom.jpg", mimeType: "image/jpeg", buffer: photo });
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\/[0-9a-f-]{36}\?saved=1$/);
  const observation = page.url().split("?")[0]!;
  await page.goto(observation);
  await page.getByRole("link", { name: "Share selected photos" }).click();
  await page.getByRole("button", { name: "Make Seedling public & continue" }).click();
  await expect(page).toHaveURL(/\/share\?public=1/);
  await page.getByLabel("Share photo 1").check();
  await page.getByLabel("Caption (optional)").fill(`Moderated bloom ${tag}`);
  await page.getByRole("button", { name: "Publish update" }).click();
  await expect(page).toHaveURL(/\/updates\/[0-9a-f-]{36}\?published=1/);
  return new URL(page.url()).pathname;
}

test("a grower reports an Update, a comment and a profile; the reporter is confirmed and the reported grower is not told", async ({
  browser,
}: {
  browser: Browser;
}, testInfo) => {
  test.skip(
    testInfo.project.name === "desktop",
    "the Update and profile reports run on the phone project",
  );
  const alice = await browser.newContext();
  const aliceP = await alice.newPage();
  await signUp(aliceP, "alice", `Alice ${tag}`, "NL");
  const update = await publishUpdate(aliceP);
  const aliceProfile = await ownProfilePath(aliceP);

  const bob = await browser.newContext();
  const bobP = await bob.newPage();
  await signUp(bobP, "bob", `Bob ${tag}`, "BE");

  // Bob reports Alice's public Update.
  await bobP.goto(update);
  await bobP.getByText(EN.safety.report.linkUpdate, { exact: true }).click();
  await bobP.getByLabel(EN.safety.report.reason, { exact: true }).selectOption("spam");
  await bobP.getByLabel(EN.safety.report.details, { exact: true }).fill("Looks like advertising");
  await bobP.getByRole("button", { name: EN.safety.report.submit, exact: true }).click();
  await expect(bobP.getByRole("status")).toContainText(EN.safety.report.sent);
  await expectNoHorizontalOverflow(bobP);
  await shot(bobP, testInfo, "bob-report-update");

  // Bob reports Alice's profile, from the profile page, not his own.
  await bobP.goto(aliceProfile);
  await bobP.getByText(EN.safety.report.link, { exact: true }).click();
  await bobP.getByLabel(EN.safety.report.reason, { exact: true }).selectOption("harassment");
  await bobP.getByRole("button", { name: EN.safety.report.submit, exact: true }).click();
  await expect(bobP.getByRole("status")).toContainText(EN.safety.report.sent);

  // Alice sees her own Update and profile unchanged, and no report text in her notifications.
  await aliceP.goto("/notifications");
  await expect(aliceP.getByText(EN.safety.report.sent)).toHaveCount(0);
  await expectNoHorizontalOverflow(aliceP);

  await alice.close();
  await bob.close();
});

test("a grower reports another grower's comment on an Update", async ({
  browser,
}: { browser: Browser }, testInfo) => {
  test.skip(testInfo.project.name === "phone", "the comment report runs on the desktop project");
  const alice = await browser.newContext();
  const aliceP = await alice.newPage();
  await signUp(aliceP, "alice", `Alice ${tag}`, "NL");
  const update = await publishUpdate(aliceP);

  const bob = await browser.newContext();
  const bobP = await bob.newPage();
  await signUp(bobP, "bob", `Bob ${tag}`, "BE");
  await bobP.goto(update);
  await bobP
    .getByLabel(EN.publication.comments.yourComment, { exact: true })
    .fill(`A comment to report ${tag}`);
  await bobP.getByRole("button", { name: EN.publication.comments.send, exact: true }).click();
  await expect(bobP.locator("p", { hasText: `A comment to report ${tag}` })).toBeVisible();

  // Alice reports Bob's comment. The comment stays visible; only the report is recorded.
  await aliceP.goto(update);
  await aliceP.getByText(EN.safety.report.linkComment, { exact: true }).click();
  await aliceP.getByLabel(EN.safety.report.reason, { exact: true }).selectOption("inappropriate");
  await aliceP.getByRole("button", { name: EN.safety.report.submit, exact: true }).click();
  await expect(aliceP.getByRole("status")).toContainText(EN.safety.report.sent);
  await expect(aliceP.locator("p", { hasText: `A comment to report ${tag}` })).toBeVisible();
  await expectNoHorizontalOverflow(aliceP);
  await shot(aliceP, testInfo, "alice-report-comment");

  await alice.close();
  await bob.close();
});

test("an administrator reviews a report from the protected surface; an ordinary grower gets not found", async ({
  browser,
}: {
  browser: Browser;
}, testInfo) => {
  const reporter = await browser.newContext();
  const reporterP = await reporter.newPage();
  await signUp(reporterP, "reporter", `Reporter ${tag}`, "BE");
  const target = await browser.newContext();
  const targetP = await target.newPage();
  await signUp(targetP, "target", `Target ${tag}`, "NL");
  const targetProfile = await ownProfilePath(targetP);
  await reporterP.goto(targetProfile);
  await reporterP.getByText(EN.safety.report.link, { exact: true }).click();
  await reporterP.getByLabel(EN.safety.report.reason, { exact: true }).selectOption("spam");
  await reporterP.getByRole("button", { name: EN.safety.report.submit, exact: true }).click();
  await expect(reporterP.getByRole("status")).toContainText(EN.safety.report.sent);

  // An ordinary grower is refused the surface, and it looks like any missing page.
  const ordinary = await reporter.newPage();
  const refused = await ordinary.goto("/admin/reports");
  expect(refused?.status()).toBe(404);

  // The administrator is granted access in the test database, then reviews the report.
  const admin = await browser.newContext();
  const adminP = await admin.newPage();
  await signUp(adminP, "admin", `Admin ${tag}`, "FR");
  const adminProfile = await ownProfilePath(adminP);
  await withSuperuser((db) =>
    db.query("insert into public.admin_users (user_id) values ($1)", [
      adminProfile.split("/").pop(),
    ]),
  );
  try {
    await adminP.goto("/admin/reports");
    await expect(
      adminP.getByRole("heading", { name: EN.admin.reports.title, exact: true }),
    ).toBeVisible();
    const card = adminP.locator("article", { hasText: `Target ${tag}` }).first();
    await expect(
      card.getByText(EN.admin.reports.targetLabel.profile, { exact: false }),
    ).toBeVisible();
    await expect(
      card.getByText(EN.admin.reports.reporter.replace("{name}", `Reporter ${tag}`)),
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: EN.admin.reports.actions.suspend, exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(adminP);
    await shot(adminP, testInfo, "admin-reports");

    await card.getByRole("button", { name: EN.admin.reports.actions.review, exact: true }).click();
    await expect(adminP.getByRole("status")).toContainText(EN.admin.reports.notices.resolved);
    await expect(adminP.locator("article", { hasText: `Target ${tag}` })).toHaveCount(0);
    await adminP.getByRole("link", { name: EN.admin.reports.filterAll, exact: true }).click();
    await expect(adminP.locator("article", { hasText: `Target ${tag}` }).first()).toContainText(
      EN.admin.reports.statusLabel.reviewed,
    );
  } finally {
    await withSuperuser((db) =>
      db.query("delete from public.admin_users where user_id = $1", [
        adminProfile.split("/").pop(),
      ]),
    );
  }

  await reporter.close();
  await target.close();
  await admin.close();
});
