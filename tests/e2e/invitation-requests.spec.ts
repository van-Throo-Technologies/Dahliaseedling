import { expect, test, type APIRequestContext, type Browser } from "@playwright/test";
import { MESSAGES } from "../../src/i18n/messages";
import { localSupabase, withSuperuser } from "../support/local-supabase";

/*
 * Invitation requests, end to end. The public form is used exactly as a visitor would use it. The administrator reviews the requests
 * with an ordinary sign-in, so the same access rules apply as for any administrator.
 */

const EN = MESSAGES.en;
const PASSWORD = "correct-horse-battery";
const REASON = "I grow dahlias from seed and want to share real plants.";

function uniqueEmail(label: string): string {
  return `${label}-${crypto.randomUUID()}@example.test`;
}

async function submitRequest(browser: Browser, email: string): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/join");
  await page.getByLabel(EN.invitations.join.name, { exact: true }).fill("Anna de Vries");
  await page.getByLabel(EN.invitations.join.country, { exact: true }).selectOption("NL");
  await page.getByLabel(EN.invitations.join.email, { exact: true }).fill(email);
  await page.getByLabel(EN.invitations.join.reason, { exact: true }).fill(REASON);
  await page.getByRole("button", { name: EN.invitations.join.submit, exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(EN.invitations.join.received);
  await context.close();
}

async function administratorContext(browser: Browser, request: APIRequestContext) {
  const { apiUrl, secretKey } = localSupabase();
  const email = uniqueEmail("reviewer");
  const minted = await request.post(`${apiUrl}/auth/v1/admin/generate_link`, {
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
    data: { type: "signup", email, password: PASSWORD },
  });
  const { hashed_token: tokenHash } = (await minted.json()) as { hashed_token: string };

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/auth/confirm?token_hash=${tokenHash}&type=signup`);
  await expect(page).toHaveURL(/\/profile\/setup/);

  await withSuperuser((db) =>
    db.query(
      "insert into public.admin_users (user_id) select id from auth.users where email = $1 on conflict do nothing",
      [email],
    ),
  );
  return { context, page };
}

async function storedStatus(email: string): Promise<string | undefined> {
  return withSuperuser(async (db) => {
    const { rows } = await db.query(
      "select status from public.invitation_requests where email = $1 order by created_at desc limit 1",
      [email],
    );
    return rows[0]?.status as string | undefined;
  });
}

test("a visitor's request is stored as pending, and creates no account", async ({ browser }) => {
  const email = uniqueEmail("ask");
  await submitRequest(browser, email);

  expect(await storedStatus(email)).toBe("pending");
  const accounts = await withSuperuser(
    async (db) =>
      (await db.query("select count(*)::int as n from auth.users where email = $1", [email]))
        .rows[0],
  );
  expect(accounts.n).toBe(0);
});

test("the hero shows the founder's photograph with its alt text, and the page still works without it", async ({
  page,
}) => {
  await page.goto("/join");
  const photograph = page.getByRole("img", { name: EN.invitations.join.heroAlt, exact: true });
  await expect(photograph).toBeVisible();
  expect(
    await photograph.evaluate((element) => (element as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
});

test("without the photograph, the heading and the request form still work", async ({ page }) => {
  await page.route("**/images/dahlia-founder.jpg", (route) => route.abort());
  await page.goto("/join");
  await expect(
    page.getByRole("heading", { name: EN.invitations.join.heroHeading, level: 1, exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel(EN.invitations.join.email, { exact: true })).toBeVisible();
});

test("the hero leads with the heading, and its button takes a visitor to the form without horizontal scrolling", async ({
  page,
}) => {
  await page.goto("/join");
  await expect(
    page.getByRole("heading", { name: EN.invitations.join.heroHeading, level: 1, exact: true }),
  ).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole("link", { name: EN.invitations.join.requestCta, exact: true }).click();
  await expect(page.getByLabel(EN.invitations.join.email, { exact: true })).toBeInViewport();
});

test("on a phone, the fixed navigation covers neither the focused field nor the submit button", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "phone",
    "The bottom navigation is fixed only on phone-sized screens.",
  );
  await page.goto("/join");

  const bar = await page
    .getByRole("navigation", { name: EN.app.nav.label, exact: true })
    .boundingBox();
  expect(bar).not.toBeNull();
  const overlaps = (box: { x: number; y: number; width: number; height: number } | null) =>
    box !== null && box.y < bar!.y + bar!.height && box.y + box.height > bar!.y;

  const reason = page.getByLabel(EN.invitations.join.reason, { exact: true });
  await reason.focus();
  expect(overlaps(await reason.boundingBox())).toBe(false);

  const submit = page.getByRole("button", { name: EN.invitations.join.submit, exact: true });
  await submit.focus();
  expect(overlaps(await submit.boundingBox())).toBe(false);

  await page.mouse.wheel(0, 5000);
  await expect(submit).toBeInViewport();
  expect(overlaps(await submit.boundingBox())).toBe(false);
});

test("the request page tells the founder's story before the form", async ({ page }) => {
  await page.goto("/join");
  await expect(
    page.getByRole("heading", { name: EN.invitations.join.storyHeading, exact: true }),
  ).toBeVisible();
  await expect(page.getByText(EN.invitations.join.signOffRole, { exact: true })).toBeVisible();
});

test("a filled honeypot gets the same answer, and nothing is stored", async ({ browser }) => {
  const email = uniqueEmail("bot");
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/join");
  await page.getByLabel(EN.invitations.join.name, { exact: true }).fill("Automated Visitor");
  await page.getByLabel(EN.invitations.join.country, { exact: true }).selectOption("NL");
  await page.getByLabel(EN.invitations.join.email, { exact: true }).fill(email);
  await page.getByLabel(EN.invitations.join.reason, { exact: true }).fill(REASON);
  await page.locator("input[name='website']").evaluate((element) => {
    (element as HTMLInputElement).value = "https://spam.example";
  });
  await page.getByRole("button", { name: EN.invitations.join.submit, exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(EN.invitations.join.received);
  await context.close();

  expect(await storedStatus(email)).toBeUndefined();
});

test("an invalid request shows the field errors and stores nothing", async ({ page }) => {
  await page.goto("/join");
  await page.getByRole("button", { name: EN.invitations.join.submit, exact: true }).click();
  await expect(page.getByText(EN.invitations.errors.email, { exact: true })).toBeVisible();
  await expect(page.getByText(EN.invitations.errors.name, { exact: true })).toBeVisible();
});

test("the review page is not found for a visitor, so the requests stay hidden", async ({
  page,
}) => {
  const response = await page.goto("/admin/invitations");
  expect(response?.status()).toBe(404);
});

test("an administrator declines one request, approves another, and records the invitation as sent once", async ({
  browser,
  request,
}) => {
  const declinedEmail = uniqueEmail("declined");
  const approvedEmail = uniqueEmail("approved");
  await submitRequest(browser, declinedEmail);
  await submitRequest(browser, approvedEmail);

  const { context, page } = await administratorContext(browser, request);
  await page.goto("/admin/invitations");

  const declinedCard = page.locator("article", { hasText: declinedEmail });
  await declinedCard
    .getByRole("button", { name: EN.invitations.admin.decline, exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(EN.invitations.admin.notices.declined);
  expect(await storedStatus(declinedEmail)).toBe("declined");

  await page.goto("/admin/invitations");
  const approvedCard = page.locator("article", { hasText: approvedEmail });
  await approvedCard
    .getByRole("button", { name: EN.invitations.admin.approve, exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(EN.invitations.admin.notices.approved);
  expect(await storedStatus(approvedEmail)).toBe("approved");

  await page.goto("/admin/invitations");
  const approvedAgain = page.locator("article", { hasText: approvedEmail });
  await approvedAgain
    .getByRole("button", { name: EN.invitations.admin.markSent, exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(EN.invitations.admin.notices.sent);
  expect(await storedStatus(approvedEmail)).toBe("invited");

  // Once recorded, the request is no longer offered for the same action.
  await page.goto("/admin/invitations");
  await expect(page.locator("article", { hasText: approvedEmail })).toHaveCount(0);
  await context.close();
});
