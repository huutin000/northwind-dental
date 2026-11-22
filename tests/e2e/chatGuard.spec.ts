import { expect, test } from "@playwright/test";

// Request guard on POST /api/chat (lib/guard/requestGuard.ts runs before any session, limiter or provider).
// A rejected request must not set a cookie. These tests send no valid chat message and need no AI or cookie.

const BODY = { message: "What time do you open?", history: [] };

test.describe("POST /api/chat request guard", () => {
  for (const contentType of ["text/plain", "application/x-www-form-urlencoded", "application/jsonx"]) {
    test(`415 for Content-Type ${contentType}, no cookie set`, async ({ request }) => {
      const res = await request.post("/api/chat", {
        headers: { "Content-Type": contentType },
        data: JSON.stringify(BODY),
      });
      expect(res.status()).toBe(415);
      expect(res.headers()["set-cookie"]).toBeUndefined();
    });
  }

  // Positive control: the guard lets a same-origin JSON request through (mock AI answers an in-scope question
  // with 200; the existing chat tests show the "AI answer" label for this question). One accepted request only.
  test("a same-origin JSON request is not blocked by the guard", async ({ request, baseURL }) => {
    const res = await request.post("/api/chat", {
      headers: {
        "Content-Type": "application/json",
        Origin: new URL(baseURL!).origin,
        "Sec-Fetch-Site": "same-origin",
      },
      data: BODY,
    });
    expect(res.status()).not.toBe(403);
    expect(res.status()).not.toBe(415);
    expect(res.status()).toBe(200);
    expect((await res.json()).source).toBe("ai");
  });

  test("403 for a foreign Origin with application/json, no cookie set", async ({ request }) => {
    const res = await request.post("/api/chat", {
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      data: BODY,
    });
    expect(res.status()).toBe(403);
    expect(res.headers()["set-cookie"]).toBeUndefined();
  });

  test("403 for Sec-Fetch-Site cross-site, no cookie set", async ({ request }) => {
    const res = await request.post("/api/chat", {
      headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" },
      data: BODY,
    });
    expect(res.status()).toBe(403);
    expect(res.headers()["set-cookie"]).toBeUndefined();
  });
});
