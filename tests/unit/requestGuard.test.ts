import { describe, expect, it } from "vitest";
import { checkJsonPost } from "@/lib/guard/requestGuard";

const UNSUPPORTED = { ok: false, status: 415, error: "Unsupported content type." };
const FORBIDDEN = { ok: false, status: 403, error: "Request not allowed." };

function req(headers: Record<string, string>) {
  return new Request("http://localhost:3000/api/chat", { method: "POST", headers, body: "{}" });
}
const json = { "content-type": "application/json" };

describe("checkJsonPost: content type", () => {
  it.each(["application/json", "application/json; charset=utf-8", "APPLICATION/JSON", "  Application/Json ;charset=UTF-8"])(
    "%s passes",
    (ct) => {
      expect(checkJsonPost(req({ "content-type": ct }))).toEqual({ ok: true });
    },
  );

  it.each([
    "text/plain",
    "text/plain;charset=UTF-8",
    "application/json-patch+json",
    "application/x-www-form-urlencoded",
    "multipart/form-data; boundary=x",
    "application/jsonx",
    "",
  ])("%j -> 415", (ct) => {
    expect(checkJsonPost(req({ "content-type": ct }))).toEqual(UNSUPPORTED);
  });

  it("a Request with a string body and no explicit type is text/plain -> 415", () => {
    expect(checkJsonPost(new Request("http://localhost/x", { method: "POST", body: "{}" }))).toEqual(UNSUPPORTED);
  });

  it("no body and no content type -> 415", () => {
    expect(checkJsonPost(new Request("http://localhost/x", { method: "POST" }))).toEqual(UNSUPPORTED);
  });
});

describe("checkJsonPost: Sec-Fetch-Site", () => {
  it.each(["same-origin", "none"])("%s passes", (v) => {
    expect(checkJsonPost(req({ ...json, "sec-fetch-site": v }))).toEqual({ ok: true });
  });
  it.each(["cross-site", "same-site", "weird", ""])("%j -> 403", (v) => {
    expect(checkJsonPost(req({ ...json, "sec-fetch-site": v }))).toEqual(FORBIDDEN);
  });
  it("absent passes", () => {
    expect(checkJsonPost(req(json))).toEqual({ ok: true });
  });
  it("the content type is checked first", () => {
    expect(checkJsonPost(req({ "content-type": "text/plain", "sec-fetch-site": "cross-site" }))).toEqual(UNSUPPORTED);
  });
});

describe("checkJsonPost: Origin", () => {
  const withOrigin = (origin: string, extra: Record<string, string> = {}) =>
    checkJsonPost(req({ ...json, host: "localhost:3000", origin, ...extra }));

  it("same host and port passes", () => {
    expect(withOrigin("http://localhost:3000")).toEqual({ ok: true });
    expect(withOrigin("https://localhost:3000")).toEqual({ ok: true });
  });
  it("another host -> 403", () => {
    expect(withOrigin("https://evil.example")).toEqual(FORBIDDEN);
  });
  it("another port -> 403", () => {
    expect(withOrigin("http://localhost:4000")).toEqual(FORBIDDEN);
    expect(withOrigin("http://localhost")).toEqual(FORBIDDEN);
  });
  it.each(["null", "not a url", "", "   "])("%j -> 403", (v) => {
    expect(withOrigin(v)).toEqual(FORBIDDEN);
  });
  it("X-Forwarded-Host (first value) is used when present", () => {
    const h = { "x-forwarded-host": "www.example.org, proxy.internal" };
    expect(withOrigin("https://www.example.org", h)).toEqual({ ok: true });
    expect(withOrigin("https://proxy.internal", h)).toEqual(FORBIDDEN);
    expect(withOrigin("http://localhost:3000", h)).toEqual(FORBIDDEN);
  });
  it("absent Origin passes", () => {
    expect(checkJsonPost(req({ ...json, host: "localhost:3000" }))).toEqual({ ok: true });
  });
  it("both headers together: same-origin plus matching Origin passes, cross-site plus matching Origin fails", () => {
    expect(withOrigin("http://localhost:3000", { "sec-fetch-site": "same-origin" })).toEqual({ ok: true });
    expect(withOrigin("http://localhost:3000", { "sec-fetch-site": "cross-site" })).toEqual(FORBIDDEN);
    expect(withOrigin("https://evil.example", { "sec-fetch-site": "same-origin" })).toEqual(FORBIDDEN);
  });
});
