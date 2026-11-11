import { expect, test, type Page } from "@playwright/test";
import { MESSAGES } from "../../src/i18n/messages";
import { withSuperuser } from "../support/local-supabase";

/*
 * Administrator navigation. The Administration link on the profile page, and the links between the four administrator pages, appear only
 * for an administrator. An ordinary grower sees neither, and gets the same not-found page as before when they open an administrator page.
 */

const PASSWORD = "correct-horse-battery";
const EN = MESSAGES.en;

function uniqueEmail(label: string): string {
  return `e2e-admin-nav-${label}-${crypto.randomUUID()}@example.test`;
}

async function signUp(page: Page, email: string, displayName: string) {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Country").selectOption("NL");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/profile\/setup/);
}

async function makeAdministrator(email: string) {
  await withSuperuser((db) =>
    db.query(
      "insert into public.admin_users (user_id) select id from auth.users where email = $1 on conflict do nothing",
      [email],
    ),
  );
}

test("an ordinary grower sees no administration link, and an administrator page is not found", async ({
  page,
}) => {
  await signUp(page, uniqueEmail("grower"), "Ordinary Grower");
  await page.goto("/profile");
  await expect(page.getByRole("link", { name: EN.admin.nav.administration })).toHaveCount(0);

  const response = await page.goto("/admin/invitations");
  expect(response?.status()).toBe(404);
});

test("an administrator reaches the four administrator pages from the profile link and the navigation", async ({
  page,
}) => {
  const email = uniqueEmail("admin");
  await signUp(page, email, "Administrator Grower");
  await makeAdministrator(email);

  await page.goto("/profile");
  await page.getByRole("link", { name: EN.admin.nav.administration }).click();
  await expect(page).toHaveURL(/\/admin\/invitations$/);

  const navigation = page.getByRole("navigation", { name: EN.admin.nav.label });
  await expect(navigation.getByRole("link", { name: EN.invitations.admin.title })).toHaveAttribute(
    "aria-current",
    "page",
  );

  const sections: readonly [string, string][] = [
    [EN.admin.reports.title, "/admin/reports"],
    [EN.admin.accounts.title, "/admin/accounts"],
    [EN.feedback.admin.title, "/admin/feedback"],
    [EN.invitations.admin.title, "/admin/invitations"],
  ];
  for (const [label, path] of sections) {
    await navigation.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(navigation.getByRole("link", { name: label, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
});
