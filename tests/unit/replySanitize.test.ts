import { describe, expect, it } from "vitest";
import { sanitizeReply, SYSTEM_PROMPT } from "@/lib/chat/handleChat";

describe("AC-4: sanitizeReply", () => {
  it("AC-4: plain text passes unchanged (trimmed)", () => {
    expect(sanitizeReply("  We open at 8.  ")).toBe("We open at 8.");
  });

  it("AC-4: strips control characters but keeps tab and newline", () => {
    const raw = "a\u0000b\u0001c\u0007d\u001be\u007ff\u0085g\u009fh\ti\nj";
    expect(sanitizeReply(raw)).toBe("abcdefgh\ti\nj");
  });

  it("AC-4: returns an empty string when only control characters are left", () => {
    expect(sanitizeReply("\u0000\u0001\u0002")).toBe("");
    expect(sanitizeReply("   ")).toBe("");
  });

  it("AC-4 boundary: 1200 chars kept, 1201 capped to 1200", () => {
    expect(sanitizeReply("a".repeat(1200))).toHaveLength(1200);
    expect(sanitizeReply("a".repeat(1201))).toHaveLength(1200);
    expect(sanitizeReply("a".repeat(5000))).toHaveLength(1200);
  });

  it("AC-4: the cap never leaves half of a surrogate pair", () => {
    const out = sanitizeReply("a".repeat(1199) + "\u{1F600}" + "tail")!;
    expect(out).toBe("a".repeat(1199));
    expect(out).not.toMatch(/[\uD800-\uDBFF]$/);
    // a full pair that fits is kept
    expect(sanitizeReply("a".repeat(1198) + "\u{1F600}")).toBe("a".repeat(1198) + "\u{1F600}");
  });

  it.each([
    ["a Groq-style key", "Your key is " + "gsk" + "_abcdefghij1234567890" + " ok"],
    ["a Groq-style key of exactly 10 chars", "gsk" + "_ABCDEFGHIJ"],
    ["GROQ_API_KEY", "set GROQ_API_KEY to something"],
    ["SESSION_SECRET", "the SESSION_SECRET is here"],
    ["UPSTASH", "see UPSTASH_REDIS_REST_URL"],
    ["KV_REST_API", "KV_REST_API_TOKEN=abc"],
  ])("AC-4: %s -> null (unsafe)", (_label, text) => {
    expect(sanitizeReply(text)).toBeNull();
  });

  it("AC-4 negative: gsk_ with fewer than 10 chars is not a key pattern", () => {
    expect(sanitizeReply("gsk_short")).toBe("gsk_short");
  });

  it("AC-4: a secret hidden behind control characters is still caught", () => {
    expect(sanitizeReply("GROQ_\u0000API_KEY")).toBeNull();
  });

  it("AC-4: a verbatim run of >= 120 chars of the system prompt -> null; a 119-char run is allowed", () => {
    const run120 = SYSTEM_PROMPT.slice(10, 130);
    expect(run120).toHaveLength(120);
    expect(sanitizeReply(`Sure: ${run120}`)).toBeNull();
    expect(sanitizeReply(SYSTEM_PROMPT)).toBeNull();
    expect(sanitizeReply(SYSTEM_PROMPT.slice(10, 129))).not.toBeNull();
  });

  it("AC-4: a >= 120-char copy is caught in other case and with changed whitespace", () => {
    const run = SYSTEM_PROMPT.slice(0, 200);
    expect(sanitizeReply(run.toUpperCase())).toBeNull();
    expect(sanitizeReply(run.replace(/ /g, "   "))).toBeNull();
    expect(sanitizeReply(run.replace(/ /g, "\n"))).toBeNull();
    expect(sanitizeReply(run.toLowerCase().replace(/ /g, "\t "))).toBeNull();
  });

  it.each([
    ["scope refusal", "I can only help with this clinic's services, opening hours, booking, costs, preparation or aftercare."],
    ["medical refusal", "I can't give personal medical advice, diagnosis or treatment recommendations."],
    ["self description", "I'm the website assistant of Northwind Dental, a fictional demo dental clinic."],
  ])("AC-4 negative: a legitimate %s that reuses short prompt phrases is NOT flagged", (_l, text) => {
    expect(sanitizeReply(text)).toBe(text);
  });

  it("AC-4: invisible characters hiding a gsk_ key or an env name -> null", () => {
    expect(sanitizeReply("gsk_​abcdefghijkl")).toBeNull();
    expect(sanitizeReply("g‍s﻿k_abcdefghijkl")).toBeNull();
    expect(sanitizeReply("GROQ_‮API_KEY")).toBeNull();
    expect(sanitizeReply("SESSION_SECRET")).toBeNull();
    expect(sanitizeReply("UPS‏TASH")).toBeNull();
    expect(sanitizeReply("KV_REST⁦_API⁩")).toBeNull();
  });

  it.each(["groq_api_key", "Session_Secret", "upstash", "kv_rest_api_url"])(
    "AC-4: lowercase or mixed-case env name %s -> null",
    (name) => {
      expect(sanitizeReply(`value of ${name} is`)).toBeNull();
    },
  );

  it("AC-4: zero-width, bidi, BOM and line/paragraph separators are stripped from a normal reply", () => {
    const raw =
      "​We‌ open‍ at‎ 8‏.‪‫‬‭‮⁦⁧⁨⁩﻿";
    expect(sanitizeReply(raw)).toBe("We open at 8.");
  });

  it("AC-4: a reply with <script> is plain text, not escaped or removed (the client renders text)", () => {
    expect(sanitizeReply("<script>alert(1)</script> hello")).toBe("<script>alert(1)</script> hello");
  });
});
