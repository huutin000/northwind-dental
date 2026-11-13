import { afterEach, describe, expect, it, vi } from "vitest";
import { handleCreateLead, handleListLeads, type LeadResult } from "@/lib/leads/handleLead";
import { createMemoryLeadStore, type LeadStore } from "@/lib/leads/store";
import { createMockProvider } from "@/lib/ai/mockProvider";
import { buildMessages, ProviderError, type ChatProvider, type CompleteInput } from "@/lib/ai/provider";
import { checkRateLimit, createMemoryCounterStore } from "@/lib/guard/rateLimit";
import { KvError } from "@/lib/kv/upstash";
import { POST, GET } from "@/app/api/leads/route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const SAVE_FAILED = "Sorry, we could not save your request. Please try again.";
const LIMIT_TEXT = "You have reached the limit of 3 requests for this demo. Please try again tomorrow.";

let n = 0;
const sid = () => `lead-session-${++n}-abcdef`;

const EMAIL = "visitor@clinic-mail.org";
const form = { email: EMAIL, name: "Zed Quill", note: "Please ring me after lunch" };
const chatHistory = [
  { role: "user", content: "I want to book a cleaning, my mail is jane@example.com" },
  { role: "assistant", content: "Sure, call us on 555-123-4567 or book online." },
];

const withHistory = { ...form, history: [{ role: "user", content: "I want to book" }] };

function jsonProvider(category: string, summary: string): ChatProvider & { calls: CompleteInput[] } {
  const calls: CompleteInput[] = [];
  return {
    calls,
    async complete(i) {
      calls.push(i);
      return JSON.stringify({ category, summary });
    },
  };
}

function deps(over: Partial<Parameters<typeof handleCreateLead>[1]> = {}) {
  const counter = createMemoryCounterStore();
  return {
    provider: null as ChatProvider | null,
    store: createMemoryLeadStore(),
    limiter: (key: string, opts: { limit: number; windowSeconds: number }) => checkRateLimit(key, opts, counter),
    ...over,
  };
}

const create = (body: unknown, d = deps(), sessionId = sid()) => handleCreateLead({ body, sessionId }, d);

function created(r: LeadResult) {
  if (r.status !== 201) throw new Error(`expected 201, got ${r.status}`);
  return r.body.lead;
}

