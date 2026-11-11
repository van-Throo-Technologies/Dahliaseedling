import { readFileSync } from "node:fs";
import { expect, test, type APIRequestContext, type Browser } from "@playwright/test";
import { MESSAGES } from "../../src/i18n/messages";
import { LOCALE_NAMES } from "../../src/i18n/locales";
import { localSupabase, withSuperuser } from "../support/local-supabase";

/*
 * The personal landing page at /join, and the administrator review of invitation requests. The public request form has been removed:
 * growers register directly, and /join is the founder's letter with a registration call and a browse link. The review backend is unchanged,
 * so the review tests create their requests directly in the test database, as the test superuser, rather than through the removed form.
 */

const EN = MESSAGES.en;
const L = EN.landing;
const PASSWORD = "correct-horse-battery";
const REASON = "I grow dahlias from seed and want to share real plants.";

function uniqueEmail(label: string): string {
  return `${label}-${crypto.randomUUID()}@example.test`;
}

/** Creates a pending invitation request as the test superuser. The public form no longer exists, so the review tests use this instead. */
async function seedRequest(email: string): Promise<void> {
  await withSuperuser((db) =>
    db.query(
      "insert into public.invitation_requests (client_key, name, country_code, email, reason) values ($1, $2, $3, $4, $5)",
      [crypto.randomUUID(), "Anna de Vries", "NL", email, REASON],
    ),
  );
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

test.describe("the personal landing page", () => {
  test("is public, and shows the founder's approved photograph with its alt text", async ({
    page,
  }) => {
    await page.goto("/join");
    await expect(page.getByRole("heading", { name: L.title, level: 1, exact: true })).toBeVisible();
    const photograph = page.getByRole("img", { name: L.photoAlt, exact: true });
    await expect(photograph).toBeVisible();
    expect(
      await photograph.evaluate((element) => (element as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
  });

  test("tells the founder's story in full, and is signed off by the founder", async ({ page }) => {
    await page.goto("/join");
    await expect(page.getByText(L.p1, { exact: true })).toBeVisible();
    await expect(page.getByText(L.p5, { exact: true })).toBeVisible();
    await expect(page.getByText(L.p10, { exact: true })).toBeVisible();
    await expect(page.getByText(L.signature, { exact: true })).toBeVisible();
  });

  test("the primary call takes a visitor to registration", async ({ page }) => {
    await page.goto("/join");
    const cta = page.getByRole("link", { name: L.primaryCta, exact: true });
    await expect(cta).toHaveAttribute("href", "/sign-up");
    await cta.click();
    await expect(page).toHaveURL(/\/sign-up$/);
  });

  test("the secondary call takes a visitor to the feed to look around first", async ({ page }) => {
    await page.goto("/join");
    const browse = page.getByRole("link", { name: L.secondaryCta, exact: true });
    await expect(browse).toHaveAttribute("href", "/");
    await browse.click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("is a letter, not the application: no header sign-in, no navigation, no notifications or profile", async ({
    page,
  }) => {
    await page.goto("/join");
    await expect(page.getByRole("navigation", { name: EN.app.nav.label, exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("link", { name: EN.app.nav.notifications, exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: EN.app.nav.profile, exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
    await expect(page.getByText(L.kicker, { exact: true })).toBeVisible();
  });

  test("offers the three languages as discreet text at the end of the letter", async ({ page }) => {
    await page.goto("/join");
    for (const code of ["en", "nl", "fr"] as const) {
      await expect(page.getByText(LOCALE_NAMES[code], { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByRole("combobox")).toHaveCount(0);
  });

  test("on a phone, the title and opening come before the photograph, which leaves the first screen for the words", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "The phone order applies to phone-sized screens.");
    await page.goto("/join");
    const heading = await page
      .getByRole("heading", { name: L.title, level: 1, exact: true })
      .boundingBox();
    const photo = await page.getByRole("img", { name: L.photoAlt, exact: true }).boundingBox();
    const viewport = page.viewportSize();
    expect(heading).not.toBeNull();
    expect(photo).not.toBeNull();
    expect(heading!.y).toBeLessThan(photo!.y);
    expect(photo!.height).toBeLessThan(viewport!.height * 0.6);
  });

  test("has no horizontal scrolling on a phone or a desktop", async ({ page }) => {
    await page.goto("/join");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("carries social preview metadata for a 1200 × 630 image", async ({ page }) => {
    await page.goto("/join");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", L.title);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /\/images\/og-join\.jpg$/,
    );
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
      "content",
      "1200",
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
  });
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
  await seedRequest(declinedEmail);
  await seedRequest(approvedEmail);

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

test("a captured administrator decision, replayed to its own page, is processed", async ({
  browser,
  request,
}) => {
  const email = uniqueEmail("replay");
  await seedRequest(email);

  const { context, page } = await administratorContext(browser, request);
  await page.goto("/admin/invitations");
  let captured: { headers: Record<string, string>; body: string } | undefined;
  await page.route("**/admin/invitations**", async (route) => {
    if (route.request().method() === "POST" && captured === undefined) {
      captured = { headers: route.request().headers(), body: route.request().postData() ?? "" };
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page
    .locator("article", { hasText: email })
    .getByRole("button", { name: EN.invitations.admin.decline, exact: true })
    .click();
  await expect.poll(() => captured !== undefined).toBe(true);
  await page.unroute("**/admin/invitations**");

  const { headers, body } = captured!;
  const replayHeaders = Object.fromEntries(
    Object.entries(headers).filter(
      ([name]) => !["cookie", "host", "content-length"].includes(name),
    ),
  );

  // Control: the same captured request, sent to its own page, is processed.
  await context.request.post(new URL("/admin/invitations", page.url()).toString(), {
    headers: replayHeaders,
    data: body,
  });
  expect(await storedStatus(email)).toBe("declined");
  await context.close();
});

test("the crafted administrator request, sent to its own page, is processed (control for the public-surface test)", async ({
  browser,
  request,
}) => {
  const email = uniqueEmail("crafted");
  await seedRequest(email);
  const { context, page } = await administratorContext(browser, request);
  await page.goto("/admin/invitations");
  const [row] = await withSuperuser(
    async (db) =>
      (await db.query("select id from public.invitation_requests where email = $1", [email])).rows,
  );

  const manifest = JSON.parse(
    readFileSync(".next/server/server-reference-manifest.json", "utf8"),
  ) as {
    node: Record<string, { exportedName: string; filename: string }>;
  };
  const actionId = Object.entries(manifest.node).find(
    ([, value]) =>
      value.exportedName === "decideInvitationRequestAction" &&
      value.filename === "src/modules/invitations/actions.ts",
  )![0];
  const boundary = "----DahliaSeedlingControl";
  const field = (name: string, value: string) =>
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
  const body =
    field(`_1_$ACTION_ID_${actionId}`, "") +
    field("_1_requestId", row!.id as string) +
    field("_1_decision", "decline") +
    field("0", '["$K1"]') +
    `--${boundary}--\r\n`;

  await context.request.post(new URL("/admin/invitations", page.url()).toString(), {
    headers: {
      accept: "text/x-component",
      "content-type": `multipart/form-data; boundary=${boundary}`,
      origin: new URL(page.url()).origin,
      "next-action": actionId,
    },
    data: body,
  });
  expect(await storedStatus(email)).toBe("declined");
  await context.close();
});
