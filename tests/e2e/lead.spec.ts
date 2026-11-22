import { expect, test } from "@playwright/test";
import { ask, createLeadViaApi, fakeEmail, isolatedContext, LEAD_NOTICE, openChat } from "./helpers";

// /contact now holds the SIMULATED appointment form (see contact.spec.ts). The real lead feature (POST /api/leads,
// GET /api/leads, /leads) is unchanged, so these tests create leads through the real API with `page.request`
// (shares the page's session cookie; sends Content-Type application/json and a same-origin Origin, as the guard requires).

test.describe("leads through the API and the /leads page", () => {
  test("4. a lead created through the API appears on /leads for the same session", async ({ page, baseURL }) => {
    const { email, status } = await createLeadViaApi(page.request, baseURL, { name: "qa-auto Jane", note: "qa-auto note" });
    expect(status).toBe(201);

    await page.goto("/leads");
    await expect(page.getByTestId("lead-notice")).toHaveText(LEAD_NOTICE);
    const items = page.getByTestId("lead-list-item");
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText(email);
    await expect(items.first()).toContainText("qa-auto Jane");
    await expect(items.first()).toContainText("qa-auto note");
    await expect(page.getByTestId("lead-empty")).toHaveCount(0);
  });

  test("5. a lead made in one browser context is not visible in another", async ({ page, browser, baseURL }) => {
    const { email, status } = await createLeadViaApi(page.request, baseURL);
    expect(status).toBe(201);
    await page.goto("/leads");
    await expect(page.getByTestId("lead-list-item")).toHaveCount(1);
    await expect(page.getByRole("main")).toContainText(email);

    const other = await isolatedContext(browser, baseURL);
    try {
      const pageB = await other.newPage();
      await pageB.goto("/leads");
      await expect(pageB.getByTestId("lead-empty")).toBeVisible();
      await expect(pageB.getByTestId("lead-list-item")).toHaveCount(0);
      await expect(pageB.getByRole("main")).not.toContainText(email);
    } finally {
      await other.close();
    }
  });

  test("b. the 4th lead of a session is refused with 429; 3 stay stored", async ({ page, browser, baseURL }) => {
    for (let i = 1; i <= 3; i++) {
      const r = await createLeadViaApi(page.request, baseURL);
      expect(r.status, `lead ${i} must be accepted`).toBe(201);
    }
    const fourth = await createLeadViaApi(page.request, baseURL, { email: fakeEmail() });
    expect(fourth.status).toBe(429);

    await page.goto("/leads");
    await expect(page.getByTestId("lead-list-item")).toHaveCount(3);
    await expect(page.getByRole("main")).not.toContainText(fourth.email);

    const other = await isolatedContext(browser, baseURL);
    try {
      const pageB = await other.newPage();
      await pageB.goto("/leads");
      await expect(pageB.getByTestId("lead-empty")).toBeVisible();
    } finally {
      await other.close();
    }
  });

  test("b. stored text is rendered as plain text (no HTML injection)", async ({ page, baseURL }) => {
    const name = '<img src=x onerror="window.__xss=1">';
    const note = "<script>window.__xss=2</script><b>bold</b>";
    const r = await createLeadViaApi(page.request, baseURL, { name, note });
    expect(r.status).toBe(201);

    await page.goto("/leads");
    const item = page.getByTestId("lead-list-item");
    await expect(item).toHaveCount(1);
    await expect(item).toContainText("<img src=x onerror=");
    await expect(item).toContainText("<script>window.__xss=2</script>");
    await expect(item).toContainText("<b>bold</b>");
    await expect(item.getByRole("img")).toHaveCount(0);
    await expect(item.getByRole("strong")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });

  test("b. an invalid email is refused by the API with 400 and nothing is stored", async ({ page, baseURL }) => {
    const r = await createLeadViaApi(page.request, baseURL, { email: "not-an-email" });
    expect(r.status).toBe(400);
    await page.goto("/leads");
    await expect(page.getByTestId("lead-empty")).toBeVisible();
  });

  // The chat-history handling of POST /api/leads (redaction, truncation, categorisation) is covered by
  // tests/integration/leads.test.ts; an e2e check in mock mode would only assert a 201 and prove nothing more.

  test("b. after an out-of-scope chat the contact link opens /contact#form-heading and the page has that target", async ({
    page,
  }) => {
    await page.goto("/");
    await openChat(page);
    const bubble = await ask(page, "What is the capital of France?", 1);
    await expect(bubble.getByTestId("chat-source")).toHaveText("Outside my scope");

    await page.getByTestId("chat-contact-link").click();
    await expect(page).toHaveURL(/\/contact#form-heading$/);
    await expect(page.getByTestId("chat-panel")).toBeHidden();
    await expect(page.getByTestId("chat-toggle")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#form-heading")).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Appointment request form" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Full name" })).toBeVisible();
  });
});
