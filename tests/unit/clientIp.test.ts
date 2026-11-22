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

  it("AC-2: x-vercel-forwarded-for wins over x-real-ip; x-real-ip alone is used when it is the only header", () => {
    vi.stubEnv("SESSION_SECRET", "unit-secret-0123456789");
    const vercel = getClientKey(req({ "x-real-ip": "203.0.113.7", "x-vercel-forwarded-for": "198.51.100.9" }));
    expect(vercel).toBe(expected("unit-secret-0123456789", "198.51.100.9"));
    expect(getClientKey(req({ "x-real-ip": "203.0.113.7" }))).toBe(expected("unit-secret-0123456789", "203.0.113.7"));
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

  it("AC-2 boundary: 64 and 65 chars of junk both give 'unknown'; long valid addresses are accepted", () => {
    vi.stubEnv("SESSION_SECRET", "unit-secret-0123456789");
    expect(getClientKey(req({ "x-real-ip": "a".repeat(64) }))).toBe("unknown");
    expect(getClientKey(req({ "x-real-ip": "a".repeat(65) }))).toBe("unknown");
    const long39 = "2001:0db8:0000:0000:0000:ff00:0042:8329";
    const long45 = "ffff:ffff:ffff:ffff:ffff:ffff:255.255.255.255";
    expect(long39).toHaveLength(39);
    expect(long45).toHaveLength(45);
    expect(getClientKey(req({ "x-real-ip": long39 }))).toMatch(/^[0-9a-f]{32}$/);
    expect(getClientKey(req({ "x-real-ip": long45 }))).toMatch(/^[0-9a-f]{32}$/);
  });

  it("AC-2: an empty/blank header value gives 'unknown'; an unset secret still hashes", () => {
    expect(getClientKey(req({ "x-real-ip": "   " }))).toBe("unknown");
    vi.stubEnv("SESSION_SECRET", "");
    expect(getClientKey(req({ "x-real-ip": "203.0.113.7" }))).toMatch(/^[0-9a-f]{32}$/);
  });
});

const SECRET = "unit-secret-0123456789";
const key = (value: string, header = "x-vercel-forwarded-for") => getClientKey(req({ [header]: value }));
const HEX32 = /^[0-9a-f]{32}$/;

describe("AC-a: only a valid IP is accepted, junk gives 'unknown'", () => {
  const junk = [
    "abc",
    "999.1.1.1",
    "1.2.3",
    "1.2.3.4.5",
    "::g",
    "1::2::3",
    "1.2.3.4:80",
    "[::1]:80",
    "[1.2.3.4]",
    "1.2.3.4%eth0",
    "x".repeat(64),
    "x".repeat(65),
    "2001:db8::1%" + "z".repeat(60),
    "01.2.3.4",
    "001.2.3.4",
    "1.2.3.4.",
    "0x7f.0.0.1",
    "0177.0.0.1",
    "127.1",
    "::ffff:01.2.3.4",
    "1.2.3.04",
  ];
  it.each(junk)("AC-a: %j -> unknown (in either header)", (value) => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    expect(key(value, "x-vercel-forwarded-for")).toBe("unknown");
    expect(key(value, "x-real-ip")).toBe("unknown");
  });

  it("AC-a: non-ASCII digits cannot even be sent as a header value (the Headers API rejects them)", () => {
    expect(() => req({ "x-real-ip": "１.2.3.4" })).toThrow();
  });

  it("AC-a: empty and whitespace-only values -> unknown", () => {
    expect(key("")).toBe("unknown");
    expect(key("   ")).toBe("unknown");
    expect(key(" , 1.2.3.4")).toBe("unknown"); // first comma item is blank, the rest does not count
  });
});

describe("AC-b: IPv4 hashing is unchanged", () => {
  it("AC-b: pinned regression value (old formula sha256(secret + ip)[0..32])", () => {
    expect(expected("test-secret", "203.0.113.7")).toBe("208c630672d0e09ecc7062777f8e54b7");
    vi.stubEnv("SESSION_SECRET", "test-secret");
    expect(key("203.0.113.7")).toBe("208c630672d0e09ecc7062777f8e54b7");
    expect(key("203.0.113.7", "x-real-ip")).toBe("208c630672d0e09ecc7062777f8e54b7");
  });
});

describe("AC-c: IPv6 is reduced to its /64", () => {
  it("AC-c: two addresses in the same /64 share a key; another /64 differs", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const a = key("2001:db8:1:2::1");
    expect(key("2001:db8:1:2:ffff:ffff:ffff:ffff")).toBe(a);
    expect(key("2001:db8:1:2:abcd::9")).toBe(a);
    expect(key("2001:db8:1:3::1")).not.toBe(a); // 4th group differs: last bit of the /64
    expect(key("2001:db8:2:2::1")).not.toBe(a);
    expect(key("3001:db8:1:2::1")).not.toBe(a); // first group differs
  });

  it("AC-c: compressed vs full form, upper vs lower case, leading zeros give one key", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const base = key("2001:db8::1");
    expect(key("2001:0db8:0:0:0:0:0:1")).toBe(base);
    expect(key("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe(base);
    expect(key("2001:DB8::1")).toBe(base);
    expect(key("2001:Db8:0:0::1")).toBe(base);
  });

  it("AC-c: brackets and a zone id are stripped (IPv6 only)", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const base = key("2001:db8::1");
    expect(key("[2001:db8::1]")).toBe(base);
    expect(key("2001:db8::1%eth0")).toBe(base);
    expect(key("[2001:db8::1%eth0]")).toBe(base);
    expect(key("fe80::1%25eth0")).toBe(key("fe80::2")); // zone cut at the first %
  });

  it("AC-c: the key is 32 hex chars, pinned to the v6/<4 groups> string, and never holds the raw address", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const k = key("2001:db8:1:2:3:4:5:6");
    expect(k).toMatch(HEX32);
    expect(k).toBe(expected(SECRET, "v6/2001:0db8:0001:0002"));
    expect(k).not.toContain("2001");
    expect(k).not.toContain("db8");
  });

  it("AC-c: ::1 works (a /64 of zeros) and differs from a normal address and from IPv4 forms", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const loop = key("::1");
    expect(loop).toMatch(HEX32);
    expect(loop).toBe(expected(SECRET, "v6/0000:0000:0000:0000"));
    expect(loop).toBe(key("::2"));
    expect(loop).not.toBe(key("2001:db8::1"));
    expect(loop).not.toBe(key("0.0.0.1"));
  });
});

