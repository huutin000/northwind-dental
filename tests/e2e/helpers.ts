// Shared helpers for the e2e specs. Selectors come only from UI-CONTRACT.md.
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const LEAD_LIMIT_MESSAGE = "You have reached the request limit for this demo. Please try again tomorrow.";
export const LEAD_NOTICE = "This is a demo. Please use a fake email. Data is deleted after 24 hours.";

let counter = 0;

/** A fake, unique address (test data is dummy: example.com never delivers). */
export function fakeEmail(): string {
  counter += 1;
  return `qa-auto-${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

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

/** Fills and submits the lead form on the current page (/contact). Returns the email used. */
export async function fillAndSubmitLead(
  page: Page,
  values: { email?: string; name?: string; note?: string } = {},
): Promise<string> {
  // Never fill or submit before React owns the form: a native submit would reload the page.
  await waitForHydration(page, "lead-submit");
  const email = values.email ?? fakeEmail();
  await page.getByTestId("lead-email").fill(email);
  if (values.name !== undefined) await page.getByTestId("lead-name").fill(values.name);
  if (values.note !== undefined) await page.getByTestId("lead-note").fill(values.note);
  await page.getByTestId("lead-submit").click();
  return email;
}

/** A second, fully isolated browser context (own cookies, so own server session). */
export async function isolatedContext(browser: Browser, baseURL: string | undefined): Promise<BrowserContext> {
  return browser.newContext({ baseURL });
}

export async function horizontalScroll(page: Page): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}
