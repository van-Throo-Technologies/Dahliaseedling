import { expect, test, type APIRequestContext } from "@playwright/test";
import { MESSAGES } from "../../src/i18n/messages";
import { localSupabase } from "../support/local-supabase";

/*
 * Email confirmation and invitation links, end to end. The links are minted through the local auth admin API, the same token hash
 * the confirmation email carries, so the route under test does the real verification and sets the real session cookies.
 */

const EN = MESSAGES.en;
const DROPPED_HEADERS = ["cookie", "host", "content-length"];
const PASSWORD = "correct-horse-battery";

function uniqueEmail(label: string): string {
  return `${label}-${crypto.randomUUID()}@example.test`;
}

async function mintTokenHash(
  request: APIRequestContext,
  type: "signup" | "invite",
  email: string,
): Promise<string> {
  const { apiUrl, secretKey } = localSupabase();
  const response = await request.post(`${apiUrl}/auth/v1/admin/generate_link`, {
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
    data: type === "signup" ? { type, email, password: PASSWORD } : { type, email },
  });
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { hashed_token: string };
  return body.hashed_token;
}

test("a confirmed sign-up is signed in and goes on to profile setup with a notice", async ({
  page,
  request,
}) => {
  const token = await mintTokenHash(request, "signup", uniqueEmail("confirm-ok"));

  await page.goto(`/auth/confirm?token_hash=${token}&type=signup`);

  await expect(page).toHaveURL(/\/profile\/setup\?next=%2F&confirmed=1$/);
  await expect(page.getByRole("status")).toHaveText(EN.identity.confirm.signedUp);
  await expect(
    page.getByRole("heading", { name: EN.identity.setup.title, exact: true }),
  ).toBeVisible();
});

test("a link that was already used is refused as expired, and the sign-in page says so", async ({
  page,
  request,
}) => {
  const token = await mintTokenHash(request, "signup", uniqueEmail("confirm-reuse"));

  await page.goto(`/auth/confirm?token_hash=${token}&type=signup`);
  await expect(page).toHaveURL(/\/profile\/setup/);

  await page.context().clearCookies();
  await page.goto(`/auth/confirm?token_hash=${token}&type=signup`);

  await expect(page).toHaveURL(/\/sign-in\?confirm=expired$/);
  await expect(page.locator("p[role='alert']")).toHaveText(EN.identity.confirm.expired);
});

test("a malformed link is refused without contacting the auth server, with the invalid notice", async ({
  page,
}) => {
  await page.goto("/auth/confirm?type=signup");

  await expect(page).toHaveURL(/\/sign-in\?confirm=invalid$/);
  await expect(page.locator("p[role='alert']")).toHaveText(EN.identity.confirm.invalid);
});

test("an unknown but well-formed link is refused, and the sign-in page shows an error", async ({
  page,
}) => {
  // The auth server reports a token it does not recognise as expired, so the visitor sees the expired notice.
  await page.goto(`/auth/confirm?token_hash=${"f".repeat(64)}&type=signup`);

  await expect(page).toHaveURL(/\/sign-in\?confirm=expired$/);
  await expect(page.locator("p[role='alert']")).toHaveText(EN.identity.confirm.expired);
});

test("a destination on another site is never followed after confirmation", async ({
  page,
  request,
  baseURL,
}) => {
  const baseHost = new URL(baseURL!).host;

  for (const next of ["https://evil.example/steal", "//evil.example/steal"]) {
    await page.context().clearCookies();
    const token = await mintTokenHash(request, "signup", uniqueEmail("confirm-redirect"));
    await page.goto(
      `/auth/confirm?token_hash=${token}&type=signup&next=${encodeURIComponent(next)}`,
    );

    await expect(page).toHaveURL(/\/profile\/setup\?next=%2F&confirmed=1$/);
    expect(new URL(page.url()).host).toBe(baseHost);
  }
});

test("an invitation sets a password, which then signs the invitee in with email and password", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("invite");
  const token = await mintTokenHash(request, "invite", email);

  await page.goto(`/auth/confirm?token_hash=${token}&type=invite`);
  await expect(page).toHaveURL(/\/auth\/set-password\?next=%2F$/);
  await expect(
    page.getByRole("heading", { name: EN.identity.setPassword.title, exact: true }),
  ).toBeVisible();

  await page.getByLabel(EN.identity.fields.password, { exact: true }).fill("a-new-password-123");
  await page.getByRole("button", { name: EN.identity.setPassword.submit, exact: true }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);

  const { apiUrl, publishableKey } = localSupabase();
  const signIn = await request.post(`${apiUrl}/auth/v1/token?grant_type=password`, {
    headers: { apikey: publishableKey },
    data: { email, password: "a-new-password-123" },
  });
  expect(signIn.ok()).toBe(true);
});

test("the set-password page is not reachable without an invitation session", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/auth/set-password?next=%2F");

  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await context.close();
});

