import { readFileSync } from "node:fs";
import { join } from "node:path";
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
  await card.locator('a[href^="/seedlings/"]').first().click();
  await expect(visitor).toHaveURL(/\/seedlings\/[0-9a-f-]{36}$/);
  await expect(visitor.getByRole("heading", { name: "Journey" })).toBeVisible();
  await expect(visitor.getByText(caption).first()).toBeVisible();
  await expect(visitor.getByRole("heading", { name: "Manage this seedling" })).toHaveCount(0);
  // The private observation is not reachable from the public side.
  const observationId = observation.split("/").pop()!;
  const hidden = await visitor.goto(`/observations/${observationId}`);
  expect(hidden?.status()).toBe(404);

  // A visitor reading the Update sees no management menu.
  await visitor.goto(updateUrl);
  await expect(visitor.getByRole("button", { name: "Manage this update" })).toHaveCount(0);

  await context.close();

  // The grower's own Update page keeps the controls in a menu beside the header, not between the photographs and the comments.
  await page.goto(updateUrl);
  await expect(page.getByRole("heading", { name: "Manage this update" })).toHaveCount(0);
  const menu = page.getByRole("button", { name: "Manage this update" });
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute("aria-expanded", "false");

  // Choosing removal opens the explanation in a dialog. "Keep" closes it and leaves the Update in place.
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Remove this update" }).click();
  const dialog = page.getByRole("dialog", { name: "Remove this update" });
  await expect(dialog).toContainText("Removing it takes it off the Feed");
  await dialog.getByRole("button", { name: "Keep this update" }).click();
  await expect(dialog).toBeHidden();
  await expect(menu).toBeFocused();
  await expect(page.getByText(caption).first()).toBeVisible();

  // Confirming removal uses the same deletion as before, and returns the grower to their profile.
  await menu.click();
  await page.getByRole("button", { name: "Remove this update" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove this update" }).click();
  await expect(page).toHaveURL(/\/profiles\/[0-9a-f-]{36}\?tab=updates&deleted=1$/);
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

  // A comment, from the one collapsed composer.
  await page.locator("summary", { hasText: "Add a comment" }).click();
  await page.getByLabel("Your comment", { exact: true }).fill("Lovely colour");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByText("Lovely colour").first()).toBeVisible();

  // Another reader sees the comment, and no author controls.
  const { context: reader, page: readerPage } = await visitorContext(browser, testInfo);
  await readerPage.goto(updateUrl);
  await expect(readerPage.getByText("Lovely colour").first()).toBeVisible();
  await expect(readerPage.getByRole("button", { name: "Comment options" })).toHaveCount(0);
  await reader.close();

  // A reply, opened from the comment's own Reply control. Replies start collapsed.
  await page.getByText("Reply", { exact: true }).first().click();
  await page.getByLabel("Reply to Social Grower").last().fill("Thank you");
  await page.getByRole("button", { name: "Post reply" }).click();
  // Posting a reply opens its comment's replies, so the new reply is visible at once.
  await expect(page.getByRole("paragraph").filter({ hasText: /^Thank you$/ })).toBeVisible();

  // Edit and remove an own comment, from the comment's three-dot menu.
  await page.getByRole("button", { name: "Comment options" }).first().click();
  await page.getByRole("button", { name: "Edit comment" }).click();
  await page.getByLabel("Edit your comment").first().fill("Lovely colour, truly");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("paragraph").filter({ hasText: /^Lovely colour, truly$/ }),
  ).toBeVisible();
  await expect(page.getByText("edited").first()).toBeVisible();
  await page.getByRole("button", { name: "Comment options" }).first().click();
  await page.getByRole("button", { name: "Delete comment" }).click();
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

/** A HEIC-labelled file with a valid HEIC header and no picture data. Its size is not declared, so it cannot be decoded. */
function fakeHeic(): Buffer {
  return Buffer.concat([
    Buffer.from("0000001866747970686569630000000068656963", "hex"),
    Buffer.alloc(2048),
  ]);
}

const PHONE_HEIC = join(process.cwd(), "tests/fixtures/heic/portrait-rotated.heic");

/** Captures one file under the given name and type, and returns the observation address. */
async function captureFile(
  page: Page,
  name: string,
  mimeType: string,
  buffer: Buffer,
): Promise<string> {
  await page.goto("/capture");
  await page.locator("#capture-photo").setInputFiles({ name, mimeType, buffer });
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\/[0-9a-f-]{36}/);
  return page.url().split("?")[0]!;
}