describe("handleCreateLead: success", () => {
  it("201 with the lead, stored for that session", async () => {
    const store = createMemoryLeadStore();
    const p = jsonProvider("booking", "Wants a cleaning.");
    const s = sid();
    const r = await create({ ...form, history: chatHistory }, deps({ store, provider: p }), s);
    const lead = created(r);
    expect(lead).toMatchObject({ email: EMAIL, name: "Zed Quill", note: "Please ring me after lunch", category: "booking", summary: "Wants a cleaning." });
    expect(new Date(lead.createdAt).toISOString()).toBe(lead.createdAt);
    expect(lead.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await store.list(s)).toEqual([lead]);
    expect(await store.list(sid())).toEqual([]);
  });

  it("uses injected now and newId", async () => {
    const lead = created(
      await create(form, deps({ now: () => new Date("2026-01-02T03:04:05.000Z"), newId: () => "fixed-id-12345" })),
    );
    expect(lead.id).toBe("fixed-id-12345");
    expect(lead.createdAt).toBe("2026-01-02T03:04:05.000Z");
  });

  it("works without history or provider (keywords, no summary)", async () => {
    const lead = created(await create({ email: EMAIL }));
    expect(lead.category).toBe("other");
    expect(lead.summary).toBeUndefined();
    expect(lead.name).toBeUndefined();
  });

  it("keeps only the last 6 history items, redacted and cut to 500 characters", async () => {
    const p = jsonProvider("other", "s");
    const h = Array.from({ length: 6 }, (_, i) => ({ role: "user", content: `message ${i} ` + "x".repeat(600) }));
    await create({ ...form, history: h }, deps({ provider: p }));
    expect(p.calls[0].history).toHaveLength(6);
    expect(p.calls[0].history.every((m) => m.content.length <= 500)).toBe(true);
  });

  it("does not leave half an emoji at the cut", async () => {
    const p = jsonProvider("other", "s");
    const content = "a".repeat(499) + "😀";
    await create({ ...form, history: [{ role: "user", content }] }, deps({ provider: p }));
    expect(p.calls[0].history[0].content).toBe("a".repeat(499));
  });

  it("redacts history before it reaches the provider; the form never does", async () => {
    const p = jsonProvider("booking", "s");
    await create({ ...form, history: chatHistory }, deps({ provider: p }));
    expect(p.calls).toHaveLength(1);
    const sent = JSON.stringify(p.calls);
    for (const secret of ["jane@example.com", "555-123-4567", EMAIL, "Zed Quill", "Please ring me"]) {
      expect(sent).not.toContain(secret);
    }
    expect(sent).toContain("[email]");
    expect(sent).toContain("[phone]");
  });

  // Guards the README claim that form fields (email, name, note) are not sent to the AI provider.
  // It checks everything the provider would put on the wire: the CompleteInput and the exact
  // messages built from it (system prompt, history, question), including pieces of each value.
  it("none of the form fields reaches the provider; an email typed in the chat is replaced by [email]", async () => {
    const formOnly = {
      email: "form.owner@mail-zq7.test",
      name: "Quillon Vandermeer",
      note: "Allergic to peppermint, bring forms Thursday",
    };
    const history = [
      { role: "user", content: "I want to book a visit, write to chat.person@sample-host.org please" },
      { role: "assistant", content: "Thanks, the team can help with booking." },
    ];
    const p = jsonProvider("booking", "Wants to book.");
    await create({ ...formOnly, history }, deps({ provider: p }));

    expect(p.calls).toHaveLength(1);
    const sent = [
      JSON.stringify(p.calls),
      ...p.calls.map((c) => JSON.stringify(buildMessages(c))),
    ]
      .join("\n")
      .toLowerCase();

    for (const piece of [
      formOnly.email,
      "form.owner",
      "mail-zq7",
      formOnly.name,
      "quillon",
      "vandermeer",
      formOnly.note,
      "peppermint",
      "thursday",
    ]) {
      expect(sent, `form value leaked: ${piece}`).not.toContain(piece.toLowerCase());
    }
    // The chat email is gone, and its replacement is in the history the model sees.
    expect(sent).not.toContain("chat.person");
    expect(sent).not.toContain("sample-host");
    const messages = buildMessages(p.calls[0]);
    expect(messages.some((m) => m.role === "user" && m.content.includes("write to [email] please"))).toBe(true);
  });

  it("the stored summary has no PII even if the model echoes it", async () => {
    const p = jsonProvider("booking", "Contact jane@example.com");
    const lead = created(await create({ ...form, history: chatHistory }, deps({ provider: p })));
    expect(lead.summary).toBe("Contact [email]");
  });
});

describe("handleCreateLead: provider failures never fail the request", () => {
  it.each([new ProviderError("timeout", "t"), new Error("boom")])("%s -> 201, keywords, no summary", async (err) => {
    const p: ChatProvider = {
      complete: async () => {
        throw err;
      },
    };
    const lead = created(await create({ ...form, history: chatHistory }, deps({ provider: p })));
    expect(lead.category).toBe("booking");
    expect(lead.summary).toBeUndefined();
  });

  it("mock provider's non-JSON reply -> keyword category", async () => {
    const lead = created(
      await create({ ...form, history: [{ role: "user", content: "how much is a filling" }] }, deps({ provider: createMockProvider() })),
    );
    expect(lead.category).toBe("pricing");
    expect(lead.summary).toBeUndefined();
  });
});

describe("handleCreateLead: validation", () => {
  const bad: Array<[string, unknown]> = [
    ["invalid email", { ...form, email: "nope" }],
    ["name 81 chars", { ...form, name: "n".repeat(81) }],
    ["note 501 chars", { ...form, note: "n".repeat(501) }],
    ["honeypot filled", { ...form, website: "http://spam.example" }],
    ["history of 7 items", { ...form, history: Array.from({ length: 7 }, () => ({ role: "user", content: "hi" })) }],
    ["not an object", "text"],
  ];
  it.each(bad)("%s -> 400, nothing stored, no slot used, provider not called", async (_n, body) => {
    const store = createMemoryLeadStore();
    const p = createMockProvider();
    const limiter = vi.fn(checkRateLimit);
    const s = sid();
    const r = await handleCreateLead({ body, sessionId: s }, { provider: p, store, limiter });
    expect(r.status).toBe(400);
    expect(typeof (r.body as { error: string }).error).toBe("string");
    expect(limiter).not.toHaveBeenCalled();
    expect(p.calls).toHaveLength(0);
    expect(await store.list(s)).toEqual([]);
  });

  it("invalid input leaves all 3 slots available", async () => {
    const d = deps();
    const s = sid();
    for (let i = 0; i < 5; i++) expect((await create({ email: "bad" }, d, s)).status).toBe(400);
    for (let i = 0; i < 3; i++) expect((await create(form, d, s)).status).toBe(201);
    expect((await create(form, d, s)).status).toBe(429);
  });
});

