import { expect, test } from "@playwright/test";
import { horizontalScroll } from "./helpers";

// Viewport sweep: the owner's list (320, 360, 768, 1280) plus the standing sizes from CLAUDE.md.
const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 667, height: 375 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

const ROUTES = ["/", "/services", "/faq", "/contact", "/leads"];

// One independent test per route and viewport, so a failure names the exact combination.
for (const route of ROUTES) {
  for (const { width, height } of VIEWPORTS) {
    const where = `${route} at ${width}x${height}`;
    test(where, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(route);
      await page.waitForLoadState("load");

      const { scrollWidth, clientWidth } = await horizontalScroll(page);
      expect(scrollWidth, `${where}: scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`).toBeLessThanOrEqual(
        clientWidth,
      );

      const body = await page.evaluate(() => ({
        scrollWidth: document.body.scrollWidth,
        clientWidth: document.body.clientWidth,
      }));
      expect(
        body.scrollWidth,
        `${where}: body scrollWidth ${body.scrollWidth} > body clientWidth ${body.clientWidth}`,
      ).toBeLessThanOrEqual(body.clientWidth);

      await expect(page.getByTestId("demo-banner"), `${where}: demo banner`).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Main" }), `${where}: main navigation`).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 }), `${where}: h1`).toBeVisible();
      await expect(page.getByTestId("chat-toggle"), `${where}: chat toggle`).toBeVisible();
      // At scroll 0 the banner and the navigation sit at the top of the page, and the fixed toggle is always on screen.
      await expect(page.getByTestId("demo-banner"), `${where}: demo banner in viewport`).toBeInViewport();
      await expect(page.getByRole("navigation", { name: "Main" }), `${where}: nav in viewport`).toBeInViewport();
      await expect(page.getByTestId("chat-toggle"), `${where}: toggle fully in viewport`).toBeInViewport({ ratio: 1 });

      if (route === "/contact") {
        await expect(page.getByTestId("lead-email"), `${where}: lead email`).toBeVisible();
        await expect(page.getByTestId("lead-submit"), `${where}: lead submit`).toBeVisible();
      }
      if (route === "/leads") {
        await expect(page.getByTestId("lead-notice"), `${where}: lead notice`).toBeVisible();
      }
    });
  }
}
