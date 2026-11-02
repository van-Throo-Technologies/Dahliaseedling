import { expect, test, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";
import { withSuperuser } from "../support/local-supabase";

/*
 * Phase 4 journeys in the browser: deliberate sharing, the public Feed and seedling journey, comments, likes,
 * follows and profile tabs. The database rules are tested in tests/db. These tests confirm what a grower and a
 * visitor actually see, on a phone and on a desktop.
 */

// These journeys cross several pages and two browser contexts, so they get more time than a single page.
test.describe.configure({ timeout: 120_000 });

const PASSWORD = "correct-horse-battery";
const CAMERA_MARKER = "SyntheticCam";
const LOCATION_MARKER = "SyntheticGpsMarker";

function uniqueEmail(label: string): string {
  return `e2e-pub-${label}-${crypto.randomUUID()}@example.test`;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(0);
}

/** A real photo, with a synthetic camera name and a location marker in its metadata. */
async function makePhoto(): Promise<Buffer> {
  return sharp({ create: { width: 900, height: 600, channels: 3, background: "rgb(192,80,128)" } })
    .withExif({ IFD0: { Make: CAMERA_MARKER }, IFD3: { GPSMapDatum: LOCATION_MARKER } })
    .jpeg()
    .toBuffer();
}

async function signUpAndSetUpProfile(page: Page, label: string, displayName: string) {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(uniqueEmail(label));
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Country").selectOption("NL");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/profile$/);
}

/** Captures one photo as a new seedling and returns the observation's address. */
async function captureOnePhoto(page: Page, photo: Buffer): Promise<string> {
  await page.goto("/capture");
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "bloom.jpg", mimeType: "image/jpeg", buffer: photo });
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\/[0-9a-f-]{36}/);
  return page.url().split("?")[0]!;
}

/** Takes one photo through the whole Share journey: make the seedling public, choose the photo, publish. */
async function shareOnePhoto(page: Page, observationUrl: string, caption: string): Promise<string> {
  await page.goto(observationUrl);
  await page.getByRole("link", { name: "Share selected photos" }).click();
  await expect(page).toHaveURL(/\/share$/);
  await page.getByRole("button", { name: "Make Seedling public & continue" }).click();
  await expect(page).toHaveURL(/\/share\?public=1/);
  await page.getByLabel("Share photo 1").check();
  await page.getByLabel("Caption (optional)").fill(caption);
  await page.getByRole("button", { name: "Publish update" }).click();
  await expect(page).toHaveURL(/\/updates\/[0-9a-f-]{36}\?published=1/);
  return page.url().split("?")[0]!;
}

/**
 * Finds an Update on the public Feed by its caption. The Feed is shared by every run of these tests, so the
 * newest page may not hold it: the visitor follows "Show older updates" until it appears, as a reader would.
 */
async function findInFeed(page: Page, text: string) {
  await page.goto("/");
  for (let depth = 0; depth < 25; depth++) {
    const card = page.locator("article").filter({ hasText: text }).first();
    if ((await card.count()) > 0) return card;
    const older = page.getByRole("link", { name: "Show older updates" });
    if ((await older.count()) === 0) break;
    await older.click();
    await page.waitForURL(/cursor=/);
  }
  throw new Error(`the Feed does not show an Update with the text: ${text}`);
}

/** The lifetime, in seconds, of a signed URL: the difference between its token's iat and exp claims. */
function tokenLifetime(signedUrl: string): number {
  const token = new URL(signedUrl).searchParams.get("token");
  const payload = JSON.parse(Buffer.from(token!.split(".")[1]!, "base64url").toString("utf8")) as {
    iat: number;
    exp: number;
  };
  return payload.exp - payload.iat;
}

async function visitorContext(browser: Browser, testInfo: { project: { use: object } }) {
  const context = await browser.newContext({ ...testInfo.project.use });
  return { context, page: await context.newPage() };
}

