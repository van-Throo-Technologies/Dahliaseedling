import { readFileSync } from "node:fs";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { MESSAGES } from "../../src/i18n/messages";
import { localSupabase, withSuperuser } from "../support/local-supabase";
import { proofFor } from "../support/invitation-intake";

/*
 * The public surface: the deployment that visitors reach without a Vercel account. It serves only the invitation journey. Everything else
 * is not found, and the visitor limit applies to requests. This file runs only against the public server (playwright.public.config.ts),
 * which has PUBLIC_SURFACE=invitations and a small hourly allowance.
 */

const EN = MESSAGES.en;
const REASON = "I grow dahlias from seed and want to share real plants.";

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
    page.getByRole("heading", { name: EN.invitations.join.heroHeading, level: 1, exact: true }),
  ).toBeVisible();
});

test("an anonymous visitor reads the founder story and submits a request", async ({ page }) => {
  await page.goto("/join");
  await expect(
    page.getByRole("heading", { name: EN.invitations.join.storyHeading, exact: true }),
  ).toBeVisible();

  await page.getByLabel(EN.invitations.join.name, { exact: true }).fill("Anna de Vries");
  await page.getByLabel(EN.invitations.join.country, { exact: true }).selectOption("NL");
  await page.getByLabel(EN.invitations.join.email, { exact: true }).fill(uniqueEmail("public"));
  await page.getByLabel(EN.invitations.join.reason, { exact: true }).fill(REASON);
  await page.getByRole("button", { name: EN.invitations.join.submit, exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(EN.invitations.join.received);
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

test("repeated requests from one visitor are refused once the hourly allowance is passed", async ({
  page,
}) => {
  await page.goto("/join");
  let refused = false;
  let accepted = 0;
  for (let attempt = 0; attempt < 6 && !refused; attempt += 1) {
    await page.getByLabel(EN.invitations.join.name, { exact: true }).fill("Limit Check");
    await page.getByLabel(EN.invitations.join.country, { exact: true }).selectOption("NL");
    await page.getByLabel(EN.invitations.join.email, { exact: true }).fill(uniqueEmail("limit"));
    await page.getByLabel(EN.invitations.join.reason, { exact: true }).fill(REASON);
    await page.getByRole("button", { name: EN.invitations.join.submit, exact: true }).click();
    const outcome = page.getByRole("status").or(page.locator("p[role='alert']"));
    await expect(outcome).toBeVisible();
    const text = (await outcome.textContent()) ?? "";
    if (text === EN.invitations.join.visitorLimited) {
      refused = true;
    } else {
      expect(text).toBe(EN.invitations.join.received);
      accepted += 1;
      // A successful request empties the form, so a fresh form can be filled again on the next pass.
      await page.goto("/join");
    }
  }
  expect(refused).toBe(true);
  expect(accepted).toBeLessThanOrEqual(3);
});

function administratorDecisionActionId(): string {
  const manifest = JSON.parse(
    readFileSync(".next/server/server-reference-manifest.json", "utf8"),
  ) as {
    node: Record<string, { exportedName: string; filename: string }>;
  };
  const entry = Object.entries(manifest.node).find(
    ([, value]) =>
      value.exportedName === "decideInvitationRequestAction" &&
      value.filename === "src/modules/invitations/actions.ts",
  );
  if (!entry) throw new Error("decideInvitationRequestAction is not in the build manifest");
  return entry[0];
}

test("an administrator's decision sent to the join route, in the browser's own form encoding, does not run on the public surface", async ({
  browser,
  request,
}) => {
  const { apiUrl, secretKey, publishableKey } = localSupabase();
  const reviewer = uniqueEmail("reviewer");
  const minted = await request.post(`${apiUrl}/auth/v1/admin/generate_link`, {
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
    data: { type: "signup", email: reviewer, password: "correct-horse-battery" },
  });
  expect(minted.ok()).toBe(true);
  const { hashed_token: reviewerToken } = (await minted.json()) as { hashed_token: string };
  await withSuperuser((db) =>
    db.query(
      "insert into public.admin_users (user_id) select id from auth.users where email = $1 on conflict do nothing",
      [reviewer],
    ),
  );
  // The reviewer signs in through the application's own confirmation route, so the session cookies are the ones a browser receives.
  const reviewerContext = await browser.newContext();
  const reviewerPage = await reviewerContext.newPage();
  await reviewerPage.goto(`/auth/confirm?token_hash=${reviewerToken}&type=signup`);
  await expect(reviewerPage).toHaveURL(/\/profile\/setup/);

  // A pending request, created as a visitor would create it.
  const target = uniqueEmail("target");
  const clientKey = crypto.randomUUID();
  const created = await request.post(`${apiUrl}/rest/v1/rpc/submit_invitation_request`, {
    headers: { apikey: publishableKey, "Content-Type": "application/json" },
    data: {
      p_client_key: clientKey,
      p_name: "Target Request",
      p_country: "NL",
      p_email: target,
      p_reason: REASON,
      p_visitor_hash: "a".repeat(64),
      p_visitor_limit: 100,
      p_proof: proofFor("a".repeat(64), 100, clientKey),
    },
  });
  expect(await created.json()).toBe("received");
  const [row] = await withSuperuser(
    async (db) =>
      (await db.query("select id from public.invitation_requests where email = $1", [target])).rows,
  );

  // The same encoding the browser sends from the administrator page: the action identifier is a form field, with the arguments alongside.
  const actionId = administratorDecisionActionId();
  const boundary = "----DahliaSeedlingReplay";
  const field = (name: string, value: string) =>
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
  const body =
    field(`_1_$ACTION_ID_${actionId}`, "") +
    field("_1_requestId", row!.id as string) +
    field("_1_decision", "approve") +
    field("0", '["$K1"]') +
    `--${boundary}--\r\n`;

  const response = await reviewerContext.request.post(
    new URL("/join", "http://127.0.0.1:3200").toString(),
    {
      headers: {
        accept: "text/x-component",
        "content-type": `multipart/form-data; boundary=${boundary}`,
        origin: "http://127.0.0.1:3200",
        referer: "http://127.0.0.1:3200/admin/invitations",
        "next-action": actionId,
      },
      data: body,
    },
  );
  await reviewerContext.close();
  expect(response.status()).toBeLessThan(500);
  const [after] = await withSuperuser(
    async (db) =>
      (await db.query("select status from public.invitation_requests where id = $1", [row!.id]))
        .rows,
  );
  expect(after!.status).toBe("pending");
});
