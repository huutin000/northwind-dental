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

describe("redactPII: disguised separators and look-alike characters", () => {
  it.each([
    ["NBSP", "0912\u00a0345\u00a0678"],
    ["narrow NBSP", "0912\u202f345\u202f678"],
    ["en dash", "0912–345–678"],
    ["spaced dashes", "0912 - 345 - 678"],
    ["tab", "0912\t345\t678"],
    ["full-width digits", "\uff10\uff19\uff11\uff12\uff13\uff14\uff15\uff16\uff17\uff18"],
    ["zero-width space", "0912\u200b345678"],
    ["soft hyphen", "0912\u00ad345\u00ad678"],
  ])("redacts a phone written with %s", (_name, input) => {
    const out = redactPII(input);
    expect(out).toBe("[phone]");
    expect(out).not.toMatch(/\d/);
  });

  it("redacts a full-width @ email", () => {
    expect(redactPII("an\uff20x.vn")).toBe("[email]");
  });

  it("redacts exactly 9 digits and leaves exactly 8 digits alone", () => {
    expect(redactPII("123456789")).toBe("[phone]");
    expect(redactPII("12345678")).toBe("12345678");
    expect(redactPII("2026-11-09")).toBe("2026-11-09");
  });

  it("does not merge digits that sit on separate lines", () => {
    expect(redactPII("0912\n345\n678")).toBe("0912\n345\n678");
  });
});

describe("redactPII: ordinary text is returned unchanged", () => {
  it.each([
    "Do you open on Saturday?",
    "Phòng khám mở cửa lúc mấy giờ?".normalize("NFC"),
    "I want 3 teeth cleaned in 2026",
    "Café, naïve, 😀 and 'quotes' stay as they are.",
  ])("%j", (input) => {
    expect(redactPII(input)).toBe(input);
  });

  it("is idempotent on disguised input too", () => {
    const x = "0912\u00a0345\u00a0678 an\uff20x.vn 0912\u200b345678";
    expect(redactPII(redactPII(x))).toBe(redactPII(x));
  });
});

// KNOWN LIMITATIONS, pinned on purpose: this is the CURRENT behaviour, not the
// wanted one. A change here should be a conscious decision.
describe("redactPII: known limitations (pinned current behaviour)", () => {
  it("over-redacts dates and times that have 9 or more digits", () => {
    expect(redactPII("Can I come 2026-11-09 10:30?")).toBe("Can I come [phone]:30?");
  });

  it("over-redacts amount ranges", () => {
    expect(redactPII("1.000.000-2.000.000 VND")).toBe("[phone] VND");
  });

  it("redacts a 9+ digit run inside a longer ID", () => {
    expect(redactPII("order ID 1234567890123")).toBe("order ID [phone]");
  });

  it("leaves the first characters of an email local part longer than 64 characters", () => {
    expect(redactPII(`${"a".repeat(70)}@x.co`)).toBe(`${"a".repeat(6)}[email]`);
  });

  it("strips zero-width characters from the whole text", () => {
    expect(redactPII("a\u200bb")).toBe("ab");
  });

  it("applies NFKC to the whole text", () => {
    expect(redactPII("\uff21\uff22")).toBe("AB");
  });

  it("lets NFKC rewrite fractions (1 + one half becomes 11, fraction slash, 2)", () => {
    expect(redactPII("1\u00bd hours")).toBe("11\u20442 hours");
  });

  it("does not redact digits from other scripts (Arabic-Indic digits)", () => {
    const digits = "\u0660\u0669\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668";
    expect(redactPII(digits)).toBe(digits);
  });

  it("does not catch an email with an ideographic full stop", () => {
    expect(redactPII("an@gmail\u3002com")).toBe("an@gmail\u3002com");
  });
});

describe("redactPII: emails with letters outside ASCII", () => {
  it.each([
    "nguyễn@x.vn",
    "trần.văn@gmail.com",
    "müller@beispiel.de",
    "müller@bücher.de",
  ])("redacts %s completely", (email) => {
    expect(redactPII(email)).toBe("[email]");
  });

  it("redacts one inside a sentence", () => {
    expect(redactPII("write to müller@bücher.de please")).toBe("write to [email] please");
  });

  it("redacts two in one string", () => {
    expect(redactPII("trần@x.vn and müller@bücher.de")).toBe("[email] and [email]");
  });

  it("redacts a decomposed (NFD) address", () => {
    const nfd = "nguyễn@x.vn".normalize("NFD");
    expect(nfd).not.toBe("nguyễn@x.vn");
    expect(redactPII(nfd)).toBe("[email]");
  });

  it("redacts a local part made of base letters plus combining marks", () => {
    // Devanagari "hi" = letter + vowel sign (a combining mark, no precomposed form).
    expect(redactPII("हि@x.in")).toBe("[email]");
  });

  it("still redacts the ASCII forms", () => {
    expect(redactPII("a.b+c@x.co")).toBe("[email]");
  });
});

describe("redactPII: invisible format characters inside a number", () => {
  it.each([
    ["LRM", "\u200e"],
    ["RLM", "\u200f"],
    ["bidi embedding (U+202A)", "\u202a"],
    ["bidi override end (U+202E)", "\u202e"],
    ["bidi isolate (U+2066)", "\u2066"],
    ["pop isolate (U+2069)", "\u2069"],
    ["function application (U+2061)", "\u2061"],
    ["invisible plus (U+2064)", "\u2064"],
    ["Arabic letter mark (U+061C)", "\u061c"],
    ["Mongolian vowel separator (U+180E)", "\u180e"],
  ])("redacts a phone split by %s", (_name, ch) => {
    expect(redactPII(`0912${ch}345${ch}678`)).toBe("[phone]");
  });
});

describe("redactPII: adversarial timing (50,000 characters)", () => {
  it.each([
    ["near-miss groups", "12345678 ".repeat(5_556)],
    ["single digits and spaces", "1 ".repeat(25_000)],
    ["zero-width characters", "\u200b".repeat(50_000)],
    ["digits split by long gaps", "1    ".repeat(10_000)],
    ["8 digits then a letter, repeated", "12345678a".repeat(5_556)],
    ["7-digit groups", "1234567 ".repeat(6_250)],
    ["bidi controls", "\u202e".repeat(50_000)],
    ["Unicode letters then @", "\u00f1".repeat(50_000) + "@"],
    ["Unicode letters, no @", "\u00f1".repeat(50_000)],
    ["repeated a@", "a@".repeat(25_000)],
    ["repeated a@b (no dot)", "a@b".repeat(16_000)],
    ["dot-heavy local part", "a.".repeat(25_000) + "@x"],
    ["very long domain", "x@" + "b".repeat(50_000) + ".com"],
  ])("finishes quickly on %s", (_name, input) => {
    const start = performance.now();
    redactPII(input);
    expect(performance.now() - start).toBeLessThan(500);
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