test("a grower shares one chosen photo; a visitor sees only that photo, with its metadata removed", async ({
  page,
  browser,
}, testInfo) => {
  await signUpAndSetUpProfile(page, "share", "Share Grower");
  const observation = await captureOnePhoto(page, await makePhoto());

  const caption = `First bloom ${crypto.randomUUID().slice(0, 8)}`;
  const updateUrl = await shareOnePhoto(page, observation, caption);
  await expect(page.getByRole("status")).toContainText("Published");
  await expectNoHorizontalOverflow(page);

  // A visitor reads the Feed without an account.
  const { context, page: visitor } = await visitorContext(browser, testInfo);
  const card = await findInFeed(visitor, caption);
  await expect(card).toContainText(caption);
  const image = card.locator("img").first();
  const src = await image.getAttribute("src");
  expect(src, "the Feed shows a signed public derivative, not the private original").toContain(
    "/public-media/",
  );
  expect(src).not.toContain("/private-media/");
  expect(tokenLifetime(src!), "the Feed's public link lasts one hour").toBe(3600);

  // The public image is a WebP without the camera or location marker from the original.
  const bytes = Buffer.from(await (await visitor.request.get(src!)).body());
  expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
  expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
  expect(bytes.includes(Buffer.from(CAMERA_MARKER))).toBe(false);
  expect(bytes.includes(Buffer.from(LOCATION_MARKER))).toBe(false);

  // Tapping the photo opens the persistent seedling page.
  await card.locator('a[aria-label^="Open"]').first().click();
  await expect(visitor).toHaveURL(/\/seedlings\/[0-9a-f-]{36}$/);
  await expect(visitor.getByRole("heading", { name: "Journey" })).toBeVisible();
  await expect(visitor.getByText(caption).first()).toBeVisible();
  await expect(visitor.getByRole("heading", { name: "Manage this seedling" })).toHaveCount(0);
  // The private observation is not reachable from the public side.
  const observationId = observation.split("/").pop()!;
  const hidden = await visitor.goto(`/observations/${observationId}`);
  expect(hidden?.status()).toBe(404);

  await context.close();

  // The grower's own Update page keeps the grower's controls.
  await page.goto(updateUrl);
  await expect(page.getByRole("heading", { name: "Manage this update" })).toBeVisible();
});

