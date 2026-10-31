import { expect, test, type Page } from "@playwright/test";
import { withSuperuser } from "../support/local-supabase";

/*
 * Phase 1 journeys, from the browser. Authorization is also tested directly against the database
 * (tests/db). These tests confirm the user-facing gates and flows.
 */

function uniqueEmail(label: string): string {
  return `e2e-${label}-${crypto.randomUUID()}@example.test`;
}

const PASSWORD = "correct-horse-battery";

/** The app shell must never scroll sideways, at any width. */
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(0);
}

test("visitor can browse, is prompted to sign in only when participating, and can join", async ({
  page,
  browser,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "The gardener gardens. DahliaSeedling remembers.",
  );
  await expectNoHorizontalOverflow(page);

  // Navigation is exactly the locked set, in order, with no Explore destination.
  const primary = page.getByRole("navigation", { name: "Primary" });
  await expect(primary.getByRole("link")).toHaveText([
    "Home",
    "Capture",
    "Notifications",
    "Profile",
  ]);
  await expect(page.getByText("Explore", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Inbox" })).toBeVisible();

  // A participating action with no session leads to sign-in, preserving the destination.
  await primary.getByRole("link", { name: "Capture" }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fcapture$/);

  // Create an account and set up the minimum profile.
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/sign-up\?next=%2Fcapture$/);
  const email = uniqueEmail("join");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/profile\/setup\?next=%2Fcapture$/);
  await page.getByLabel("Display name").fill("Janine Grower");
  await page.getByLabel("Country").selectOption("NL");
  await page.getByRole("button", { name: "Continue" }).click();

  // Back at the intended destination (Capture is a placeholder until Phase 3).
  await expect(page).toHaveURL(/\/capture$/);
  await expect(page.getByRole("heading", { name: "Capture" })).toBeVisible();
  await expect(page.getByText("Capture is not available yet.")).toBeVisible();
  await expect(primary.getByRole("link", { name: "Capture" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expectNoHorizontalOverflow(page);

  // Edit the profile.
  await primary.getByRole("link", { name: "Profile" }).click();
  await expect(page.getByRole("heading", { name: "Janine Grower" })).toBeVisible();
  await page.getByRole("link", { name: "Edit profile" }).click();
  await page.getByLabel("Bio (optional)").fill("Growing dahlias from seed in the Netherlands.");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Your profile is saved.");

  // The public-profile link lives on the Profile page.
  await primary.getByRole("link", { name: "Profile" }).click();

  // The public profile is readable by someone who is not signed in.
  await page.getByRole("link", { name: "View public profile" }).click();
  await expect(page).toHaveURL(/\/profiles\/[0-9a-f-]{36}$/);
  const publicUrl = page.url();
  await expect(page.getByRole("heading", { name: "Janine Grower" })).toBeVisible();

  const visitor = await browser.newContext({ ...testInfo.project.use });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(publicUrl);
  await expect(visitorPage.getByRole("heading", { name: "Janine Grower" })).toBeVisible();
  await expect(
    visitorPage.getByText("Growing dahlias from seed in the Netherlands."),
  ).toBeVisible();
  await expect(visitorPage.getByRole("link", { name: "Edit profile" })).toHaveCount(0);
  await visitor.close();

  await primary.getByRole("link", { name: "Profile" }).click();

  // Sign out returns to Home, and the gated destinations ask for sign-in again.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await primary.getByRole("link", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fprofile$/);
});

test("denied and failure paths are explicit, not dead ends", async ({ page }) => {
  // A visitor cannot reach the profile editor and is sent to sign in.
  await page.goto("/profile/edit");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fprofile%2Fedit$/);

  // A wrong password gives a clear, generic message that is announced to assistive technology.
  await page.getByLabel("Email").fill("nobody-here@example.test");
  await page.getByLabel("Password").fill("not-the-right-one");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText(
    "That email and password do not match an account.",
  );
  await expect(page.getByLabel("Email")).toHaveValue("nobody-here@example.test");
  await expect(page.getByLabel("Password")).toHaveValue("");
});

test("sign-up validation links each message to its field", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();

  const email = page.getByLabel("Email");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  const emailErrorId = await email.getAttribute("aria-describedby");
  expect(emailErrorId).toContain("field-email-error");
  await expect(page.locator("#field-email-error")).toContainText("name@example.com");
  await expect(page.locator("#field-password-error")).toContainText("at least 8 characters");
});

// A 1x1 PNG. Storage checks the MIME type and size, not the pixels, so this is enough for tests.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test("avatars follow profile visibility through the application route", async ({
  page,
  browser,
}, testInfo) => {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(uniqueEmail("avatar"));
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill("Avatar Grower");
  await page.getByLabel("Country").selectOption("BE");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/profile$/);

  // Upload a photo through the real edit form.
  await page.getByRole("link", { name: "Edit profile" }).click();
  await page.locator('input[type="file"][name="avatar"]').setInputFiles({
    name: "first.png",
    mimeType: "image/png",
    buffer: PNG_1X1,
  });
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Your profile is saved.");

  await page.getByRole("link", { name: "Profile" }).first().click();
  await page.getByRole("link", { name: "View public profile" }).click();
  await expect(page).toHaveURL(/\/profiles\/[0-9a-f-]{36}$/);
  const profileId = new URL(page.url()).pathname.split("/").pop() ?? "";
  const avatarPath = `/avatars/${profileId}`;
  await expect(page.locator(`img[src="${avatarPath}"]`)).toBeVisible();

  // Anonymous (visitor) access to an active avatar works through the route.
  const visitor = await browser.newContext({ ...testInfo.project.use });
  const visitorRequest = visitor.request;
  const active = await visitorRequest.get(avatarPath);
  expect(active.status()).toBe(200);
  expect(active.headers()["content-type"]).toBe("image/png");
  expect(active.headers()["cache-control"]).toContain("no-cache");

  // Operator suspension (privileged path): the public route stops serving the avatar at once.
  await withSuperuser((db) =>
    db.query("update public.profiles set is_suspended = true where id = $1", [profileId]),
  );
  expect((await visitorRequest.get(avatarPath)).status()).toBe(404);
  const ownerDuringSuspension = await page.request.get(avatarPath);
  expect(ownerDuringSuspension.status()).toBe(200);
  await page.goto("/profile");
  await expect(page.getByText("Your account is suspended.")).toBeVisible();
  await expect(page.locator(`img[src="${avatarPath}"]`)).toBeVisible();
  await visitor.close();

  await withSuperuser((db) =>
    db.query("update public.profiles set is_suspended = false where id = $1", [profileId]),
  );

  // Replacing the photo leaves exactly one file in the owner's folder.
  await page.goto("/profile/edit");
  await page.locator('input[type="file"][name="avatar"]').setInputFiles({
    name: "second.png",
    mimeType: "image/png",
    buffer: PNG_1X1,
  });
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Your profile is saved.");
  const remaining = await withSuperuser((db) =>
    db.query(
      "select count(*)::int as count from storage.objects where bucket_id = 'avatars' and (storage.foldername(name))[1] = $1",
      [profileId],
    ),
  );
  expect(remaining.rows[0]?.count).toBe(1);
});
