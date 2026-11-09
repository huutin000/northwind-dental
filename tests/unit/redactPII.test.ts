import { describe, expect, it } from "vitest";
import { redactPII } from "@/lib/guard/redactPII";

describe("redactPII: emails", () => {
  it("replaces an email with [email]", () => {
    expect(redactPII("mail me at a.b+c@x.co please")).toBe(
      "mail me at [email] please",
    );
  });

  it("redacts an email inside a multi-line string and keeps the rest", () => {
    expect(redactPII("line one\nwrite to a@b.com\nline three")).toBe(
      "line one\nwrite to [email]\nline three",
    );
  });

  it("redacts an email next to Vietnamese diacritics and keeps the rest", () => {
    expect(redactPII("Xin chào, email của tôi là nguyen@x.vn nhé")).toBe(
      "Xin chào, email của tôi là [email] nhé",
    );
  });

  it("redacts two emails in one string", () => {
    expect(redactPII("a@x.co and b@y.org")).toBe("[email] and [email]");
  });

  // Known limitation: deliberately disguised emails are NOT caught.
  it("does NOT catch a disguised email (documented limitation)", () => {
    expect(redactPII("john at gmail dot com")).toBe("john at gmail dot com");
  });
});

describe("redactPII: phone numbers", () => {
  it.each([
    ["call +84 912 345 678", ["84", "912", "345", "678"]],
    ["0912.345.678", ["0912", "345", "678"]],
    ["(555) 123-4567", ["555", "123", "4567"]],
    ["+1-555-123-4567", ["555", "123", "4567"]],
    ["+84912345678", ["84912345678"]],
    ["0912 345 678", ["0912", "345", "678"]],
  ])("redacts %j", (input, digitGroups) => {
    const out = redactPII(input);
    expect(out).toContain("[phone]");
    for (const group of digitGroups) {
      expect(out).not.toContain(group);
    }
  });

  it("redacts two phone numbers in one string", () => {
    expect(redactPII("0912 345 678 or (555) 123-4567")).toBe(
      "[phone] or [phone]",
    );
  });
});

describe("redactPII: text that must stay unchanged", () => {
  it.each([
    "I want 3 teeth cleaned in 2026",
    "2026-11-09",
    "",
    "Do you open on Saturday?",
  ])("returns %j unchanged", (input) => {
    expect(redactPII(input)).toBe(input);
  });

  it("handles a mix of everything", () => {
    expect(
      redactPII("Hi, I'm An. Email an@x.vn or call 0912 345 678 about 2 fillings."),
    ).toBe("Hi, I'm An. Email [email] or call [phone] about 2 fillings.");
  });
});

describe("redactPII: properties", () => {
  it("is idempotent", () => {
    const x = "a@x.co, +84 912 345 678 and 3 teeth";
    expect(redactPII(redactPII(x))).toBe(redactPII(x));
  });

  it("finishes quickly on adversarial input (no catastrophic backtracking)", () => {
    const digitsAndSeparators = "1 ".repeat(25_000); // 50,000 chars
    const manyAs = "a".repeat(50_000) + "@";
    for (const input of [digitsAndSeparators, manyAs]) {
      const start = performance.now();
      redactPII(input);
      expect(performance.now() - start).toBeLessThan(500);
    }
  });
});
