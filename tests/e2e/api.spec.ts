import { expect, test } from "@playwright/test";
import { fakeEmail } from "./helpers";

// API tests use the `request` fixture: a new APIRequestContext per test, so each test has its own cookie jar.
// No Origin or Sec-Fetch-Site header is sent unless a test sets it (the guard lets a missing header pass).

const validLead = () => ({ email: fakeEmail(), name: "qa-auto", note: "qa-auto note", history: [] });

test.describe("POST /api/leads guard", () => {
  for (const contentType of ["text/plain", "application/x-www-form-urlencoded", "application/jsonx"]) {
    test(`415 for Content-Type ${contentType}, no cookie set, nothing stored`, async ({ request }) => {
      // A 400 (invalid email) still creates the session cookie, so the list below is the one a stored lead would show up in.
      const session = await request.post("/api/leads", { data: { ...validLead(), email: "not-an-email" } });
      expect(session.status()).toBe(400);
      expect(session.headers()["set-cookie"]).toBeDefined();

      const res = await request.post("/api/leads", {
        headers: { "Content-Type": contentType },
        data: JSON.stringify(validLead()),
      });
      expect(res.status()).toBe(415);
      expect(res.headers()["set-cookie"]).toBeUndefined();
      const after = await request.get("/api/leads");
      expect((await after.json()).leads).toEqual([]);
    });
  }

  test("403 for a foreign Origin, no cookie set", async ({ request }) => {
    const res = await request.post("/api/leads", {
      headers: { "Content-Type": "application/json", Origin: "https://evil.invalid" },
      data: validLead(),
    });
    expect(res.status()).toBe(403);
    expect(res.headers()["set-cookie"]).toBeUndefined();
  });

  test("403 for Sec-Fetch-Site cross-site, no cookie set", async ({ request }) => {
    const res = await request.post("/api/leads", {
      headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" },
      data: validLead(),
    });
    expect(res.status()).toBe(403);
    expect(res.headers()["set-cookie"]).toBeUndefined();
  });

  test("a same-origin Origin and Sec-Fetch-Site pass the guard", async ({ request, baseURL }) => {
    const res = await request.post("/api/leads", {
      headers: { "Content-Type": "application/json", Origin: new URL(baseURL!).origin, "Sec-Fetch-Site": "same-origin" },
      data: validLead(),
    });
    expect(res.status()).toBe(201);
  });
});

test.describe("POST /api/leads validation and limits", () => {
  test("400 for an invalid email", async ({ request }) => {
    const res = await request.post("/api/leads", { data: { ...validLead(), email: "not-an-email" } });
    expect(res.status()).toBe(400);
    const after = await request.get("/api/leads");
    expect((await after.json()).leads).toEqual([]);
  });

  test("400 for a non-empty honeypot; nothing is stored", async ({ request }) => {
    const res = await request.post("/api/leads", { data: { ...validLead(), website: "http://spam.invalid" } });
    expect(res.status()).toBe(400);
    const after = await request.get("/api/leads");
    expect(after.status()).toBe(200);
    expect((await after.json()).leads).toEqual([]);
  });

  test("201 for a valid lead; it is listed for the same session only", async ({ request, playwright, baseURL }) => {
    const body = validLead();
    const res = await request.post("/api/leads", { data: body });
    expect(res.status()).toBe(201);
    expect((await res.json()).lead.email).toBe(body.email);
    expect(res.headers()["set-cookie"]).toBeDefined();

    const own = await request.get("/api/leads");
    expect((await own.json()).leads).toHaveLength(1);

    const stranger = await playwright.request.newContext({ baseURL });
    try {
      const other = await stranger.get("/api/leads");
      expect((await other.json()).leads).toEqual([]);
    } finally {
      await stranger.dispose();
    }
  });

  test("the 4th valid lead of a session is 429 with Retry-After", async ({ request }) => {
    for (let i = 1; i <= 3; i++) {
      const ok = await request.post("/api/leads", { data: validLead() });
      expect(ok.status(), `lead ${i}`).toBe(201);
    }
    const fourth = await request.post("/api/leads", { data: validLead() });
    expect(fourth.status()).toBe(429);
    expect(Number(fourth.headers()["retry-after"])).toBeGreaterThan(0);
    const list = await request.get("/api/leads");
    expect((await list.json()).leads).toHaveLength(3);
  });
});

test.describe("GET /api/leads", () => {
  test("without a cookie answers 200 with an empty list", async ({ request }) => {
    const res = await request.get("/api/leads");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ leads: [] });
  });

  test("a cookie with the right id but a wrong signature is not a session", async ({ request, playwright, baseURL }) => {
    const created = await request.post("/api/leads", { data: validLead() });
    expect(created.status()).toBe(201);
    expect((await (await request.get("/api/leads")).json()).leads).toHaveLength(1);

    const { cookies } = await request.storageState();
    const session = cookies.find((c) => c.name === "nd_session");
    expect(session, "the session cookie must exist").toBeDefined();
    const [id, signature] = session!.value.split(".");
    // Same id and same length, last signature character changed: only the signature check can reject it.
    const flipped = signature.slice(0, -1) + (signature.endsWith("A") ? "B" : "A");

    const stranger = await playwright.request.newContext({ baseURL });
    try {
      const res = await stranger.get("/api/leads", { headers: { Cookie: `nd_session=${id}.${flipped}` } });
      expect(res.status()).toBe(200);
      expect(await res.json()).toEqual({ leads: [] });
      // Control: the genuine cookie does show the lead.
      const genuine = await stranger.get("/api/leads", { headers: { Cookie: `nd_session=${id}.${signature}` } });
      expect((await genuine.json()).leads).toHaveLength(1);
    } finally {
      await stranger.dispose();
    }
  });

  test("a garbage cookie answers 200 with an empty list", async ({ request }) => {
    const res = await request.get("/api/leads", { headers: { Cookie: "nd_session=forged.value" } });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ leads: [] });
  });
});
