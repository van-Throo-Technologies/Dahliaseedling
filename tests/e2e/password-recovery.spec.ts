import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { MESSAGES } from "../../src/i18n/messages";
import { localSupabase } from "../support/local-supabase";

/*
 * Self-service password recovery, end to end. The reset link is minted through the local auth admin API, the same token hash the reset
 * email carries, so the confirmation route does the real verification and sets the real reset mark. No email is sent. Invitation and
 * sign-up links are covered by auth-confirmation.spec.ts and invitation-password.test.ts, which still pass unchanged.
 */

const EN = MESSAGES.en;
const OLD_PASSWORD = "correct-horse-battery";
const NEW_PASSWORD = "a-new-passphrase-789";

function uniqueEmail(label: string): string {
  return `recovery-${label}-${crypto.randomUUID()}@example.test`;
}

async function mint(request: APIRequestContext, body: Record<string, string>): Promise<string> {
  const { apiUrl, secretKey } = localSupabase();
  const response = await request.post(`${apiUrl}/auth/v1/admin/generate_link`, {
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
    data: body,
  });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { hashed_token: string }).hashed_token;
}

/**
 * A confirmed account with a password. The sign-up link creates it, and visiting that link confirms it, as a grower's own sign-up would.
 * The confirmation is made through the request context, so the browser under test stays signed out.
 */
async function createAccount(request: APIRequestContext, email: string): Promise<void> {
  const token = await mint(request, { type: "signup", email, password: OLD_PASSWORD });
  const confirmed = await request.get(`/auth/confirm?token_hash=${token}&type=signup`, {
    maxRedirects: 0,
  });
  expect(confirmed.status()).toBe(303);
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: EN.identity.signIn.submit, exact: true }).click();
}

test("the sign-in page offers Forgot password?, and it opens the request page", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: EN.identity.recovery.forgotLink }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(
    page.getByRole("heading", { level: 1, name: EN.identity.recovery.forgotTitle }),
  ).toBeVisible();
});

test("a reset request gives the same answer for a known and an unknown address", async ({
  page,
  request,
}) => {
  const known = uniqueEmail("known");
  await createAccount(request, known);

  for (const email of [known, uniqueEmail("unknown")]) {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: EN.identity.recovery.forgotSubmit }).click();
    await expect(page.getByRole("status")).toHaveText(EN.identity.recovery.forgotSent);
  }
});

test("a malformed address is refused as a field error, not as a sent notice", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("not-an-address");
  await page.getByRole("button", { name: EN.identity.recovery.forgotSubmit }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByText(EN.identity.recovery.forgotSent)).toHaveCount(0);
});

test("an unknown reset link returns to the request page with a clear message", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6&type=recovery");
  await expect(page).toHaveURL(/\/forgot-password\?link=(expired|invalid)$/);
  await expect(
    page.getByText(EN.identity.recovery.expired).or(page.getByText(EN.identity.recovery.invalid)),
  ).toBeVisible();
});

test("a reset link sets a new password once, and the old password stops working", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("reset");
  await createAccount(request, email);
  const token = await mint(request, { type: "recovery", email });

  await page.goto(`/auth/confirm?token_hash=${token}&type=recovery`);
  await expect(page).toHaveURL(/\/auth\/reset-password$/);
  await expect(
    page.getByRole("heading", { level: 1, name: EN.identity.recovery.resetTitle }),
  ).toBeVisible();
  await page.locator('input[name="password"]').fill(NEW_PASSWORD);
  await page.getByRole("button", { name: EN.identity.recovery.resetSubmit }).click();
  await expect(page).toHaveURL(/\/sign-in\?reset=1$/);
  await expect(page.getByRole("status")).toHaveText(EN.identity.recovery.resetDone);

  // The old password is refused, the new one is accepted.
  await signIn(page, email, OLD_PASSWORD);
  await expect(page.getByText(EN.identity.signIn.badCredentials)).toBeVisible();
  await signIn(page, email, NEW_PASSWORD);
  await expect(page).not.toHaveURL(/\/sign-in/);

  // The same link cannot be used again.
  await page.goto(`/auth/confirm?token_hash=${token}&type=recovery`);
  await expect(page).toHaveURL(/\/forgot-password\?link=(expired|invalid)$/);
});

test("an ordinary signed-in session cannot open the new-password page", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("ordinary");
  await createAccount(request, email);
  await signIn(page, email, OLD_PASSWORD);
  await expect(page).not.toHaveURL(/\/sign-in/);

  await page.goto("/auth/reset-password");
  await expect(page).toHaveURL(/\/forgot-password\?link=expired$/);
});