test("a HEIC photo from a phone, with no declared type, is previewed, kept privately, and shared as an upright public copy", async ({
  page,
  browser,
}, testInfo) => {
  await signUpAndSetUpProfile(page, "heic", "Heic Grower");
  await page.goto("/capture");
  // An empty type is what some Android and Windows browsers report for a HEIC file. The name decides instead.
  await page
    .locator("#capture-photo")
    .setInputFiles({ name: "bloom.heic", mimeType: "", buffer: readFileSync(PHONE_HEIC) });
  // A HEIC file has no preview until it is saved, so the page says when the preview will appear.
  await expect(page.getByText(/can.t show a preview yet/)).toBeVisible();
  await page.getByRole("button", { name: "Save privately" }).click();
  await expect(page).toHaveURL(/\/observations\//);
  const observation = page.url().split("?")[0]!;

  // Once saved, the owner sees the photograph from the preview route, upright at the source size, and the picture loads.
  const shown = page.locator("main img").first();
  await expect(shown).toBeVisible();
  const previewSrc = (await shown.getAttribute("src")) ?? "";
  expect(previewSrc).toMatch(/\/media\/[0-9a-f-]{36}\/preview$/);
  await expect.poll(() => shown.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(200);
  await expect.poll(() => shown.evaluate((el) => (el as HTMLImageElement).naturalHeight)).toBe(400);
  const url = new URL(previewSrc, page.url()).toString();

  // A repeat request with the same ETag is answered without a new body.
  const first = await page.request.get(url);
  expect(first.status()).toBe(200);
  expect(first.headers()["content-type"]).toBe("image/webp");
  expect(first.headers()["cache-control"]).toBe("private, no-cache");
  const repeat = await page.request.get(url, {
    headers: { "if-none-match": first.headers().etag! },
  });
  expect(repeat.status()).toBe(304);

  // A signed-out visitor, and another grower, get the same 404 as for a missing file.
  const signedOut = await browser.newContext();
  expect((await signedOut.request.get(url)).status()).toBe(404);
  await signedOut.close();
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signUpAndSetUpProfile(otherPage, "heicother", "Other Grower");
  expect((await otherPage.request.get(url)).status()).toBe(404);
  expect(
    (
      await otherPage.request.get(url, { headers: { "if-none-match": first.headers().etag! } })
    ).status(),
  ).toBe(404);
  await other.close();

  const caption = `Heic bloom ${crypto.randomUUID().slice(0, 8)}`;
  await shareOnePhoto(page, observation, caption);
  await expect(page.getByRole("status")).toContainText("Published");

  const { context, page: visitor } = await visitorContext(browser, testInfo);
  const card = await findInFeed(visitor, caption);
  const src = await card.locator("img").first().getAttribute("src");
  expect(src, "the Feed shows the public WebP copy, not the private HEIC").toContain(
    "/public-media/",
  );
  expect(src).not.toContain("/private-media/");
  await context.close();
});

test("a HEIC file that cannot be decoded is refused for sharing with a clear message, and nothing is published", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "heicbad", "Heic Unreadable");
  const observation = await captureFile(page, "unreadable.heic", "image/heic", fakeHeic());

  await page.goto(observation);
  await page.getByRole("link", { name: "Share selected photos" }).click();
  await page.getByRole("button", { name: "Make Seedling public & continue" }).click();
  await page.getByLabel("Share photo 1").check();
  await page.getByRole("button", { name: "Publish update" }).click();

  await expect(page.getByText("The photo could not be prepared for sharing.")).toBeVisible();
  await expect(page).not.toHaveURL(/\/updates\//);
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

/** A HEIF container that declares a 20000 by 20000 image, which is over the decoding limit. It holds no picture data. */
function oversizedHeic(): Buffer {
  const declared = Buffer.alloc(20);
  declared.writeUInt32BE(20, 0);
  declared.write("ispe", 4, "latin1");
  declared.writeUInt32BE(20_000, 12);
  declared.writeUInt32BE(20_000, 16);
  return Buffer.concat([fakeHeic(), declared]);
}

test("a HEIC photo over the size limit is saved, shows a clear message in place of a preview", async ({
  page,
}) => {
  await signUpAndSetUpProfile(page, "heicbig", "Heic Large");
  const observation = await captureFile(page, "oversized.heic", "image/heic", oversizedHeic());

  // The preview is refused with a 422, and the page replaces the picture with a plain message.
  const refused = page.waitForResponse((response) => response.url().includes("/preview"));
  await page.goto(observation);
  const response = await refused;
  expect(response.status()).toBe(422);
  await expect(page.getByText("Preview not available in this browser")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
