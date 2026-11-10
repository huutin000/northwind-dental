import { expect, test } from "@playwright/test";
import { ask, fakeEmail, fillAndSubmitLead, isolatedContext, LEAD_LIMIT_MESSAGE, LEAD_NOTICE, openChat } from "./helpers";

test.describe("lead form and /leads", () => {
  test("4. a submitted lead appears on /leads; success box is focused and links to /leads", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByTestId("lead-notice")).toHaveText(LEAD_NOTICE);
    const email = await fillAndSubmitLead(page, { name: "qa-auto Jane", note: "qa-auto note" });

    const success = page.getByTestId("lead-success");
    await expect(success).toBeVisible();
    await expect(success).toBeFocused();
    const link = page.getByTestId("lead-view-link");
    await expect(link).toHaveAttribute("href", "/leads");

    await link.click();
    await expect(page).toHaveURL(/\/leads$/);
    const items = page.getByTestId("lead-list-item");
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText(email);
    await expect(items.first()).toContainText("qa-auto Jane");
    await expect(items.first()).toContainText("qa-auto note");
    await expect(page.getByTestId("lead-empty")).toHaveCount(0);
    await expect(page.getByTestId("lead-notice")).toHaveText(LEAD_NOTICE);
  });

  test("5. a lead made in one browser context is not visible in another", async ({ page, browser, baseURL }) => {
    await page.goto("/contact");
    const email = await fillAndSubmitLead(page);
    await expect(page.getByTestId("lead-success")).toBeVisible();
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

  test("b. the 4th lead of a session is refused with the limit message; 3 stay stored", async ({
    page,
    browser,
    baseURL,
  }) => {
    for (let i = 1; i <= 3; i++) {
      await page.goto("/contact");
      await fillAndSubmitLead(page);
      await expect(page.getByTestId("lead-success"), `lead ${i} must be accepted`).toBeVisible();
    }

    await page.goto("/contact");
    const fourth = fakeEmail();
    const responsePromise = page.waitForResponse((r) => r.url().endsWith("/api/leads") && r.request().method() === "POST");
    await fillAndSubmitLead(page, { email: fourth });
    expect((await responsePromise).status()).toBe(429);
    // The live region may prefix the text (for example "Error: "), so match the contract sentence as a substring.
    await expect(page.getByTestId("lead-error")).toContainText(LEAD_LIMIT_MESSAGE);
    await expect(page.getByTestId("lead-success")).toHaveCount(0);

    await page.goto("/leads");
    await expect(page.getByTestId("lead-list-item")).toHaveCount(3);
    await expect(page.getByRole("main")).not.toContainText(fourth);

    const other = await isolatedContext(browser, baseURL);
    try {
      const pageB = await other.newPage();
      await pageB.goto("/leads");
      await expect(pageB.getByTestId("lead-empty")).toBeVisible();
    } finally {
      await other.close();
    }
  });

  test("b. stored text is rendered as plain text (no HTML injection)", async ({ page }) => {
    const name = '<img src=x onerror="window.__xss=1">';
    const note = "<script>window.__xss=2</script><b>bold</b>";
    await page.goto("/contact");
    await fillAndSubmitLead(page, { name, note });
    await expect(page.getByTestId("lead-success")).toBeVisible();

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

  test("b. an invalid email focuses the field, sets aria-invalid and posts nothing", async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/leads")) posts.push(req.url());
    });
    await page.goto("/contact");
    await fillAndSubmitLead(page, { email: "not-an-email" });

    const field = page.getByTestId("lead-email");
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByTestId("lead-success")).toHaveCount(0);
    expect(posts, "client validation must stop the request").toHaveLength(0);
  });

  test("b. after an out-of-scope chat the contact link opens /contact and the lead carries the history", async ({
    page,
  }) => {
    await page.goto("/");
    await openChat(page);
    const question = "What is the capital of France?";
    const bubble = await ask(page, question, 1);
    await expect(bubble.getByTestId("chat-source")).toHaveText("Outside my scope");

    await page.getByTestId("chat-contact-link").click();
    await expect(page).toHaveURL(/\/contact#form-heading$/);
    await expect(page.getByTestId("chat-panel")).toBeHidden();
    await expect(page.getByTestId("chat-toggle")).toHaveAttribute("aria-expanded", "false");

    const requestPromise = page.waitForRequest((r) => r.url().endsWith("/api/leads") && r.method() === "POST");
    await fillAndSubmitLead(page);
    const body = (await requestPromise).postDataJSON() as {
      website: unknown;
      history: { role: string; content: string }[];
    };
    await expect(page.getByTestId("lead-success")).toBeVisible();

    expect(body.website).toBe("");
    expect(body.history).toHaveLength(2);
    expect(body.history[0]).toEqual({ role: "user", content: question });
    expect(body.history[1].role).toBe("assistant");
    expect(body.history[1].content.length).toBeGreaterThan(0);
  });
});
