import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { getOrCreateSession, readSession } from "@/lib/session";

const SECRET = "unit-test-secret-0123456789";

afterEach(() => vi.unstubAllEnvs());

/** A request carrying the given raw Cookie header (or none). */
function req(cookie?: string): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: cookie === undefined ? {} : { cookie },
  });
}

/** "nd_session=<id>.<sig>" from a Set-Cookie string. */
function cookiePair(setCookie: string): string {
  return setCookie.split(";")[0];
}

function sign(id: string, secret: string): string {
  return createHmac("sha256", secret).update(id).digest("base64url");
}

describe("session cookie", () => {
  it("creates a session with the expected cookie format and attributes", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const s = getOrCreateSession(req());
    expect(s.sessionId).toMatch(/^[0-9a-f]{32}$/);
    expect(s.setCookie).toBeDefined();
    const [pair, ...attrs] = s.setCookie!.split("; ");
    expect(pair).toBe(`nd_session=${s.sessionId}.${sign(s.sessionId, SECRET)}`);
    expect(attrs).toEqual(
      expect.arrayContaining(["HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=86400"]),
    );
    expect(attrs).not.toContain("Secure"); // NODE_ENV is "test"
  });

  it("adds Secure in production", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.stubEnv("NODE_ENV", "production");
    expect(getOrCreateSession(req()).setCookie).toContain("; Secure");
  });

  it("round trip: the cookie is accepted and no new cookie is set", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const first = getOrCreateSession(req());
    const again = getOrCreateSession(req(cookiePair(first.setCookie!)));
    expect(again.sessionId).toBe(first.sessionId);
    expect(again.setCookie).toBeUndefined();
    expect(readSession(req(cookiePair(first.setCookie!)))).toBe(first.sessionId);
  });

  it("reads the cookie among several cookies and with spaces", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const first = getOrCreateSession(req());
    const pair = cookiePair(first.setCookie!);
    expect(readSession(req(`a=1; ${pair}; b=2`))).toBe(first.sessionId);
    expect(readSession(req(`a=1;   ${pair}  ;b=2`))).toBe(first.sessionId);
  });

  it("a cookie signed with another secret is not a session", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const first = getOrCreateSession(req());
    vi.stubEnv("SESSION_SECRET", "a-different-secret-9876543210");
    expect(readSession(req(cookiePair(first.setCookie!)))).toBeNull();
    const next = getOrCreateSession(req(cookiePair(first.setCookie!)));
    expect(next.sessionId).not.toBe(first.sessionId);
    expect(next.setCookie).toBeDefined();
  });

  it("malformed cookies count as no session and are never reused", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const id = "0123456789abcdef0123456789abcdef";
    const good = `${id}.${sign(id, SECRET)}`;
    const upperId = id.toUpperCase();
    const bad = [
      "nd_session=",
      `nd_session=${id}`, // no dot
      `nd_session=${good}.extra`, // extra dot
      `nd_session=${id}.`, // empty signature
      `nd_session=${upperId}.${sign(upperId, SECRET)}`, // validly signed but not lowercase hex
      `nd_session=${"z".repeat(32)}.${sign("z".repeat(32), SECRET)}`, // non-hex id
      `nd_session=${"a".repeat(5000)}`, // 5 KB value
      `nd_session=${id}.${sign(id, SECRET).slice(0, -1)}A`, // tampered signature
      `nd_session=${id}.${sign(id, SECRET).slice(0, 10)}`, // short signature
      "other=1",
    ];
    for (const cookie of bad) {
      expect(readSession(req(cookie)), cookie.slice(0, 40)).toBeNull();
      const s = getOrCreateSession(req(cookie));
      expect(s.setCookie, cookie.slice(0, 40)).toBeDefined();
      expect(s.sessionId).not.toBe(id);
    }
  });

  it("readSession never creates and returns null without a cookie", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    expect(readSession(req())).toBeNull();
  });

  it("ids are random", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    expect(getOrCreateSession(req()).sessionId).not.toBe(getOrCreateSession(req()).sessionId);
  });
});

describe("SESSION_SECRET handling", () => {
  it("production without a secret throws", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    expect(() => getOrCreateSession(req())).toThrow();
    expect(() => readSession(req("nd_session=x.y"))).toThrow();
  });

  it("production with a short secret throws, and the message never holds the secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "short-secret");
    try {
      getOrCreateSession(req());
      expect.unreachable();
    } catch (e) {
      expect(String((e as Error).message)).not.toContain("short-secret");
    }
  });

  it("test and development fall back to a fixed development secret", () => {
    for (const env of ["test", "development"]) {
      vi.stubEnv("NODE_ENV", env);
      vi.stubEnv("SESSION_SECRET", "");
      const first = getOrCreateSession(req());
      expect(readSession(req(cookiePair(first.setCookie!)))).toBe(first.sessionId);
    }
  });

  it("a secret shorter than 16 characters counts as unset", () => {
    vi.stubEnv("SESSION_SECRET", "short");
    const first = getOrCreateSession(req());
    // Signed with the fallback, not with "short":
    expect(cookiePair(first.setCookie!)).not.toContain(sign(first.sessionId, "short"));
    vi.stubEnv("SESSION_SECRET", "");
    expect(readSession(req(cookiePair(first.setCookie!)))).toBe(first.sessionId);
  });
});
