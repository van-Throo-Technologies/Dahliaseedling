import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { MESSAGES } from "../../src/i18n/messages";

/*
 * Private messaging end to end: one grower opens a conversation from another grower's profile, writes, and the other grower
 * sees it as new in the Inbox and as a typed notification. The receiver reports a message, blocks the sender, and the sender's
 * next message is refused with a plain sentence. The history stays readable to the blocker. Runs at phone and desktop size.
 */

test.describe.configure({ timeout: 300_000 });

const PASSWORD = "correct-horse-battery";
const tag = "ms" + Math.random().toString(36).slice(2, 8);
const EN = MESSAGES.en;
const NL = MESSAGES.nl;

async function signUp(page: Page, label: string, displayName: string, country: string) {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(`e2e-ms-${label}-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Country").selectOption(country);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/profile\/setup/);
}

/** The public profile path of the signed-in grower, read from their own profile page. */
async function ownProfilePath(page: Page): Promise<string> {
  await page.goto("/profile");
  const href = await page.locator('a[href^="/profiles/"]').first().getAttribute("href");
  expect(href).toMatch(/^\/profiles\/[0-9a-f-]{36}$/);
  return href!;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(0);
}

async function shot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

test("a grower messages another from a profile, the receiver reports and blocks, and the refused sender sees a plain sentence", async ({
  browser,
}: {
  browser: Browser;
}, testInfo) => {
  const aliceName = `Alice ${tag}`;
  const bobName = `Bob ${tag}`;
  const alice = await browser.newContext();
  const aliceP = await alice.newPage();
  await signUp(aliceP, "alice", aliceName, "NL");
  const aliceProfile = await ownProfilePath(aliceP);

  const bob = await browser.newContext();
  const bobP = await bob.newPage();
  await signUp(bobP, "bob", bobName, "BE");
  const bobProfile = await ownProfilePath(bobP);

  // 1. Bob opens a conversation from Alice's profile, and writes to her.
  await bobP.goto(aliceProfile);
  await bobP.getByRole("button", { name: EN.messaging.start.direct, exact: true }).click();
  await expect(bobP).toHaveURL(/\/inbox\/[0-9a-f-]{36}$/);
  const thread = new URL(bobP.url()).pathname;
  await bobP
    .getByLabel(EN.messaging.thread.bodyLabel, { exact: true })
    .fill(`Your bloom is lovely ${tag}`);
  await bobP.getByRole("button", { name: EN.messaging.thread.send, exact: true }).click();
  await expect(bobP.getByText(`Your bloom is lovely ${tag}`)).toBeVisible();
  await expectNoHorizontalOverflow(bobP);

  // 2. Alice's Inbox shows the conversation as new, and the thread carries Bob's message.
  await aliceP.goto("/inbox");
  await expect(aliceP.getByRole("link", { name: new RegExp(bobName) })).toBeVisible();
  await expect(aliceP.getByText(EN.messaging.inbox.unread, { exact: true })).toBeVisible();
  await aliceP.getByRole("link", { name: new RegExp(bobName) }).click();
  await expect(aliceP.getByText(`Your bloom is lovely ${tag}`)).toBeVisible();
  await expectNoHorizontalOverflow(aliceP);
  await shot(aliceP, testInfo, "alice-thread");

  // 3. Alice reports Bob's message. The report is accepted and the notice says the grower is not told.
  await aliceP.getByText(EN.messaging.thread.report, { exact: true }).click();
  await aliceP.getByLabel(EN.safety.report.reason, { exact: true }).selectOption("harassment");
  await aliceP
    .getByLabel(EN.safety.report.details, { exact: true })
    .fill("Test report from the browser suite");
  await aliceP.getByRole("button", { name: EN.safety.report.submit, exact: true }).click();
  await expect(aliceP.getByRole("status")).toContainText(EN.safety.report.sent);

  // 4. Alice blocks Bob from Bob's profile. The notice confirms it.
  await aliceP.goto(bobProfile);
  await aliceP.getByRole("button", { name: EN.safety.block.block, exact: true }).click();
  await expect(aliceP.getByRole("status")).toContainText(EN.safety.block.blocked);

  // 5. Bob's next message is refused, in plain words; Alice still reads the history but cannot write in it.
  await bobP.goto(thread);
  await bobP.getByLabel(EN.messaging.thread.bodyLabel, { exact: true }).fill("Still there?");
  await bobP.getByRole("button", { name: EN.messaging.thread.send, exact: true }).click();
  await expect(bobP.getByText(EN.messaging.errors.blocked, { exact: true })).toBeVisible();
  await expect(bobP.getByText("Still there?")).toHaveCount(0);

  await aliceP.goto(thread);
  await expect(aliceP.getByText(`Your bloom is lovely ${tag}`)).toBeVisible();
  await expect(aliceP.getByText(EN.messaging.thread.blockedHistory)).toBeVisible();
  await expect(aliceP.getByLabel(EN.messaging.thread.bodyLabel, { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(aliceP);
  await shot(aliceP, testInfo, "alice-blocked-thread");

  // 6. The message is a notification for Alice, rendered as a sentence, and it is not the message text.
  await aliceP.goto("/notifications");
  await expect(aliceP.getByText(`${bobName} sent you a private message.`)).toBeVisible();
  await expect(aliceP.getByText(`Your bloom is lovely ${tag}`)).toHaveCount(0);
  await expectNoHorizontalOverflow(aliceP);
  await shot(aliceP, testInfo, "alice-notifications");

  // 7. Dutch: the Inbox heading and the notice follow the active language.
  await aliceP.goto("/inbox");
  await aliceP.locator("#language-select").selectOption("nl");
  await expect(
    aliceP.getByRole("heading", { name: NL.messaging.inbox.title, exact: true }),
  ).toBeVisible();

  await alice.close();
  await bob.close();
});
