import { expect, test } from "@playwright/test";
import { ask, horizontalScroll, openChat } from "./helpers";

// Runs only in the `mobile` project (375x667, touch).
test("6. mobile: opening the chat and sending a question causes no horizontal scroll", async ({ page }) => {
  await page.goto("/");
  await openChat(page);
  const bubble = await ask(page, "What time do you open?", 1);
  await expect(bubble.getByTestId("chat-source")).toHaveText("AI answer");

  // Contract-level containment: the panel and the Send button are fully inside the viewport.
  await expect(page.getByTestId("chat-panel")).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId("chat-send")).toBeInViewport({ ratio: 1 });

  const { scrollWidth, clientWidth } = await horizontalScroll(page);
  expect(scrollWidth, `scrollWidth ${scrollWidth} must not exceed clientWidth ${clientWidth}`).toBeLessThanOrEqual(
    clientWidth,
  );
});
