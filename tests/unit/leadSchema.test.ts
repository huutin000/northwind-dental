import { describe, expect, it } from "vitest";
import { parseLeadInput } from "@/lib/leads/schema";

const base = { email: "ada@example.com" };
const parse = (extra: Record<string, unknown> = {}) => parseLeadInput({ ...base, ...extra });

function okValue(r: ReturnType<typeof parseLeadInput>) {
  if (!r.ok) throw new Error(`expected ok, got error: ${r.error}`);
  return r.value;
}
function errorOf(r: ReturnType<typeof parseLeadInput>) {
  if (r.ok) throw new Error("expected an error");
  return r.error;
}

const emailOfLength = (n: number) => `${"a".repeat(n - "@example.com".length)}@example.com`;

describe("parseLeadInput: email", () => {
  it("accepts a normal email and trims it; history defaults to []", () => {
    expect(okValue(parseLeadInput({ email: "  ada@example.com  " }))).toEqual({
      email: "ada@example.com",
      name: undefined,
      note: undefined,
      history: [],
    });
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["blank", "   "],
    ["not a string", 42],
    ["no @", "ada.example.com"],
    ["two @", "a@b@example.com"],
    ["no local part", "@example.com"],
    ["no domain", "ada@"],
    ["no dot in domain", "ada@localhost"],
    ["space inside", "ada lovelace@example.com"],
    ["domain starts with a dot", "ada@.example.com"],
    ["domain ends with a dot", "ada@example."],
    ["double dot in domain", "ada@exa..mple.com"],
    ["local part starts with a dot", ".ada@example.com"],
    ["line break", "ada@example.com\nBcc: x@y.com"],
    ["angle brackets", "<ada@example.com>"],
  ])("rejects an invalid email: %s", (_label, email) => {
    const r = parseLeadInput({ email });
    expect(r.ok).toBe(false);
  });

  it("accepts 254 characters and rejects 255", () => {
    expect(parse({ email: emailOfLength(254) }).ok).toBe(true);
    expect(parse({ email: emailOfLength(255) }).ok).toBe(false);
  });

  it("accepts Unicode letters in the local part and the domain", () => {
    expect(okValue(parse({ email: "josé.müller@bücher.example" })).email).toBe("josé.müller@bücher.example");
    expect(parse({ email: "用户@例子.广告" }).ok).toBe(true);
  });

  it("the error text is friendly and never echoes the input", () => {
    const bad = "not-an-email-SECRETVALUE";
    const msg = errorOf(parseLeadInput({ email: bad }));
    expect(msg).not.toContain("SECRETVALUE");
    expect(msg).toMatch(/email/i);
  });
});

describe("parseLeadInput: name and note", () => {
  it("name: 80 characters ok, 81 rejected", () => {
    expect(okValue(parse({ name: "n".repeat(80) })).name).toBe("n".repeat(80));
    expect(parse({ name: "n".repeat(81) }).ok).toBe(false);
  });

  it("note: 500 characters ok, 501 rejected", () => {
    expect(okValue(parse({ note: "x".repeat(500) })).note).toBe("x".repeat(500));
    expect(parse({ note: "x".repeat(501) }).ok).toBe(false);
  });

  it("name and note are trimmed; empty after trimming becomes undefined", () => {
    const v = okValue(parse({ name: "  Ada  ", note: "  hello  " }));
    expect(v.name).toBe("Ada");
    expect(v.note).toBe("hello");
    const e = okValue(parse({ name: "   ", note: "" }));
    expect(e.name).toBeUndefined();
    expect(e.note).toBeUndefined();
  });

  it("the length limit applies after trimming", () => {
    expect(parse({ name: ` ${"n".repeat(80)} ` }).ok).toBe(true);
  });

  it("a name with a line break is rejected; a note may have line breaks", () => {
    expect(parse({ name: "Ada\nLovelace" }).ok).toBe(false);
    expect(parse({ name: "Ada\rLovelace" }).ok).toBe(false);
    expect(okValue(parse({ note: "line one\nline two" })).note).toBe("line one\nline two");
  });

  it("non-string name or note is rejected", () => {
    expect(parse({ name: 5 }).ok).toBe(false);
    expect(parse({ note: {} }).ok).toBe(false);
    expect(parse({ name: null }).ok).toBe(false);
  });
});

describe("parseLeadInput: honeypot", () => {
  it("a filled website field is rejected with a generic error", () => {
    const msg = errorOf(parse({ website: "http://spam.example" }));
    expect(msg).not.toMatch(/honeypot|bot|spam|website/i);
    expect(msg).not.toContain("spam.example");
  });

  it("an empty or blank website field is fine", () => {
    expect(parse({ website: "" }).ok).toBe(true);
    expect(parse({ website: "   " }).ok).toBe(true);
    expect(parse({}).ok).toBe(true);
  });

  it("a non-string website value is rejected too", () => {
    expect(parse({ website: 1 }).ok).toBe(false);
    expect(parse({ website: ["x"] }).ok).toBe(false);
  });
});

describe("parseLeadInput: history", () => {
  const msg = (i: number) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` });

  it("6 items ok (copied as {role, content} only), 7 rejected", () => {
    const six = Array.from({ length: 6 }, (_, i) => msg(i));
    expect(okValue(parse({ history: six })).history).toEqual(six);
    expect(parse({ history: [...six, msg(6)] }).ok).toBe(false);
  });

  it("empty array is fine; extra fields on items are dropped", () => {
    expect(okValue(parse({ history: [] })).history).toEqual([]);
    const v = okValue(parse({ history: [{ role: "user", content: "hi", extra: "x" }] }));
    expect(v.history).toEqual([{ role: "user", content: "hi" }]);
  });

  it("role must be exactly user or assistant", () => {
    expect(parse({ history: [{ role: "system", content: "x" }] }).ok).toBe(false);
    expect(parse({ history: [{ role: "User", content: "x" }] }).ok).toBe(false);
    expect(parse({ history: [{ content: "x" }] }).ok).toBe(false);
  });

  it("content must be a string of at most 2000 characters", () => {
    expect(parse({ history: [{ role: "user", content: 5 }] }).ok).toBe(false);
    expect(parse({ history: [{ role: "user", content: "x".repeat(2000) }] }).ok).toBe(true);
    expect(parse({ history: [{ role: "user", content: "x".repeat(2001) }] }).ok).toBe(false);
  });

  it("history must be an array of plain objects", () => {
    expect(parse({ history: "hi" }).ok).toBe(false);
    expect(parse({ history: {} }).ok).toBe(false);
    expect(parse({ history: ["x"] }).ok).toBe(false);
    expect(parse({ history: [null] }).ok).toBe(false);
    expect(parse({ history: [[]] }).ok).toBe(false);
  });
});

describe("parseLeadInput: the raw value", () => {
  it.each([["null", null], ["array", [base]], ["string", "ada@example.com"], ["number", 1], ["undefined", undefined]])(
    "rejects a non-object: %s",
    (_label, raw) => {
      expect(parseLeadInput(raw).ok).toBe(false);
    },
  );

  it("rejects a class instance (not a plain object)", () => {
    expect(parseLeadInput(new Map([["email", "ada@example.com"]])).ok).toBe(false);
  });

  it("accepts an object created by JSON.parse, including a null-prototype one", () => {
    expect(parseLeadInput(JSON.parse('{"email":"ada@example.com"}')).ok).toBe(true);
    expect(parseLeadInput(Object.assign(Object.create(null), base)).ok).toBe(true);
  });
});
