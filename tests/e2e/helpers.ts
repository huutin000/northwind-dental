// Shared helpers for the e2e specs. Selectors come only from UI-CONTRACT.md.
import { expect, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

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

/**
 * Creates a lead through the REAL API (the old lead form is no longer on /contact). `request` should be
 * `page.request` so the session cookie is shared with the page and the lead shows up on /leads.
 * Sends what the request guard requires: Content-Type application/json and a same-origin Origin header.
 */
export async function createLeadViaApi(
  request: APIRequestContext,
  baseURL: string | undefined,
  values: { email?: string; name?: string; note?: string; history?: { role: string; content: string }[] } = {},
): Promise<{ email: string; status: number }> {
  const email = values.email ?? fakeEmail();
  const res = await request.post("/api/leads", {
    headers: { "Content-Type": "application/json", Origin: new URL(baseURL!).origin },
    data: { email, name: values.name, note: values.note, history: values.history ?? [], website: "" },
  });
  return { email, status: res.status() };
}

/** A second, fully isolated browser context (own cookies, so own server session). */
export async function isolatedContext(browser: Browser, baseURL: string | undefined): Promise<BrowserContext> {
  return browser.newContext({ baseURL });
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
