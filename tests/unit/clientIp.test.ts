import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getClientKey } from "@/lib/guard/clientIp";

afterEach(() => {
  vi.unstubAllEnvs();
});

const req = (headers: Record<string, string> = {}) => new Request("http://localhost/api/chat", { method: "POST", headers });
const expected = (secret: string, ip: string) =>
  createHash("sha256").update(secret).update(ip).digest("hex").slice(0, 32);

describe("AC-2: getClientKey", () => {
  it("AC-2: hashes SESSION_SECRET + ip to 32 hex chars and never contains the raw ip", () => {
    vi.stubEnv("SESSION_SECRET", "unit-secret-0123456789");
    const key = getClientKey(req({ "x-real-ip": "203.0.113.7" }));
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).toBe(expected("unit-secret-0123456789", "203.0.113.7"));
    expect(key).not.toContain("203.0.113.7");
  });

  it("AC-2: same ip gives the same key, different ips give different keys", () => {
    vi.stubEnv("SESSION_SECRET", "unit-secret-0123456789");
    const a = getClientKey(req({ "x-real-ip": "198.51.100.1" }));
    expect(getClientKey(req({ "x-real-ip": "198.51.100.1" }))).toBe(a);
    expect(getClientKey(req({ "x-real-ip": "198.51.100.2" }))).not.toBe(a);
  });

  it("AC-2: a different SESSION_SECRET changes the key (the hash is salted)", () => {
    vi.stubEnv("SESSION_SECRET", "unit-secret-0123456789");
    const a = getClientKey(req({ "x-real-ip": "198.51.100.1" }));
    vi.stubEnv("SESSION_SECRET", "another-secret-9876543210");
    expect(getClientKey(req({ "x-real-ip": "198.51.100.1" }))).not.toBe(a);
  });

  it("AC-2: no header -> constant 'unknown'", () => {
    expect(getClientKey(req())).toBe("unknown");
  });

  it("AC-2: x-forwarded-for is ignored (spoofing it does not change the key, alone it gives 'unknown')", () => {
    vi.stubEnv("SESSION_SECRET", "unit-secret-0123456789");
    expect(getClientKey(req({ "x-forwarded-for": "1.2.3.4" }))).toBe("unknown");
    const base = getClientKey(req({ "x-real-ip": "203.0.113.7" }));
    expect(getClientKey(req({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "9.9.9.9, 8.8.8.8" }))).toBe(base);
    expect(getClientKey(req({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4" }))).toBe(base);
  });

  it("AC-2: x-real-ip wins over x-vercel-forwarded-for; the latter is used alone", () => {
    vi.stubEnv("SESSION_SECRET", "unit-secret-0123456789");
    const real = getClientKey(req({ "x-real-ip": "203.0.113.7", "x-vercel-forwarded-for": "198.51.100.9" }));
    expect(real).toBe(expected("unit-secret-0123456789", "203.0.113.7"));
    expect(getClientKey(req({ "x-vercel-forwarded-for": "198.51.100.9" }))).toBe(
      expected("unit-secret-0123456789", "198.51.100.9"),
    );
  });

  it("AC-2: only the first value of a comma list is used", () => {
    vi.stubEnv("SESSION_SECRET", "unit-secret-0123456789");
    expect(getClientKey(req({ "x-vercel-forwarded-for": " 198.51.100.9 , 10.0.0.1" }))).toBe(
      expected("unit-secret-0123456789", "198.51.100.9"),
    );
  });

  it("AC-2 boundary: a value of 64 chars is accepted, 65 chars is junk and gives 'unknown'", () => {
    vi.stubEnv("SESSION_SECRET", "unit-secret-0123456789");
    const ok64 = "a".repeat(64);
    const bad65 = "a".repeat(65);
    expect(getClientKey(req({ "x-real-ip": ok64 }))).toBe(expected("unit-secret-0123456789", ok64));
    expect(getClientKey(req({ "x-real-ip": bad65 }))).toBe("unknown");
  });

  it("AC-2: an empty/blank header value gives 'unknown'; an unset secret still hashes", () => {
    expect(getClientKey(req({ "x-real-ip": "   " }))).toBe("unknown");
    vi.stubEnv("SESSION_SECRET", "");
    expect(getClientKey(req({ "x-real-ip": "203.0.113.7" }))).toMatch(/^[0-9a-f]{32}$/);
  });
});
