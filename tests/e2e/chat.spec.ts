import { expect, test } from "@playwright/test";
import { FAQ } from "@/lib/faq/data";
import { ask, openChat, pressToggleUntilOpen } from "./helpers";

test.describe("chat answers", () => {
  test("1. an in-scope question shows the AI answer badge", async ({ page }) => {
    await page.goto("/");
    await openChat(page);
    const bubble = await ask(page, "What time do you open?", 1);
    await expect(bubble.getByTestId("chat-source")).toHaveText("AI answer");
    await expect(page.getByTestId("chat-error")).toHaveCount(0);
  });

  test("2. an off-topic question is out of scope and offers the contact hint", async ({ page }) => {
    await page.goto("/");
    await openChat(page);
    const bubble = await ask(page, "What is the capital of France?", 1);
    await expect(bubble.getByTestId("chat-source")).toHaveText("Outside my scope");
    await expect(page.getByTestId("chat-contact-hint")).toBeVisible();
    await expect(page.getByTestId("chat-contact-link")).toBeVisible();
  });

  test("3. a failing provider falls back to the verbatim FAQ answer", async ({ page }) => {
    const hours = FAQ.find((e) => e.id === "hours");
    expect(hours, "FAQ entry 'hours' must exist").toBeDefined();
    await page.goto("/");
    await openChat(page);
    const bubble = await ask(page, "What time do you open? __mock_429__", 1);
    await expect(bubble.getByTestId("chat-source")).toHaveText("From our FAQ");
    // handleChat returns matches[0].entry.answer; for this question that is the `hours` entry.
    await expect(bubble).toContainText(hours!.answer);
    await expect(page.getByTestId("chat-contact-hint")).toHaveCount(0);
  });
});

test.describe("chat widget behaviour", () => {
  test("a. conversation survives close and reopen; Escape and focus rules", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByTestId("chat-toggle");
    const panel = page.getByTestId("chat-panel");

    await openChat(page);
    await ask(page, "What time do you open?", 1);
    await ask(page, "How do I book an appointment?", 2);
    await expect(page.getByTestId("chat-message-user")).toHaveCount(2);

    // Close through the toggle: the panel is hidden but the turns are kept.
    await toggle.click();
    await expect(panel).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("chat-input")).toBeFocused();
    await expect(page.getByTestId("chat-message-user")).toHaveCount(2);
    await expect(page.getByTestId("chat-message-assistant")).toHaveCount(2);
    await expect(page.getByTestId("chat-message-user").first()).toContainText("What time do you open?");
    await expect(page.getByTestId("chat-message-user").nth(1)).toContainText("How do I book an appointment?");

    // Escape with focus inside the widget closes it and returns focus to the toggle.
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();

    await toggle.click();
    await expect(page.getByTestId("chat-input")).toBeFocused();
    await expect(page.getByTestId("chat-message-user")).toHaveCount(2);
  });

  test("a. the panel chunk is requested only on first open", async ({ page }) => {
    const chunks = new Set<string>();
    page.on("request", (req) => {
      if (req.resourceType() === "script" && req.url().includes("/_next/static/chunks/")) {
        chunks.add(req.url());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("load");
    await expect(page.getByTestId("chat-toggle")).toBeVisible();
    await expect(page.getByTestId("chat-panel")).toHaveCount(0);
    expect(chunks.size, "the initial page must load some script chunks").toBeGreaterThan(0);
    const before = new Set(chunks);

    await openChat(page);
    // The panel is a lazy chunk: at least one script chunk is new after the first open.
    await expect
      .poll(() => [...chunks].filter((u) => !before.has(u)).length, {
        message: "opening the chat must request at least one new script chunk",
      })
      .toBeGreaterThan(0);
  });
});

test.describe("chat panel chunk failure", () => {
  test("7. a failed panel chunk does not break the page; Try again recovers", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await expect(page.getByTestId("chat-toggle")).toBeVisible();
    await expect(page.getByTestId("chat-panel")).toHaveCount(0);

    // Robust pattern: every script chunk the page needs at load has ALREADY been fetched here,
    // so any script chunk requested from now on can only be the lazy panel (the file name is
    // hashed per build and must not be hard-coded). Abort all of them.
    const chunkPattern = /\/_next\/static\/chunks\/.+\.js(\?.*)?$/;
    let aborted = 0;
    await page.route(chunkPattern, async (route) => {
      aborted += 1;
      await route.abort();
    });

    const toggle = page.getByTestId("chat-toggle");
    await pressToggleUntilOpen(page);

    const failure = page.getByTestId("chat-panel-error");
    await expect(failure).toBeVisible();
    await expect(failure.getByTestId("chat-retry")).toBeVisible();
    expect(aborted, "the route must really have blocked the lazy chunk").toBeGreaterThan(0);
    // The rest of the page keeps working.
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(toggle).toBeVisible();
    await expect(page.getByTestId("chat-panel")).toHaveCount(0);

    // Contract item 5: close and reopen shows the same failure box until Try again is pressed.
    await toggle.click();
    await expect(failure).toBeHidden();
    await toggle.click();
    await expect(failure).toBeVisible();
    await expect(failure.getByTestId("chat-retry")).toBeVisible();

    // The chunk is reachable again: Try again opens the panel and focuses the input.
    await page.unroute(chunkPattern);
    await failure.getByTestId("chat-retry").click();
    await expect(page.getByTestId("chat-panel")).toBeVisible();
    await expect(page.getByTestId("chat-input")).toBeFocused();
    await expect(page.getByTestId("chat-panel-error")).toHaveCount(0);
  });
});