describe("handleCreateLead: rate limit", () => {
  it("calls the limiter with lead:<sessionId>, 3 per 86400 s", async () => {
    const limiter = vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 }));
    const s = sid();
    await handleCreateLead({ body: form, sessionId: s }, { ...deps(), limiter });
    expect(limiter).toHaveBeenCalledTimes(1);
    expect(limiter).toHaveBeenCalledWith(`lead:${s}`, { limit: 3, windowSeconds: 86400 });
  });

  it("the 4th lead -> 429; it is not stored and the provider is not called", async () => {
    const store = createMemoryLeadStore();
    const p = createMockProvider();
    const d = deps({ store, provider: p });
    const s = sid();
    for (let i = 0; i < 3; i++) expect((await create(withHistory, d, s)).status).toBe(201);
    expect(p.calls).toHaveLength(3);
    const r = await create(withHistory, d, s);
    expect(r).toEqual({ status: 429, body: { error: LIMIT_TEXT } });
    expect(p.calls).toHaveLength(3);
    expect(await store.list(s)).toHaveLength(3);
  });

  it("another session has its own 3 slots", async () => {
    const d = deps();
    const a = sid();
    for (let i = 0; i < 3; i++) await create(form, d, a);
    expect((await create(form, d, sid())).status).toBe(201);
  });

  it("5 parallel creates on one session -> exactly 3 x 201 and 2 x 429", async () => {
    const store = createMemoryLeadStore();
    const d = deps({ store, provider: jsonProvider("other", "s") });
    const s = sid();
    const rs = await Promise.all(Array.from({ length: 5 }, () => create(form, d, s)));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(3);
    expect(rs.filter((r) => r.status === 429)).toHaveLength(2);
    expect(await store.list(s)).toHaveLength(3);
  });

  it("a limiter failure is not swallowed into a lead (503, no detail)", async () => {
    const limiter = vi.fn(async () => {
      throw new Error("secret detail");
    });
    const r = await handleCreateLead({ body: form, sessionId: sid() }, { ...deps(), limiter });
    expect(r).toEqual({ status: 503, body: { error: SAVE_FAILED } });
  });
});

describe("handleCreateLead: store failures", () => {
  const failing = (err: unknown): LeadStore => ({
    add: async () => {
      throw err;
    },
    list: async () => [],
    count: async () => 0,
  });
  it.each([
    ["KvError config", new KvError("config", "kv misconfigured")],
    ["KvError upstream", new KvError("upstream", "kv http 500")],
    ["generic Error", new Error("token abc123 leaked")],
    ["RangeError", new RangeError("invalid lead")],
    ["non-error value", "oops"],
  ])("%s -> 503 with the fixed text only", async (_n, err) => {
    const r = await create(form, deps({ store: failing(err) }));
    expect(r).toEqual({ status: 503, body: { error: SAVE_FAILED } });
  });
});

describe("handleListLeads", () => {
  it("returns only the leads of that session", async () => {
    const store = createMemoryLeadStore();
    const d = deps({ store });
    const a = sid();
    const b = sid();
    const la = created(await create(form, d, a));
    const lb = created(await create({ email: "other@clinic-mail.org" }, d, b));
    expect(await handleListLeads(a, { store })).toEqual({ status: 200, body: { leads: [la] } });
    expect(await handleListLeads(b, { store })).toEqual({ status: 200, body: { leads: [lb] } });
  });

  it("null session -> [] and the store is not touched", async () => {
    const store = createMemoryLeadStore();
    const spy = { add: vi.spyOn(store, "add"), list: vi.spyOn(store, "list"), count: vi.spyOn(store, "count") };
    expect(await handleListLeads(null, { store })).toEqual({ status: 200, body: { leads: [] } });
    expect(spy.add).not.toHaveBeenCalled();
    expect(spy.list).not.toHaveBeenCalled();
    expect(spy.count).not.toHaveBeenCalled();
  });

  it.each([new KvError("config", "kv misconfigured"), new KvError("upstream", "x"), new Error("boom")])(
    "store error -> 200 with no leads",
    async (err) => {
      const store: LeadStore = { add: async () => {}, count: async () => 0, list: async () => Promise.reject(err) };
      expect(await handleListLeads(sid(), { store })).toEqual({ status: 200, body: { leads: [] } });
    },
  );
});

// ---------------------------------------------------------------- route

