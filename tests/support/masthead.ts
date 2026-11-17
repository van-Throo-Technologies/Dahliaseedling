import type { Page } from "@playwright/test";

/*
 * On a phone the masthead keeps the language, and for a visitor the inbox, in its More options menu. This opens that menu when it is
 * the visible way to reach them; on a wider screen they are already in the bar, so nothing is clicked.
 */
export async function openMastheadMenu(page: Page) {
  // The first header is the masthead. Feed cards have headers of their own, and their menus are not this one.
  const more = page.locator("header").first().locator("button[aria-controls][aria-expanded]");
  if (await more.isVisible()) await more.click();
}
