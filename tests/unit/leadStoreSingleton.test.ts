import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "@/lib/leads/schema";

// Next's production build can evaluate lib/leads/store.ts twice (route handler chunk and
// server-component chunk). The default memory store must be shared by all copies.
const SESSION = "0123456789abcdef0123456789abcdef";
const lead: Lead = {
  id: "lead-id-0001",
  createdAt: "2026-11-10T10:00:00.000Z",
  email: "ada@example.com",
  category: "other",
};

beforeEach(async () => {
  const mod = await import("@/lib/leads/store");
  mod.resetDefaultMemoryLeadStore();
});
afterEach(async () => {
  const mod = await import("@/lib/leads/store");
  mod.resetDefaultMemoryLeadStore();
  vi.resetModules();
});

describe("default memory lead store", () => {
  it("is shared by two separately evaluated copies of the module", async () => {
    vi.resetModules();
    const a = await import("@/lib/leads/store");
    vi.resetModules();
    const b = await import("@/lib/leads/store");
    expect(a).not.toBe(b); // really two module instances

    await a.getLeadStore().add(SESSION, lead);
    expect(await b.getLeadStore().list(SESSION)).toEqual([lead]);
  });

  it("returns the same store on every call", async () => {
    const { getLeadStore } = await import("@/lib/leads/store");
    expect(getLeadStore()).toBe(getLeadStore());
  });

  it("can be reset for tests", async () => {
    const { getLeadStore, resetDefaultMemoryLeadStore } = await import("@/lib/leads/store");
    await getLeadStore().add(SESSION, lead);
    resetDefaultMemoryLeadStore();
    expect(await getLeadStore().list(SESSION)).toEqual([]);
  });
});