test("opening Share changes nothing; leaving the private-seedling step keeps the seedling private", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "keep-private", "Careful Grower");
  const observation = await captureOnePhoto(page, await makePhoto());

  await page.goto(observation);
  await page.getByRole("link", { name: "Share selected photos" }).click();
  await expect(
    page.getByRole("heading", { name: "Make this seedling public to share it" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to the observation" }).click();

  const seedling = await page.locator('a[href^="/seedlings/"]').first().getAttribute("href");
  await page.goto(seedling!);
  await expect(page.getByText("Private", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Journey" })).toHaveCount(0);
});

test("a video-only observation explains that public video sharing is not available, and publishes nothing", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "video", "Video Grower");
  await page.goto("/capture");
  const video = Buffer.concat([Buffer.from("00000018667479706d703432", "hex"), Buffer.alloc(2048)]);
  await page
    .locator("#capture-video")
    .setInputFiles({ name: "bloom.mp4", mimeType: "video/mp4", buffer: video });
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\//);
  const observation = page.url().split("?")[0]!;

  await page.goto(observation);
  await page.getByRole("link", { name: "Share selected photos" }).click();
  await expect(
    page.getByRole("heading", { name: "Public video sharing isn't available yet" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish update" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("comments, replies, likes, follows and Save work for a grower; a visitor is asked to sign in", async ({
  page,
  browser,
}, testInfo) => {
  await signUpAndSetUpProfile(page, "social", "Social Grower");
  const observation = await captureOnePhoto(page, await makePhoto());
  const updateUrl = await shareOnePhoto(page, observation, "Social test");

  // A visitor who tries to like is sent through the sign-in gate, and returns to the Update.
  const { context, page: visitor } = await visitorContext(browser, testInfo);
  await visitor.goto(updateUrl);
  await visitor.getByRole("button", { name: /^Like/ }).click();
  await expect(visitor).toHaveURL(/\/sign-in/);
  await context.close();

  // The grower likes it, and the state is readable in words.
  await page.goto(updateUrl);
  await page.getByRole("button", { name: /^Like/ }).click();
  await expect(page.getByRole("button", { name: /^Liked/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: /^Liked/ }).click();
  await expect(page.getByRole("button", { name: /^Like/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  // A comment, then a reply to it.
  await page.getByLabel("Add a comment").fill("Lovely colour");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByText("Lovely colour").first()).toBeVisible();
  await page.getByText("Reply to Social Grower").first().click();
  await page.getByLabel("Reply to Social Grower").last().fill("Thank you");
  await page.getByRole("button", { name: "Post reply" }).click();
  await expect(page.getByRole("paragraph").filter({ hasText: /^Thank you$/ })).toBeVisible();

  // Edit and remove an own comment.
  await page.getByText("Edit", { exact: true }).first().click();
  await page.getByLabel("Edit your comment").first().fill("Lovely colour, truly");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("paragraph").filter({ hasText: /^Lovely colour, truly$/ }),
  ).toBeVisible();
  await expect(page.getByText("edited").first()).toBeVisible();
  await page.getByRole("button", { name: "Remove my comment" }).first().click();
  await expect(page.getByText("This comment was removed.")).toBeVisible();
  // The reply under the removed comment survives it.
  await expect(page.getByRole("paragraph").filter({ hasText: /^Thank you$/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // Save and follow the seedling, visible as state in words.
  const seedlingHref = await page.locator('a[href^="/seedlings/"]').first().getAttribute("href");
  await page.goto(seedlingHref!);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saved privately" })).toBeVisible();
  await page.getByRole("button", { name: "Follow this seedling" }).click();
  await expect(page.getByRole("button", { name: "Following this seedling" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("publishing twice from a double tap creates one Update", async ({ page }) => {
  await signUpAndSetUpProfile(page, "double", "Double Tap Grower");
  const observation = await captureOnePhoto(page, await makePhoto());

  await page.goto(observation);
  await page.getByRole("link", { name: "Share selected photos" }).click();
  await page.getByRole("button", { name: "Make Seedling public & continue" }).click();
  await expect(page).toHaveURL(/\/share\?public=1/);
  await page.getByLabel("Share photo 1").check();
  const publish = page.getByRole("button", { name: "Publish update" });
  await publish.dblclick();
  await expect(page).toHaveURL(/\/updates\/[0-9a-f-]{36}\?published=1/);

  const profileHref = await page.locator('a[href^="/profiles/"]').first().getAttribute("href");
  await page.goto(`${profileHref}?tab=updates`);
  await expect(page.locator('article[aria-label="Update by Double Tap Grower"]')).toHaveCount(1);
});

test("the profile tabs show public seedlings, originated seedlings and the grower's Updates", async ({
  page,
  browser,
}, testInfo) => {
  await signUpAndSetUpProfile(page, "tabs", "Tabs Grower");
  const observation = await captureOnePhoto(page, await makePhoto());
  await shareOnePhoto(page, observation, "Tabs test");

  const profileHref = await page.locator('a[href^="/profiles/"]').first().getAttribute("href");
  const { context, page: visitor } = await visitorContext(browser, testInfo);

  await visitor.goto(`${profileHref}?tab=seedlings`);
  await expect(
    visitor.getByRole("link", { name: /Tabs Grower|Unnamed seedling/ }).first(),
  ).toBeVisible();
  await visitor.goto(`${profileHref}?tab=originated`);
  await expect(visitor.getByRole("link", { name: /Unnamed seedling/ }).first()).toBeVisible();
  await visitor.goto(`${profileHref}?tab=updates`);
  await expect(
    visitor.locator('article[aria-label="Update by Tabs Grower"]').first(),
  ).toBeVisible();
  await expect(visitor.getByRole("button", { name: "Follow this grower" })).toBeVisible();
  await expectNoHorizontalOverflow(visitor);
  await context.close();
});

/** A HEIC-labelled file with a valid HEIC header. Private Capture accepts it; public sharing does not. */
function fakeHeic(): Buffer {
  return Buffer.concat([
    Buffer.from("0000001866747970686569630000000068656963", "hex"),
    Buffer.alloc(2048),
  ]);
}

test("a HEIC photo stays private, is explained, and cannot be chosen for a public Update", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "heic", "Heic Grower");
  await page.goto("/capture");
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "bloom.heic", mimeType: "image/heic", buffer: fakeHeic() });
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\//);
  await expect(page.getByText("Saved privately").first()).toBeVisible();
  const observation = page.url().split("?")[0]!;

  // Make the seedling public through the explicit step, then look at the choices.
  await page.goto(observation);
  await page.getByRole("link", { name: "Share selected photos" }).click();
  await page.getByRole("button", { name: "Make Seedling public & continue" }).click();
  await expect(page).toHaveURL(/\/share\?public=1/);

  await expect(page.getByLabel("photo 1 stays private")).toBeDisabled();
  await expect(page.getByText("HEIC photos stay private for now.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish update" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("if the seedling stops being public before Publish, nothing is shared and the grower is told why", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "stopped", "Stopped Grower");
  const observation = await captureOnePhoto(page, await makePhoto());

  await page.goto(observation);
  await page.getByRole("link", { name: "Share selected photos" }).click();
  await page.getByRole("button", { name: "Make Seedling public & continue" }).click();
  await expect(page).toHaveURL(/\/share\?public=1/);
  await page.getByLabel("Share photo 1").check();

  // The seedling is made private in another session while this page is open. The server refuses to publish.
  const observationId = observation.split("/").pop()!;
  await withSuperuser((db) =>
    db.query(
      "update public.seedlings set visibility = 'private' where id = (select seedling_id from public.observations where id = $1)",
      [observationId],
    ),
  );
  await page.getByRole("button", { name: "Publish update" }).click();

  const alert = page.locator('p[role="alert"]');
  await expect(alert).toContainText("Make the seedling public first");
  await expect(page).toHaveURL(/\/share\?public=1$/);
  await expect(page.getByRole("status").filter({ hasText: "Published" })).toHaveCount(0);
  await expect(page.getByLabel("Share photo 1")).toBeChecked();
  await expectNoHorizontalOverflow(page);
});
