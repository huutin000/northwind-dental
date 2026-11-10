import { describe, expect, it } from "vitest";
import { LEAD_NOTICE, buildLeadRequest, describeLeadResponse } from "@/lib/leads/leadRequest";
import { LEAD_ERRORS } from "@/lib/leads/schema";

describe("LEAD_NOTICE", () => {
  it("is the verbatim banner text", () => {
    expect(LEAD_NOTICE).toBe("This is a demo. Please use a fake email. Data is deleted after 24 hours.");
  });
});

describe("buildLeadRequest", () => {
  const history = [{ role: "user" as const, content: "hi" }];
  const init = buildLeadRequest({ email: " ada@example.com ", name: "Ada", note: "hello" }, history);

  it("is a POST with exactly the JSON content type", () => {
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("never opts out of credentials or sets a referrer policy", () => {
    expect(init.credentials).toBeUndefined();
    expect(init.referrerPolicy).toBeUndefined();
    expect(init.mode).toBeUndefined();
  });

  it("sends the fields, an empty honeypot `website` and the history", () => {
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      email: " ada@example.com ",
      name: "Ada",
      note: "hello",
      website: "",
      history,
    });
    expect(body.website).toBe("");
  });

  it("sends history: [] when there is none", () => {
    const body = JSON.parse(buildLeadRequest({ email: "a@b.co", name: "", note: "" }, []).body as string);
    expect(body.history).toEqual([]);
  });

  it("passes the honeypot value through when given (a bot filled it)", () => {
    const body = JSON.parse(
      buildLeadRequest({ email: "a@b.co", name: "", note: "", website: "x" }, []).body as string,
    );
    expect(body.website).toBe("x");
  });
});

describe("describeLeadResponse", () => {
  const msg = (status: number, body?: unknown) => {
    const r = describeLeadResponse(status, body);
    if (r.ok) throw new Error("expected failure");
    return r;
  };

  it("treats 201 (and any 2xx) as success, even with an unreadable body", () => {
    expect(describeLeadResponse(201, { lead: {} })).toEqual({ ok: true });
    expect(describeLeadResponse(201, undefined)).toEqual({ ok: true });
    expect(describeLeadResponse(200, null)).toEqual({ ok: true });
  });

  it("gives a distinct fixed message for 403, 415, 429 and 503", () => {
    const texts = [403, 415, 429, 503].map((s) => msg(s, { error: "SECRET server text" }).message);
    expect(new Set(texts).size).toBe(4);
    for (const t of texts) expect(t).not.toContain("SECRET");
  });

  it("429 mentions the limit and trying again later", () => {
    expect(msg(429).message).toMatch(/limit/i);
    expect(msg(429).message).toMatch(/tomorrow|later/i);
  });

  it("503 says the request could not be saved", () => {
    expect(msg(503).message).toMatch(/could not save/i);
  });

  it("403 and 415 suggest reloading the page", () => {
    expect(msg(403).message).toMatch(/reload/i);
    expect(msg(415).message).toMatch(/reload/i);
  });

  it("400 shows a known server message and maps field messages to their field", () => {
    expect(msg(400, { error: LEAD_ERRORS.email })).toEqual({
      ok: false,
      message: LEAD_ERRORS.email,
      field: "email",
    });
    expect(msg(400, { error: LEAD_ERRORS.name }).field).toBe("name");
    expect(msg(400, { error: LEAD_ERRORS.note }).field).toBe("note");
    const tooBig = msg(400, { error: LEAD_ERRORS.tooBig });
    expect(tooBig.message).toBe(LEAD_ERRORS.tooBig);
    expect(tooBig.field).toBeUndefined();
  });

  it("400 with an unknown or missing server message falls back to a generic text", () => {
    const generic = msg(400).message;
    expect(msg(400, { error: "<b>evil</b>" }).message).toBe(generic);
    expect(msg(400, { error: 42 }).message).toBe(generic);
    expect(msg(400, "text").message).toBe(generic);
    expect(msg(400, { error: "constructor" }).message).toBe(generic);
    expect(generic).toMatch(/check your details/i);
  });

  it("500, other statuses, network failure (0) and unreadable bodies use one generic text", () => {
    const generic = "Something went wrong. Please try again.";
    for (const s of [500, 502, 404, 0, 302]) expect(msg(s, { error: "boom" }).message).toBe(generic);
    expect(msg(500, undefined).message).toBe(generic);
    expect(msg(500).field).toBeUndefined();
  });
});
