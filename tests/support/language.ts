import type { Page } from "@playwright/test";
import { openMastheadMenu } from "./masthead";

/*
 * Chooses a language from the masthead. On a phone the language sits in the More options menu, which is opened first. Only one
 * language control is visible at a time, so the visible one is the one used.
 */
export async function chooseLanguage(page: Page, locale: string) {
  await openMastheadMenu(page);
  await page
    .locator("#language-select:visible, #language-select-menu:visible")
    .selectOption(locale);
}