test("an ordinary signed-in account is refused the invitation password page and gets no form", async ({
  page,
  request,
}) => {
  const token = await mintTokenHash(request, "signup", uniqueEmail("ordinary"));
  await page.goto(`/auth/confirm?token_hash=${token}&type=signup`);
  await expect(page).toHaveURL(/\/profile\/setup/);

  await page.goto("/auth/set-password?next=%2F");

  await expect(
    page.getByRole("heading", { name: EN.identity.setPassword.closedTitle, exact: true }),
  ).toBeVisible();
  await expect(page.locator("p[role='alert']")).toHaveText(EN.identity.setPassword.notInvited);
  await expect(page.locator("input[name='password']")).toHaveCount(0);
});

test("a completed invitation cannot be repeated, from the page or from the link", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("invite-once");
  const token = await mintTokenHash(request, "invite", email);

  await page.goto(`/auth/confirm?token_hash=${token}&type=invite`);
  await page.getByLabel(EN.identity.fields.password, { exact: true }).fill("a-first-password-789");
  await page.getByRole("button", { name: EN.identity.setPassword.submit, exact: true }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);

  await page.goto("/auth/set-password?next=%2F");
  await expect(page.locator("input[name='password']")).toHaveCount(0);
  await expect(page.locator("p[role='alert']")).toHaveText(EN.identity.setPassword.notInvited);

  await page.context().clearCookies();
  await page.goto(`/auth/confirm?token_hash=${token}&type=invite`);
  await expect(page).toHaveURL(/\/sign-in\?confirm=expired$/);
  await expect(page.locator("p[role='alert']")).toHaveText(EN.identity.confirm.expired);
});

test("an invalid invitation link is refused, and the sign-in page shows the notice", async ({
  page,
}) => {
  await page.goto(`/auth/confirm?token_hash=${"e".repeat(64)}&type=invite`);

  await expect(page).toHaveURL(/\/sign-in\?confirm=expired$/);
  await expect(page.locator("p[role='alert']")).toHaveText(EN.identity.confirm.expired);
});

test("an ordinary account cannot invoke the invitation password action directly, and its password does not change", async ({
  browser,
  request,
  baseURL,
}) => {
  const ordinaryEmail = uniqueEmail("forge-ordinary");
  const ordinaryContext = await browser.newContext();
  const ordinary = await ordinaryContext.newPage();
  const signupToken = await mintTokenHash(request, "signup", ordinaryEmail);
  await ordinary.goto(`/auth/confirm?token_hash=${signupToken}&type=signup`);
  await expect(ordinary).toHaveURL(/\/profile\/setup/);

  // A pending invitee submits the real form once. The request is captured and never reaches the server, so the invitation stays open.
  const inviteeContext = await browser.newContext();
  const invitee = await inviteeContext.newPage();
  const inviteToken = await mintTokenHash(request, "invite", uniqueEmail("forge-invitee"));
  await invitee.goto(`/auth/confirm?token_hash=${inviteToken}&type=invite`);
  await expect(invitee).toHaveURL(/\/auth\/set-password/);
  const captured: { headers: Record<string, string>; body: string }[] = [];
  await invitee.route("**/auth/set-password**", async (route) => {
    if (route.request().method() === "POST") {
      captured.push({ headers: route.request().headers(), body: route.request().postData() ?? "" });
      await route.abort();
      return;
    }
    await route.continue();
  });
  await invitee
    .getByLabel(EN.identity.fields.password, { exact: true })
    .fill("invitee-first-pass-1");
  await invitee.getByRole("button", { name: EN.identity.setPassword.submit, exact: true }).click();
  await expect.poll(() => captured.length).toBe(1);
  await inviteeContext.close();

  // The ordinary account replays that exact request with its own session cookies and a different password.
  const forged = "forged-password-999";
  // The captured request carries the invitee's cookie, host and length, so those are dropped.
  const headers = Object.fromEntries(
    Object.entries(captured[0]!.headers).filter(([name]) => !DROPPED_HEADERS.includes(name)),
  );
  const response = await ordinaryContext.request.post(
    new URL("/auth/set-password?next=%2F", baseURL).toString(),
    {
      headers,
      data: captured[0]!.body.replaceAll("invitee-first-pass-1", forged),
    },
  );
  const text = await response.text();
  // A server action's response also re-renders the page, which shows this notice to an ordinary account. The notice therefore only shows
  // that the response came back; the password checks below are what show the gate held.
  expect(text).toContain(EN.identity.setPassword.notInvited);

  // The stored password is unchanged: the original still signs in, and the forged one does not.
  const { apiUrl, publishableKey } = localSupabase();
  const signIn = (password: string) =>
    request.post(`${apiUrl}/auth/v1/token?grant_type=password`, {
      headers: { apikey: publishableKey },
      data: { email: ordinaryEmail, password },
    });
  expect((await signIn(PASSWORD)).ok()).toBe(true);
  expect((await signIn(forged)).ok()).toBe(false);
  await ordinaryContext.close();
});
