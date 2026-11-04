import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { MESSAGES } from "../../src/i18n/messages";

/*
 * Phase 10B privacy settings in the browser. A grower downloads their data, which arrives as a real ZIP archive. They deactivate, which
 * needs a confirmation and takes effect at once. Then they request erasure, and the page lists every step that is still outstanding and
 * never shows the erasure as complete.
 */

test.describe.configure({ timeout: 300_000 });

const PASSWORD = "correct-horse-battery";
const tag = "pv" + Math.random().toString(36).slice(2, 8);
const EN = MESSAGES.en;

async function signUp(page: Page) {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(`e2e-pv-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(`Privacy ${tag}`);
  await page.getByLabel("Country").selectOption("NL");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/profile\/setup/);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(0);
}

test("a grower downloads a real archive, deactivates with confirmation, and sees erasure steps still outstanding", async ({
  page,
}, testInfo: TestInfo) => {
  await signUp(page);

  await page.goto("/profile");
  await page.getByRole("link", { name: EN.privacy.link, exact: true }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: EN.privacy.title, exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await testInfo.attach("privacy-settings", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });

  // The export downloads as a ZIP archive whose first bytes are the ZIP signature.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: EN.privacy.export.action, exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^dahliaseedling-export-\d{4}-\d{2}-\d{2}\.zip$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  const bytes = readFileSync(path!);
  expect(bytes.subarray(0, 2).toString("ascii")).toBe("PK");

  // Deactivation needs the confirmation box. Submitting without it changes nothing and says why.
  // The box is required, so the browser refuses the submission and the account does not change.
  await page.getByRole("button", { name: EN.privacy.deactivate.action, exact: true }).click();
  await expect(page.getByLabel(EN.privacy.deactivate.confirm, { exact: true })).toHaveJSProperty(
    "validity.valid",
    false,
  );
  await expect(page.getByText(EN.privacy.state.active, { exact: true })).toBeVisible();

  await page.getByLabel(EN.privacy.deactivate.confirm, { exact: true }).check();
  await page.getByRole("button", { name: EN.privacy.deactivate.action, exact: true }).click();
  await expect(page.getByText(EN.privacy.deactivate.done, { exact: true })).toBeVisible();
  await expect(page.getByText(EN.privacy.state.deactivated, { exact: true })).toBeVisible();

  // Erasure is requested with its own confirmation. The page lists the outstanding steps and does not show completion.
  await page.getByLabel(EN.privacy.erasure.confirm, { exact: true }).check();
  await page.getByRole("button", { name: EN.privacy.erasure.action, exact: true }).click();
  await expect(page.getByText(EN.privacy.erasure.requested, { exact: true })).toBeVisible();
  await expect(page.getByText(EN.privacy.state.pendingErasure, { exact: true })).toBeVisible();
  await expect(
    page.getByText(EN.privacy.erasure.steps.authIdentity, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(EN.privacy.erasure.outstanding, { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText(EN.privacy.erasure.outstandingNote, { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("the export refuses a visitor, and nothing is downloaded", async ({ request }) => {
  const response = await request.get("/api/account/export");
  expect(response.status()).toBe(401);
  expect(response.headers()["content-type"] ?? "").not.toContain("application/zip");
});
