import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleCreateLead, handleListLeads, resetLeadLogThrottle } from "@/lib/leads/handleLead";
import { createMemoryLeadStore, type LeadStore } from "@/lib/leads/store";
import { KvError } from "@/lib/kv/upstash";

const URL_ = "https://secret-host.invalid";
const TOKEN = "tok-very-secret-123";
const EMAIL = "visitor@clinic-mail.org";
const body = { email: EMAIL, name: "Zed Quill", note: "Ring me after lunch", history: [{ role: "user", content: "book please" }] };
const allow = async () => ({ allowed: true, retryAfterSeconds: 0 });

const failing = (err: unknown): LeadStore => ({
  add: async () => {
    throw err;
  },
  list: async () => {
    throw err;
  },
  count: async () => 0,
});
const create = (store: LeadStore) => handleCreateLead({ body, sessionId: "log-session-1" }, { provider: null, store, limiter: allow });

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  resetLeadLogThrottle();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("lead store failure log", () => {
  it.each([
    [new KvError("config", "kv misconfigured"), "config"],
    [new KvError("timeout", "kv timeout"), "timeout"],
    [new KvError("upstream", "kv http 500"), "upstream"],
    [new Error("boom"), "unexpected"],
    ["a string", "unexpected"],
  ])("add failure %# logs exactly the fixed line", async (err, kind) => {
    expect((await create(failing(err))).status).toBe(503);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(`[kv] lead store failure: ${kind}`);
  });

  it("list failure logs the same format and still returns an empty list", async () => {
    const r = await handleListLeads("log-session-1", { store: failing(new KvError("timeout", "kv timeout")) });
    expect(r).toEqual({ status: 200, body: { leads: [] } });
    expect(warn).toHaveBeenCalledWith("[kv] lead store failure: timeout");
  });

  it("at most one line per 60 s, shared by create and list", async () => {
    const store = failing(new KvError("upstream", "x"));
    await create(store);
    await create(store);
    await handleListLeads("log-session-1", { store });
    expect(warn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(59_999);
    await create(store);
    expect(warn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    await create(store);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("never logs a secret, id, email, name, note or error text", async () => {
    const err = new KvError("upstream", `${URL_} ${TOKEN} ${EMAIL}`);
    await create(failing(err));
    vi.advanceTimersByTime(61_000);
    await handleListLeads("log-session-1", { store: failing(err) });
    const logged = JSON.stringify(warn.mock.calls);
    for (const s of [URL_, TOKEN, EMAIL, "Zed Quill", "Ring me", "log-session-1", "book please", "secret-host"]) {
      expect(logged).not.toContain(s);
    }
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("no warning on success or with the memory store", async () => {
    const store = createMemoryLeadStore();
    expect((await create(store)).status).toBe(201);
    expect((await handleListLeads("log-session-1", { store })).body.leads).toHaveLength(1);
    expect(await handleListLeads(null, { store })).toEqual({ status: 200, body: { leads: [] } });
    expect(warn).not.toHaveBeenCalled();
  });

  it("no warning for 400, 429 or a limiter failure", async () => {
    const store = createMemoryLeadStore();
    await handleCreateLead({ body: { email: "bad" }, sessionId: "s" }, { provider: null, store, limiter: allow });
    await handleCreateLead({ body, sessionId: "s" }, { provider: null, store, limiter: async () => ({ allowed: false, retryAfterSeconds: 1 }) });
    await handleCreateLead({ body, sessionId: "s" }, { provider: null, store, limiter: async () => Promise.reject(new Error("x")) });
    expect(warn).not.toHaveBeenCalled();
  });

  it("a throwing console.warn changes nothing", async () => {
    warn.mockImplementation(() => {
      throw new Error("console broke");
    });
    expect(await create(failing(new KvError("config", "x")))).toEqual({
      status: 503,
      body: { error: "Sorry, we could not save your request. Please try again." },
    });
    expect(await handleListLeads("s", { store: failing(new Error("x")) })).toEqual({ status: 200, body: { leads: [] } });
  });
});
