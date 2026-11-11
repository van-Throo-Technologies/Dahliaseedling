import { expect, test, type APIRequestContext } from "@playwright/test";
import { MESSAGES } from "../../src/i18n/messages";
import { localSupabase } from "../support/local-supabase";

/*
 * The public surface: the deployment that visitors reach without a Vercel account. It serves only the invitation journey. Everything else
 * is not found, and the visitor limit applies to requests. This file runs only against the public server (playwright.public.config.ts),
 * which has PUBLIC_SURFACE=invitations and a small hourly allowance.
 */

const EN = MESSAGES.en;

function uniqueEmail(label: string): string {
  return `${label}-${crypto.randomUUID()}@example.test`;
}

async function mintInvite(request: APIRequestContext, email: string): Promise<string> {
  const { apiUrl, secretKey } = localSupabase();
  const minted = await request.post(`${apiUrl}/auth/v1/admin/generate_link`, {
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
    data: { type: "invite", email },
  });
  const body = (await minted.json()) as { hashed_token: string };
  return body.hashed_token;
}

test("the root address goes to the invitation page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/join$/);
  await expect(
    page.getByRole("heading", { name: EN.landing.title, level: 1, exact: true }),
  ).toBeVisible();
});

test("an anonymous visitor reads the letter and reaches registration", async ({ page }) => {
  await page.goto("/join");
  await expect(page.getByText(EN.landing.p10, { exact: true })).toBeVisible();
  const cta = page.getByRole("link", { name: EN.landing.primaryCta, exact: true });
  await expect(cta).toHaveAttribute("href", "/sign-up");
});

test("the administration, private application pages and feed are not found", async ({
  request,
}) => {
  for (const path of [
    "/admin/invitations",
    "/admin/accounts",
    "/capture",
    "/profile",
    "/search",
    "/seedlings/00000000-0000-0000-0000-000000000000",
    "/api/account/export",
    "/api/email/deliver",
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(404);
  }
});

test("a request to an administration action is refused without reaching it", async ({
  request,
}) => {
  const response = await request.post("/admin/invitations", {
    headers: { "Next-Action": "0000000000000000000000000000000000000000" },
    data: "",
    maxRedirects: 0,
  });
  expect(response.status()).toBe(404);
});

test("the pages the journey needs are served", async ({ request }) => {
  expect((await request.get("/api/health", { maxRedirects: 0 })).status()).toBe(200);
  expect((await request.get("/legal/privacy", { maxRedirects: 0 })).status()).toBe(200);
  expect((await request.get("/legal/terms", { maxRedirects: 0 })).status()).toBe(200);
  expect((await request.get("/sign-in", { maxRedirects: 0 })).status()).toBe(200);
});

test("an invitation link still verifies and sends the invitee to set a password", async ({
  page,
  request,
}) => {
  const token = await mintInvite(request, uniqueEmail("invitee"));
  await page.goto(`/auth/confirm?token_hash=${token}&type=invite`);
  await expect(page).toHaveURL(/\/auth\/set-password\?next=%2F$/);
  await expect(
    page.getByRole("heading", { name: EN.identity.setPassword.title, exact: true }),
  ).toBeVisible();
});

test("a malformed or unknown invitation link is refused with the sign-in notice", async ({
  page,
}) => {
  await page.goto("/auth/confirm?type=invite");
  await expect(page).toHaveURL(/\/sign-in\?confirm=invalid$/);
  await expect(page.locator("p[role='alert']")).toHaveText(EN.identity.confirm.invalid);
});