describe("AC-d: IPv4-mapped IPv6 counts as the plain IPv4", () => {
  it("AC-d: ::ffff:1.2.3.4, ::ffff:102:304 and ::FFFF:1.2.3.4 equal 1.2.3.4", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const plain = key("1.2.3.4");
    expect(plain).toBe(expected(SECRET, "1.2.3.4"));
    expect(key("::ffff:1.2.3.4")).toBe(plain);
    expect(key("::ffff:102:304")).toBe(plain);
    expect(key("::FFFF:1.2.3.4")).toBe(plain);
    expect(key("0:0:0:0:0:ffff:0102:0304")).toBe(plain);
    expect(key("[::ffff:1.2.3.4]")).toBe(plain);
    expect(key("::ffff:1.2.3.5")).not.toBe(plain);
  });

  it("AC-d: ::1.2.3.4 and ::ffff:0:1.2.3.4 are NOT mapped", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const plain = key("1.2.3.4");
    expect(key("::1.2.3.4")).not.toBe(plain);
    expect(key("::ffff:0:1.2.3.4")).not.toBe(plain);
    expect(key("::1.2.3.4")).toMatch(HEX32);
    expect(key("::ffff:0:1.2.3.4")).toMatch(HEX32);
  });
});

describe("AC-e: header order and spoofing", () => {
  it("AC-e: a present-but-junk first header gives 'unknown' even when the second is valid", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    expect(getClientKey(req({ "x-vercel-forwarded-for": "not-an-ip", "x-real-ip": "203.0.113.7" }))).toBe("unknown");
  });

  it("AC-e: a blank first header falls through to the second", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    expect(getClientKey(req({ "x-vercel-forwarded-for": "   ", "x-real-ip": "203.0.113.7" }))).toBe(
      expected(SECRET, "203.0.113.7"),
    );
  });

  it("AC-e: a first header longer than 64 chars gives 'unknown' and the second header is not consulted", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    expect(getClientKey(req({ "x-vercel-forwarded-for": "x".repeat(65), "x-real-ip": "203.0.113.7" }))).toBe("unknown");
    expect(getClientKey(req({ "x-vercel-forwarded-for": "2001:db8::" + "0".repeat(60) + "1", "x-real-ip": "203.0.113.7" }))).toBe("unknown");
  });

  it("AC-e: a blank first comma item gives 'unknown' (second header not consulted); a whitespace-only header is skipped", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    expect(getClientKey(req({ "x-vercel-forwarded-for": " , 1.2.3.4", "x-real-ip": "203.0.113.7" }))).toBe("unknown");
    expect(getClientKey(req({ "x-vercel-forwarded-for": ",1.2.3.4", "x-real-ip": "203.0.113.7" }))).toBe("unknown");
    expect(getClientKey(req({ "x-vercel-forwarded-for": "   ", "x-real-ip": "203.0.113.7" }))).toBe(
      expected(SECRET, "203.0.113.7"),
    );
  });

  it("AC-e: a valid first header is used even when the second is junk", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    expect(getClientKey(req({ "x-vercel-forwarded-for": "203.0.113.7", "x-real-ip": "junk" }))).toBe(
      expected(SECRET, "203.0.113.7"),
    );
  });

  it("AC-e: x-forwarded-for alone -> unknown; it never changes the key (IPv4 and IPv6 values)", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    expect(getClientKey(req({ "x-forwarded-for": "2001:db8::1" }))).toBe("unknown");
    for (const [header, ip] of [
      ["x-vercel-forwarded-for", "203.0.113.7"],
      ["x-real-ip", "203.0.113.7"],
      ["x-vercel-forwarded-for", "2001:db8:5::1"],
      ["x-real-ip", "2001:db8:5::1"],
    ] as const) {
      const base = key(ip, header);
      expect(getClientKey(req({ [header]: ip, "x-forwarded-for": "9.9.9.9" }))).toBe(base);
      expect(getClientKey(req({ [header]: ip, "x-forwarded-for": "2001:db8:6::1, 8.8.8.8" }))).toBe(base);
    }
  });

  it("AC-e: only the first comma item counts, also for IPv6 lists", () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    expect(key("2001:db8:7::1, 2001:db8:8::1, 10.0.0.1")).toBe(key("2001:db8:7::9"));
    expect(key("2001:db8:7::1,2001:db8:8::1")).not.toBe(key("2001:db8:8::1"));
    expect(key("junk, 203.0.113.7")).toBe("unknown");
    expect(key("203.0.113.7, junk")).toBe(expected(SECRET, "203.0.113.7"));
  });
});
