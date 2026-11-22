// Shared helpers for the e2e specs. Selectors come only from UI-CONTRACT.md.
import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Waits until React has hydrated the element behind a test id, without any fixed sleep. A click or a native
 * form submit that happens before hydration is lost or reloads the page, which only shows on slow runners.
 * It reads React's OWN marker on the DOM node (the `__reactProps$<id>` property React attaches when it
 * hydrates the element), never CSS or styling. This is the single documented exception to "selectors only
 * getByTestId/getByRole": the locator itself still comes from getByTestId.
 */
export async function waitForHydration(page: Page, testId: string): Promise<void> {
  const locator = page.getByTestId(testId);
  await expect
    .poll(() => locator.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$"))), {
      message: `React has not hydrated [data-testid="${testId}"]`,
      timeout: 15_000,
    })
    .toBe(true);
}

/**
 * Clicks the toggle until it reports aria-expanded="true". A click that lands before React has hydrated
 * the page is lost (seen once in 129 runs), so the click is repeated, but ONLY while the toggle is still
 * closed: once it is open no further click is sent, so it can never close the panel again.
 */
export async function pressToggleUntilOpen(page: Page): Promise<void> {
  const toggle = page.getByTestId("chat-toggle");
  await waitForHydration(page, "chat-toggle");
  await expect(async () => {
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

/** Opens the chat panel and waits until the input has focus (contract item 2). */
export async function openChat(page: Page): Promise<void> {
  await pressToggleUntilOpen(page);
  await expect(page.getByTestId("chat-panel")).toBeVisible();
  await expect(page.getByTestId("chat-input")).toBeFocused();
}

/** Sends one message and waits for the reply to the n-th turn (1-based). Returns that assistant bubble. */
export async function ask(page: Page, text: string, turn: number) {
  await page.getByTestId("chat-input").fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
  const bubble = page.getByTestId("chat-message-assistant").nth(turn - 1);
  await expect(bubble).toBeVisible();
  await expect(page.getByTestId("chat-message-assistant")).toHaveCount(turn);
  return bubble;
}

/** Same idea as waitForHydration, for a locator without a test id (the appointment form has none). */
export async function waitForHydrated(locator: Locator): Promise<void> {
  await expect
    .poll(() => locator.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$"))), {
      message: "React has not hydrated the element",
      timeout: 15_000,
    })
    .toBe(true);
}

export async function horizontalScroll(page: Page): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}
