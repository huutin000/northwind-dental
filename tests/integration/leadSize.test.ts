import { describe, expect, it, vi } from "vitest";

import { handleCreateLead } from "@/lib/leads/handleLead";
import { createMemoryLeadStore } from "@/lib/leads/store";
import { checkRateLimit, createMemoryCounterStore } from "@/lib/guard/rateLimit";
import type { ChatProvider, CompleteInput } from "@/lib/ai/provider";

const SHORTEN = "Please shorten your message and try again.";
const C0 = "\u0001"; // 6 bytes once JSON-escaped: the worst case for the byte cap
const history = [{ role: "user", content: "I want to book a cleaning" }];

function setup(reply?: string) {
  const counter = createMemoryCounterStore();
  const calls: CompleteInput[] = [];
  const provider: ChatProvider = {
    complete: async (i) => {
      calls.push(i);
      return reply ?? "not json";
    },
  };
  const store = createMemoryLeadStore();
  const add = vi.spyOn(store, "add");
  const limiter = vi.fn((k: string, o: { limit: number; windowSeconds: number }) => checkRateLimit(k, o, counter));
  return { provider, store, add, limiter, calls };
}
const create = (d: ReturnType<typeof setup>, body: unknown, sessionId = "size-session-1") =>
  handleCreateLead({ body, sessionId }, { provider: d.provider, store: d.store, limiter: d.limiter });

describe("lead size check before the limiter", () => {
  // Same measure as sanitizeLead: UTF-8 bytes of the JSON, field order of the draft.
  const size = (category: string, f: { email: string; name?: string; note?: string }) =>
    new TextEncoder().encode(
      JSON.stringify({ id: "x".repeat(36), createdAt: new Date(0).toISOString(), category, ...f }),
    ).length;
  // A note of control characters (6 bytes each) plus plain letters, so the "booking" draft is exactly `target` bytes.
  function noteFor(email: string, name: string, target: number): string {
    for (let c = 500; c >= 0; c--) {
      const a = target - size("booking", { email, name, note: C0.repeat(c) });
      if (a >= 0 && c + a <= 500) return C0.repeat(c) + "a".repeat(a);
    }
    throw new Error("no note fits");
  }
  const JP_EMAIL = "あ".repeat(248) + "@いい.うう"; // 254 characters, 758 bytes
  const NAME = C0.repeat(80);

  async function expectTooBig(d: ReturnType<typeof setup>, form: object, warn: ReturnType<typeof vi.spyOn>) {
    expect(await create(d, form)).toEqual({ status: 400, body: { error: SHORTEN } });
    expect(d.limiter).not.toHaveBeenCalled();
    expect(d.calls).toHaveLength(0);
    expect(d.add).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    for (let i = 0; i < 3; i++) expect((await create(d, { email: "visitor@clinic-mail.org" })).status).toBe(201);
  }

  it("real input: a Unicode email plus 80 + 500 control characters (about 4372 bytes) -> 400, no slot, nothing stored", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const form = { email: JP_EMAIL, name: NAME, note: C0.repeat(500), history };
    expect(size("other", form)).toBeGreaterThan(4096);
    await expectTooBig(setup(), form, warn);
  });

  it("the draft uses the longest category: 'other' would fit (4095), 'booking' does not (4097) -> 400, no slot", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const note = noteFor(JP_EMAIL, NAME, 4097);
    const form = { email: JP_EMAIL, name: NAME, note, history }; // history has "book"
    expect(size("other", { email: JP_EMAIL, name: NAME, note })).toBe(4095);
    expect(size("booking", { email: JP_EMAIL, name: NAME, note })).toBe(4097);
    await expectTooBig(setup(), form, warn);
  });

  it("boundary: the 'booking' draft is exactly 4096 bytes -> accepted (201) and saved as booking", async () => {
    const note = noteFor(JP_EMAIL, NAME, 4096);
    expect(size("booking", { email: JP_EMAIL, name: NAME, note })).toBe(4096);
    const d = setup();
    const r = await create(d, { email: JP_EMAIL, name: NAME, note, history });
    expect(r.status).toBe(201);
    expect(r.status === 201 && r.body.lead.category).toBe("booking");
    expect(d.add).toHaveBeenCalledTimes(1);
  });

  it("the largest ASCII-email form (500 + 80 control characters, 254-character email, about 3861 bytes) still fits and is saved", async () => {
    const d = setup();
    const email = "a".repeat(240) + "@bbbbbb.example".slice(0, 13);
    const r = await create(d, { email: email.slice(0, 254), name: C0.repeat(80), note: C0.repeat(500) });
    expect(r.status).toBe(201);
    expect(d.add).toHaveBeenCalledTimes(1);
  });
});

describe("summary that would push the lead over the cap", () => {
  it("is dropped; the lead is still saved (201)", async () => {
    const huge = JSON.stringify({ category: "pricing", summary: C0.repeat(400) });
    const d = setup(huge);
    const r = await create(d, { email: "a".repeat(240) + "@bbbbbb.exam", name: C0.repeat(80), note: C0.repeat(500), history });
    expect(r.status).toBe(201);
    if (r.status !== 201) return;
    expect(r.body.lead.summary).toBeUndefined();
    expect(r.body.lead.category).toBe("pricing"); // the category is kept
    expect(await d.store.list("size-session-1")).toHaveLength(1);
  });

  it("a normal summary is kept", async () => {
    const d = setup(JSON.stringify({ category: "booking", summary: "Wants a cleaning." }));
    const r = await create(d, { email: "visitor@clinic-mail.org", history });
    expect(r.status === 201 && r.body.lead.summary).toBe("Wants a cleaning.");
  });
});
