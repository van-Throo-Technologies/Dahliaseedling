import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/*
 * The Home, navigation and onboarding changes. Each check runs on the phone and the desktop project. Accounts are real accounts in the
 * local test database, created the same way the other browser tests create them. No seedling or photograph is created here.
 */

const PASSWORD = "correct-horse-battery";

function uniqueEmail(label: string): string {
  return `e2e-founder-${label}-${crypto.randomUUID()}@example.test`;
}

async function runAxe(page: Page): Promise<Array<{ id: string; impact: string | null }>> {
  const source = readFileSync(join(process.cwd(), "node_modules/axe-core/axe.min.js"), "utf8");
  await page.addScriptTag({ content: source });
  return page.evaluate(async () => {
    const result = await (
      window as unknown as {
        axe: {
          run: (
            ...args: unknown[]
          ) => Promise<{ violations: Array<{ id: string; impact: string | null }> }>;
        };
      }
    ).axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    });
    return result.violations.map((violation) => ({ id: violation.id, impact: violation.impact }));
  });
}

test("Home opens on the Feed with a sign-in invitation, and search with closed filters lives on Explore", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Feed" })).toBeAttached();
  await expect(page.getByText("Sign in to share what you are growing.")).toBeVisible();
  // Home has no search box of its own.
  await expect(page.getByRole("searchbox")).toHaveCount(0);

  // Search and its filters are on Explore.
  await page.goto("/explore");

  // The explanatory introduction is gone.
  await expect(
    page.getByText("Stories from growers, shared deliberately", { exact: false }),
  ).toHaveCount(0);

  // The search entry is visible, and the advanced filters are in a closed disclosure.
  await expect(page.getByRole("searchbox")).toBeVisible();
  const filters = page.locator("details").filter({ hasText: "Filters" });
  await expect(filters).not.toHaveAttribute("open", "");
  await filters.getByText("Filters", { exact: true }).click();
  await expect(page.getByLabel("Country")).toBeVisible();
});

test("the current destination is shown without relying on colour alone", async ({ page }) => {
  await page.goto("/sign-up?next=%2F");
  await page.getByLabel("Email").fill(uniqueEmail("nav"));
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill("Navigation Check");
  await page.getByLabel("Country").selectOption("NL");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/$/);

  const primary = page.getByRole("navigation", { name: "Primary" });
  await expect(primary.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  await expect(primary.getByRole("link", { name: "Profile" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );

  await primary.getByRole("link", { name: "Notifications" }).click();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(primary.getByRole("link", { name: "Notifications" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(primary.getByRole("link", { name: "Home" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );

  await primary.getByRole("link", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(primary.getByRole("link", { name: "Profile" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(primary.getByRole("link", { name: "Notifications" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );

  // Three destinations, in order. Posting is not one of them: it starts in the composer on the Feed.
  await expect(primary.getByRole("link")).toHaveText([
    "Home",
    "Explore",
    "Notifications",
    "Profile",
  ]);
});

test("a grower who has not finished setting up is not shown as being on Profile", async ({
  page,
}) => {
  await page.goto("/sign-up?next=%2F");
  await page.getByLabel("Email").fill(uniqueEmail("setup"));
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);

  // The setup step explains why a profile is needed, and browsing stays open.
  await expect(
    page.getByText("A profile is needed before you can share", { exact: false }),
  ).toBeVisible();

  const primary = page.getByRole("navigation", { name: "Primary" });
  await expect(primary.getByRole("link", { name: "Profile" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("the Feed uses the wider desktop column, and stays one column on a phone", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const main = page.locator("main");
  const box = await main.boundingBox();
  expect(box).not.toBeNull();
  if (testInfo.project.name === "desktop") {
    expect(box!.width).toBeGreaterThan(800);
  } else {
    expect(box!.width).toBeLessThanOrEqual(390);
  }
});

test("the Home and setup pages have no serious or critical accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  const homeViolations = (await runAxe(page)).filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  expect(homeViolations, JSON.stringify(homeViolations)).toEqual([]);

  await page.goto("/sign-in");
  const signInViolations = (await runAxe(page)).filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  expect(signInViolations, JSON.stringify(signInViolations)).toEqual([]);
});
