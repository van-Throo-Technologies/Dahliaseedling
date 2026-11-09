import { expect, test, type Browser, type Page } from "@playwright/test";
import { MESSAGES } from "../../src/i18n/messages";

/*
 * Keyboard-only operation of the Phase 6 controls. Each control is reached with Tab, shown with a visible focus ring, and
 * activated with the keyboard alone (Space for checkboxes and radios, arrows for the handover select, Enter for buttons
 * and links). Sign-up and seedling creation use the pointer, since they are outside Phase 6. Copy comes from the
 * dictionary, so the assertions follow wording changes.
 */

test.describe.configure({ timeout: 300_000 });

const PASSWORD = "correct-horse-battery";
const tag = "kb" + Math.random().toString(36).slice(2, 8);
const EN = MESSAGES.en;

type Focused = { text: string; tag: string; type: string };

async function signUp(page: Page, label: string, displayName: string, country: string) {
  await page.goto("/sign-up?next=%2Fprofile");
  await page.getByLabel("Email").fill(`e2e-kb-${label}-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile\/setup/);
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Country").selectOption(country);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/profile\/setup/);
}

async function createSeedling(page: Page, name: string): Promise<string> {
  await page.goto("/seedlings/new");
  await page.getByLabel("Working name (optional)").fill(name);
  await page.getByRole("button", { name: "Create seedling" }).click();
  await expect(page).toHaveURL(/\/seedlings\/[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname;
}

async function focusedInfo(page: Page): Promise<Focused> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const input = el as HTMLInputElement;
    return {
      text: (el.innerText || el.getAttribute("aria-label") || input.value || "").trim(),
      tag: el.tagName,
      type: input.type ?? "",
    };
  });
}

/** Moves focus forward with Tab until the wanted control is focused. Fails if it is not reachable in a sensible number of stops. */
async function tabTo(
  page: Page,
  wanted: (info: Focused) => boolean,
  limit = 120,
): Promise<Focused> {
  for (let stop = 0; stop < limit; stop++) {
    await page.keyboard.press("Tab");
    const info = await focusedInfo(page);
    if (wanted(info)) {
      await expectFocusVisible(page);
      return info;
    }
  }
  throw new Error("the control was not reached with Tab");
}

async function expectFocusVisible(page: Page) {
  const outline = await page.evaluate(
    () => getComputedStyle(document.activeElement as HTMLElement).outlineStyle,
  );
  expect(outline).toBe("solid");
}

async function activateButton(page: Page, name: string) {
  await tabTo(page, (info) => info.text === name);
  await page.keyboard.press("Enter");
}

async function touchTarget(page: Page, name: string, minimum = 44) {
  const box = await page.getByRole("button", { name }).boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(minimum);
}

test("the recipient's decline, the holder's re-choice and the receipt are all operated from the keyboard", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const holder = await browser.newContext();
  const holderPage = await holder.newPage();
  await signUp(holderPage, "holder", `Holder ${tag}`, "NL");
  const path = await createSeedling(holderPage, `Keys ${tag}`);

  // Holder starts availability with the keyboard alone.
  await holderPage.goto(`${path}/rehome`);
  await holderPage.getByLabel(EN.rehome.terms.donate, { exact: true }).focus();
  await expectFocusVisible(holderPage);
  await holderPage.keyboard.press("Space");
  await expect(holderPage.getByLabel(EN.rehome.terms.donate, { exact: true })).toBeChecked();
  await tabTo(holderPage, (info) => info.tag === "SELECT");
  // Type-ahead on the focused select chooses "Pickup" in every browser project.
  await holderPage.keyboard.press("p");
  await expect(holderPage.getByLabel(EN.rehome.start.handoverLegend)).toHaveValue("pickup");
  await tabTo(holderPage, (info) => info.tag === "INPUT" && info.type === "checkbox");
  await holderPage.keyboard.press("Space");
  await tabTo(holderPage, (info) => info.tag === "INPUT" && info.type === "checkbox");
  await holderPage.keyboard.press("Space");
  await touchTarget(holderPage, EN.rehome.start.submit);
  await activateButton(holderPage, EN.rehome.start.submit);
  await expect(holderPage).toHaveURL(new RegExp(`${path}\\?rehome=started$`));
  await expect(holderPage.getByText(EN.rehome.notice.started)).toBeVisible();

  // Second grower: expresses interest with the keyboard.
  const recipient = await browser.newContext();
  const recipientPage = await recipient.newPage();
  await signUp(recipientPage, "recipient", `Recipient ${tag}`, "BE");
  await recipientPage.goto(path);
  await touchTarget(recipientPage, EN.rehome.panel.expressInterest);
  await activateButton(recipientPage, EN.rehome.panel.expressInterest);
  await expect(recipientPage.getByText(EN.rehome.notice.interestRecorded)).toBeVisible();

  // Holder chooses the grower with the keyboard.
  await holderPage.goto(path);
  await activateButton(holderPage, EN.rehome.panel.choose);
  await expect(holderPage.getByText(EN.rehome.notice.chosen)).toBeVisible();

  // The selected recipient declines with the keyboard. The holder is unchanged and the case is available again.
  await recipientPage.goto(path);
  await touchTarget(recipientPage, EN.rehome.panel.declineButton);
  await activateButton(recipientPage, EN.rehome.panel.declineButton);
  await expect(recipientPage.getByText(EN.rehome.notice.declined)).toBeVisible();
  await holderPage.goto(path);
  await expect(holderPage.getByRole("button", { name: EN.rehome.panel.choose })).toHaveCount(0);

  // The decliner expresses interest again, and the holder chooses again, both with the keyboard.
  await recipientPage.goto(path);
  await activateButton(recipientPage, EN.rehome.panel.expressInterest);
  await expect(recipientPage.getByText(EN.rehome.notice.interestRecorded)).toBeVisible();
  await holderPage.goto(path);
  await activateButton(holderPage, EN.rehome.panel.choose);
  await expect(holderPage.getByText(EN.rehome.notice.chosen)).toBeVisible();

  // Receipt: link to the receipt page, then the confirmation button, both with the keyboard.
  await recipientPage.goto(path);
  await tabTo(recipientPage, (info) => info.text === EN.rehome.panel.confirmReceiptLink);
  await recipientPage.keyboard.press("Enter");
  await expect(recipientPage).toHaveURL(new RegExp(`${path}/receive$`));
  await activateButton(recipientPage, EN.rehome.receive.submit);
  await expect(recipientPage.getByText(EN.rehome.notice.received)).toBeVisible();

  await holder.close();
  await recipient.close();
});

test("the availability Search filter and the withdrawal are operated from the keyboard", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const holder = await browser.newContext();
  const holderPage = await holder.newPage();
  await signUp(holderPage, "withdraw", `Withdraw ${tag}`, "NL");
  const path = await createSeedling(holderPage, `Filter ${tag}`);
  await holderPage.goto(`${path}/rehome`);
  await holderPage.getByLabel(EN.rehome.terms.donate, { exact: true }).check();
  await holderPage.getByLabel(EN.rehome.start.makePublicLabel).check();
  await holderPage.getByLabel(EN.rehome.start.understand).check();
  await holderPage.getByRole("button", { name: EN.rehome.start.submit }).click();
  await expect(holderPage.getByText(EN.rehome.notice.started)).toBeVisible();

  // Visitor: the availability filter, the query and the search are operated from the keyboard.
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto("/explore");
  await visitorPage.getByLabel(EN.search.label).focus();
  await expectFocusVisible(visitorPage);
  await visitorPage.keyboard.type(`Filter ${tag}`);
  // The filters are closed by default. The keyboard opens them from their summary, then reaches the availability checkbox.
  await tabTo(visitorPage, (info) => info.tag === "SUMMARY");
  await visitorPage.keyboard.press("Enter");
  await tabTo(visitorPage, (info) => info.tag === "INPUT" && info.type === "checkbox");
  await visitorPage.keyboard.press("Space");
  await expect(visitorPage.getByLabel(EN.search.availableLabel)).toBeChecked();
  // The submit button comes before the filter in the form, so it is focused directly; focus is still checked.
  await visitorPage.getByRole("button", { name: EN.search.submit }).focus();
  await expectFocusVisible(visitorPage);
  await visitorPage.keyboard.press("Enter");
  await expect(visitorPage).toHaveURL(/available=1/);
  await expect(visitorPage.locator("main")).toContainText(`Filter ${tag}`);

  // The holder withdraws availability with the keyboard, and the Seedling leaves the filter.
  await holderPage.goto(path);
  await activateButton(holderPage, EN.rehome.panel.withdrawAvailability);
  await expect(holderPage.getByText(EN.rehome.notice.withdrawn)).toBeVisible();
  await visitorPage.goto(`/?available=1&q=${tag}`);
  await expect(visitorPage.locator("main")).not.toContainText(`Filter ${tag}`);

  await holder.close();
  await visitor.close();
});
