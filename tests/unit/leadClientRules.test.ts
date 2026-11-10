import { describe, expect, it } from "vitest";
import { errorField, validateLeadForm } from "@/lib/leads/clientRules";
import { LEAD_ERRORS, MAX_EMAIL, MAX_NAME, MAX_NOTE } from "@/lib/leads/schema";

const emailOfLength = (n: number) => `${"a".repeat(n - "@example.com".length)}@example.com`;
const ok = { email: "ada@example.com", name: "", note: "" };

describe("validateLeadForm", () => {
  it("accepts an email alone (name and note optional, empty strings)", () => {
    expect(validateLeadForm(ok)).toEqual({ ok: true });
  });

  it("rejects an empty or whitespace-only email on the email field", () => {
    for (const email of ["", "   ", "\t"]) {
      const r = validateLeadForm({ ...ok, email });
      expect(r).toEqual({ ok: false, errors: { email: LEAD_ERRORS.email } });
    }
  });

  it("rejects a malformed email", () => {
    for (const email of ["ada", "ada@", "@example.com", "a b@example.com", "ada@example"]) {
      expect(validateLeadForm({ ...ok, email })).toEqual({ ok: false, errors: { email: LEAD_ERRORS.email } });
    }
  });

  it("email boundary: 254 passes, 255 fails", () => {
    expect(validateLeadForm({ ...ok, email: emailOfLength(MAX_EMAIL) })).toEqual({ ok: true });
    expect(validateLeadForm({ ...ok, email: emailOfLength(MAX_EMAIL + 1) }).ok).toBe(false);
  });

  it("name boundary: 80 passes, 81 fails on the name field", () => {
    expect(validateLeadForm({ ...ok, name: "n".repeat(MAX_NAME) })).toEqual({ ok: true });
    expect(validateLeadForm({ ...ok, name: "n".repeat(MAX_NAME + 1) })).toEqual({
      ok: false,
      errors: { name: LEAD_ERRORS.name },
    });
  });

  it("note boundary: 500 passes, 501 fails on the note field", () => {
    expect(validateLeadForm({ ...ok, note: "n".repeat(MAX_NOTE) })).toEqual({ ok: true });
    expect(validateLeadForm({ ...ok, note: "n".repeat(MAX_NOTE + 1) })).toEqual({
      ok: false,
      errors: { note: LEAD_ERRORS.note },
    });
  });

  it("a name with a line break fails on the name field", () => {
    expect(validateLeadForm({ ...ok, name: "a\nb" })).toEqual({ ok: false, errors: { name: LEAD_ERRORS.name } });
  });

  it("returns the first failing field only (schema order: email, name, note)", () => {
    const r = validateLeadForm({ email: "x", name: "n".repeat(81), note: "n".repeat(501) });
    expect(r).toEqual({ ok: false, errors: { email: LEAD_ERRORS.email } });
  });

  it("a honeypot value is never a client error (the client does not even read it)", () => {
    const r = validateLeadForm({ ...ok, website: "http://bot.example" } as never);
    expect(r).toEqual({ ok: true });
  });
});

describe("errorField", () => {
  it("maps each known schema message to its field", () => {
    expect(errorField(LEAD_ERRORS.email)).toBe("email");
    expect(errorField(LEAD_ERRORS.name)).toBe("name");
    expect(errorField(LEAD_ERRORS.note)).toBe("note");
  });
  it("returns null for anything else", () => {
    expect(errorField(LEAD_ERRORS.generic)).toBeNull();
    expect(errorField(LEAD_ERRORS.tooBig)).toBeNull();
    expect(errorField("constructor")).toBeNull();
    expect(errorField(undefined)).toBeNull();
  });
});
