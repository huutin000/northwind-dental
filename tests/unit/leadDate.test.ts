import { describe, expect, it } from "vitest";
import { formatLeadDate } from "@/lib/leads/formatDate";

describe("formatLeadDate", () => {
  it("formats an ISO timestamp in UTC", () => {
    expect(formatLeadDate("2026-11-10T14:05:09.000Z")).toBe("10 Nov 2026, 14:05 UTC");
    expect(formatLeadDate("2026-01-02T00:00:00.000Z")).toBe("2 Jan 2026, 00:00 UTC");
  });

  it("converts an offset to UTC", () => {
    expect(formatLeadDate("2026-11-10T23:30:00+02:00")).toBe("10 Nov 2026, 21:30 UTC");
  });

  it("returns null for malformed or non-ISO values and never throws", () => {
    const bad: unknown[] = [
      "1",
      "2026",
      "March 7",
      "",
      "not a date",
      "2026-13-45T00:00:00.000Z",
      "2026-02-30T00:00:00.000Z",
      "x".repeat(10_000),
      undefined,
      null,
      42,
      {},
      [],
    ];
    for (const v of bad) {
      expect(() => formatLeadDate(v)).not.toThrow();
      expect(formatLeadDate(v)).toBeNull();
    }
  });

  it("does not echo hostile text", () => {
    expect(formatLeadDate("<script>alert(1)</script>")).toBeNull();
  });
});
