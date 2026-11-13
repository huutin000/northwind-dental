import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAQ } from "@/lib/faq/data";

// End to end through the real getProvider("groq"), the real Groq provider (fetch is stubbed, so nothing
// leaves the machine) and the shared counter store. tests/setup.ts removes the KV variables, so the
// counter is the per-process memory store. vi.resetModules() gives every test a fresh counter.

const HOURS_ANSWER = FAQ.find((e) => e.id === "hours")!.answer;
const HOURS_Q = "What time do you open?";
const FORM = { email: "cap.visitor@clinic-mail.org", name: "Cap Visitor", note: "Call me" };
const CHAT_HISTORY = [{ role: "user", content: "I want to book a cleaning" }];

let n = 0;
const sid = () => `cap-session-${++n}-abcdef`;

let fetchMock: ReturnType<typeof vi.fn>;

function groqReply(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("AI_MODE", "groq");
  vi.stubEnv("GROQ_API_KEY", "test-key-not-a-secret");
  vi.stubEnv("GROQ_DAILY_CAP", "2");
  // The model answers a chat question with plain text and a lead classification with JSON.
  fetchMock = vi.fn(async (_url: unknown, init?: { body?: string }) => {
    const body = String(init?.body ?? "");
    return body.includes("Classify the conversation above")
      ? groqReply(JSON.stringify({ category: "booking", summary: "Wants to book a cleaning." }))
      : groqReply("Model answer about opening hours.");
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function modules() {
  const { getProvider } = await import("@/lib/ai");
  const { handleChat } = await import("@/lib/chat/handleChat");
  const { handleCreateLead } = await import("@/lib/leads/handleLead");
  const { createMemoryLeadStore } = await import("@/lib/leads/store");
  const { checkRateLimit, createMemoryCounterStore } = await import("@/lib/guard/rateLimit");
  const leadCounter = createMemoryCounterStore();
  const chat = async () => {
    const r = await handleChat({ message: HOURS_Q, history: [], sessionId: sid() }, { provider: getProvider() });
    if (r.status !== 200) throw new Error(`expected 200, got ${r.status}`);
    return r.body;
  };
  const lead = async () => {
    const r = await handleCreateLead(
      { body: { ...FORM, history: CHAT_HISTORY }, sessionId: sid() },
      {
        provider: getProvider(),
        store: createMemoryLeadStore(),
        limiter: (key, opts) => checkRateLimit(key, opts, leadCounter),
      },
    );
    if (r.status !== 201) throw new Error(`expected 201, got ${r.status}`);
    return r.body.lead;
  };
  return { getProvider, chat, lead };
}

describe("Groq daily cap: chat", () => {
  it("below and exactly at the cap the model answers (source ai)", async () => {
    const { chat } = await modules();
    expect((await chat()).source).toBe("ai");
    expect((await chat()).source).toBe("ai");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("over the cap: no Groq call, the FAQ answer is returned without an AI label and without an error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { chat } = await modules();
    await chat();
    await chat();
    const third = await chat();
    expect(third).toEqual({ reply: HOURS_ANSWER, source: "faq-fallback" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[chat] provider failure: rate_limit (groq daily cap reached)");
    // Still over the cap on the next call.
    expect((await chat()).source).toBe("faq-fallback");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("Groq daily cap: lead categorisation", () => {
  it("over the cap the lead is still saved, with a keyword category and no model summary, and Groq is not called", async () => {
    vi.stubEnv("GROQ_DAILY_CAP", "1");
    const { lead } = await modules();
    const first = await lead();
    expect(first).toMatchObject({ category: "booking", summary: "Wants to book a cleaning." });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await lead();
    expect(second.category).toBe("booking"); // keywords: "book" in the chat
    expect(second.summary).toBeUndefined();
    expect(second.email).toBe(FORM.email);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("Groq daily cap: one counter for chat and lead together", () => {
  it("a chat answer and a lead classification share the same two slots", async () => {
    const { chat, lead } = await modules();
    expect((await chat()).source).toBe("ai"); // slot 1
    expect((await lead()).summary).toBe("Wants to book a cleaning."); // slot 2
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await chat()).source).toBe("faq-fallback");
    expect((await lead()).summary).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("Groq daily cap: GROQ_DAILY_CAP value", () => {
  it.each(["abc", "0", "-3", "2.5", ""])("an invalid value (%j) falls back to 300, so a few calls are never blocked", async (value) => {
    vi.stubEnv("GROQ_DAILY_CAP", value);
    const { chat } = await modules();
    for (let i = 0; i < 5; i++) expect((await chat()).source).toBe("ai");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});

describe("Groq daily cap: mock and off are not counted or affected", () => {
  it("mock mode ignores the cap and does not use up Groq slots", async () => {
    vi.stubEnv("GROQ_DAILY_CAP", "1");
    vi.stubEnv("AI_MODE", "mock");
    const { chat, getProvider } = await modules();
    for (let i = 0; i < 4; i++) expect((await chat()).source).toBe("ai");
    expect(fetchMock).not.toHaveBeenCalled();

    // The same process switches to groq: the single slot is still free.
    vi.stubEnv("AI_MODE", "groq");
    expect(getProvider()).not.toBeNull();
    expect((await chat()).source).toBe("ai");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await chat()).source).toBe("faq-fallback");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("off mode has no provider, never calls Groq and does not use up slots", async () => {
    vi.stubEnv("GROQ_DAILY_CAP", "1");
    vi.stubEnv("AI_MODE", "off");
    const { chat, getProvider } = await modules();
    expect(getProvider()).toBeNull();
    for (let i = 0; i < 3; i++) expect((await chat()).source).toBe("faq-fallback");
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv("AI_MODE", "groq");
    expect((await chat()).source).toBe("ai");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
