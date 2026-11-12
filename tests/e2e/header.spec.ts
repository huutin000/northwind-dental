import { expect, test, type Page } from "@playwright/test";
import { waitForHydration } from "./helpers";

// Header behaviour: the phone Menu disclosure (UI-CONTRACT item 15) and the sticky header.
// Selectors: roles only. No fixed sleeps.

const PHONE = { width: 390, height: 844 };
const LINKS = ["Services", "Approach", "FAQ", "Contact"];

function menuButton(page: Page) {
  return page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Menu" });
}

function navLink(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Main" }).getByRole("link", { name, exact: true });
}

/** Clicks Menu once and asserts it opened. Call only on an already hydrated page. */
async function openMenu(page: Page): Promise<void> {
  const button = menuButton(page);
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
}

test.describe("phone Menu", () => {
  test.use({ viewport: PHONE });

  test("closed state, ARIA wiring, open, Escape and link click", async ({ page }) => {
    await page.goto("/");
    // The Menu button has no test id, so readiness is read from the chat toggle. ASSUMPTION: <Header /> renders
    // before <ChatWidget /> in app/layout.tsx, so React hydrates the Header first; once the toggle carries React's
    // marker the Menu handler is attached. If that order changes, give the Menu button a test id and wait on it.
    await waitForHydration(page, "chat-toggle");
    const button = menuButton(page);

    // Closed by default.
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(navLink(page, "Services")).toBeHidden();

    // ARIA wiring: aria-controls points at an element that exists.
    await expect(button).toHaveAttribute("aria-controls", "main-menu");
    await expect(page.locator("#main-menu")).toHaveCount(1);

    // Open: all four links are visible.
    await openMenu(page);
    for (const name of LINKS) await expect(navLink(page, name), `link ${name} visible`).toBeVisible();

    // Escape closes it and returns focus to the button.
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(navLink(page, "Services")).toBeHidden();
    await expect(button).toBeFocused();

    // Open again and follow a link: navigates and the menu is closed afterwards.
    await openMenu(page);
    await navLink(page, "FAQ").click();
    await expect(page).toHaveURL(/\/faq$/);
    await expect(menuButton(page)).toHaveAttribute("aria-expanded", "false");
    await expect(navLink(page, "Services")).toBeHidden();
  });
});

// Guard for the masking bug found in the redesign review: `overflow-x: hidden` on html/body hides real overflow
// (the scrollWidth <= clientWidth sweep stays green) and also stops the sticky header from sticking.
test.describe("no horizontal clipping on html and body", () => {
  for (const { width, height } of [
    { width: 1440, height: 900 },
    PHONE,
  ]) {
    const where = `${width}x${height}`;
    test(`html and body do not clip overflow-x at ${where}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await page.waitForLoadState("load");
      const overflowX = await page.evaluate(() => ({
        html: getComputedStyle(document.documentElement).overflowX,
        body: getComputedStyle(document.body).overflowX,
      }));
      expect(["hidden", "clip"], `${where}: html overflow-x is ${overflowX.html}`).not.toContain(overflowX.html);
      expect(["hidden", "clip"], `${where}: body overflow-x is ${overflowX.body}`).not.toContain(overflowX.body);
    });
  }
});

test.describe("sticky header", () => {
  for (const { width, height } of [
    { width: 1440, height: 900 },
    PHONE,
  ]) {
    const where = `${width}x${height}`;
    test(`header stays at the top after scrolling at ${where}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/faq");
      await page.waitForLoadState("load");

      await page.evaluate(() => window.scrollTo(0, 600));
      await expect
        .poll(() => page.evaluate(() => window.scrollY), { message: `${where}: page did not scroll` })
        .toBeGreaterThan(0);

      await expect
        .poll(async () => (await page.getByRole("banner").boundingBox())?.y, {
          message: `${where}: sticky header is not at y=0 after scrolling`,
        })
        .toBe(0);
    });
  }
});