const URL_ = "http://localhost/api/leads";
const post = (body: unknown, cookie?: string, raw?: string) =>
  POST(
    new Request(URL_, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: raw ?? JSON.stringify(body),
    }),
  );
const get = (cookie?: string) => GET(new Request(URL_, { headers: cookie ? { cookie } : {} }));
const cookieOf = (res: Response) => res.headers.get("set-cookie")!.split(";")[0];

describe("route", () => {
  it("first POST sets an HttpOnly SameSite=Lax cookie; a later GET returns the lead", async () => {
    vi.stubEnv("AI_MODE", "off");
    const res = await post({ ...form, history: chatHistory });
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const sc = res.headers.get("set-cookie")!;
    expect(sc).toContain("HttpOnly");
    expect(sc).toContain("SameSite=Lax");
    const body = (await res.json()) as { lead: { id: string; email: string } };
    expect(Object.keys(body)).toEqual(["lead"]);
    expect(body.lead.email).toBe(EMAIL);

    const list = await get(cookieOf(res));
    expect(list.status).toBe(200);
    expect(list.headers.get("cache-control")).toBe("no-store");
    expect(await list.json()).toEqual({ leads: [body.lead] });
  });

  it("a second browser cannot see the first one's lead", async () => {
    vi.stubEnv("AI_MODE", "off");
    const first = await post(form);
    expect(first.status).toBe(201);
    const second = await post({ email: "second@clinic-mail.org" });
    const list = (await (await get(cookieOf(second))).json()) as { leads: Array<{ email: string }> };
    expect(list.leads.map((l) => l.email)).toEqual(["second@clinic-mail.org"]);
  });

  it("GET without a cookie, with a tampered cookie -> no leads", async () => {
    vi.stubEnv("AI_MODE", "off");
    const first = await post(form);
    const c = cookieOf(first);
    const tampered = c.slice(0, -2) + (c.endsWith("AA") ? "BB" : "AA");
    for (const cookie of [undefined, tampered, "nd_session=garbage"]) {
      const res = await get(cookie);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ leads: [] });
      expect(res.headers.get("set-cookie")).toBeNull();
    }
  });

  it("400 on a 400 still sets the cookie; texts are fixed", async () => {
    const bad = await post({ email: "nope" });
    expect(bad.status).toBe(400);
    expect(bad.headers.get("set-cookie")).toContain("nd_session=");
    expect(await bad.json()).toEqual({ error: "Please enter a valid email address." });
  });

  it("invalid JSON, array body, non-object body -> 400 Invalid request.", async () => {
    for (const raw of ["{not json", "[]", "5", "null"]) {
      const res = await post(undefined, undefined, raw);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid request." });
    }
  });

  it("oversized body -> 400 (actual length and content-length)", async () => {
    const big = JSON.stringify({ email: EMAIL, note: "x".repeat(40 * 1024) });
    const res = await post(undefined, undefined, big);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid request." });
    const declared = await POST(
      new Request(URL_, { method: "POST", headers: { "content-type": "application/json", "content-length": "99999" }, body: JSON.stringify(form) }),
    );
    expect(declared.status).toBe(400);
  });

  it("the 4th POST with one cookie -> 429 with Retry-After", async () => {
    vi.stubEnv("AI_MODE", "off");
    const first = await post(form);
    const c = cookieOf(first);
    expect((await post(form, c)).status).toBe(201);
    expect((await post(form, c)).status).toBe(201);
    const res = await post(form, c);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("86400");
    expect(await res.json()).toEqual({ error: LIMIT_TEXT });
  });

  it("AI_MODE=mock saves the lead with a keyword category", async () => {
    vi.stubEnv("AI_MODE", "mock");
    const res = await post({ ...form, history: [{ role: "user", content: "how much is whitening" }] });
    expect(res.status).toBe(201);
    const { lead } = (await res.json()) as { lead: { category: string; summary?: string } };
    expect(lead.category).toBe("pricing");
    expect(lead.summary).toBeUndefined();
  });

  it("AI_MODE=off saves the lead", async () => {
    vi.stubEnv("AI_MODE", "off");
    const res = await post({ ...form, history: [{ role: "user", content: "I want to book" }] });
    expect(res.status).toBe(201);
    expect(((await res.json()) as { lead: { category: string } }).lead.category).toBe("booking");
  });

  it("missing SESSION_SECRET in production -> generic 500 for POST and GET", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    for (const res of [await post(form), await get()]) {
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Something went wrong. Please try again." });
    }
  });
});
