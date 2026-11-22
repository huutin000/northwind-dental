import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAQ } from "@/lib/faq/data";

// End to end through the real getProvider("groq"), the real Groq provider (fetch is stubbed, so nothing
// leaves the machine) and the shared counter store. tests/setup.ts removes the KV variables, so the
// counter is the per-process memory store. vi.resetModules() gives every test a fresh counter.

const HOURS_ANSWER = FAQ.find((e) => e.id === "hours")!.answer;
const HOURS_Q = "What time do you open?";

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
  fetchMock = vi.fn(async () => groqReply("Model answer about opening hours."));
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
  const chat = async () => {
    const r = await handleChat({ message: HOURS_Q, history: [], sessionId: sid(), ipKey: sid() }, { provider: getProvider() });
    if (r.status !== 200) throw new Error(`expected 200, got ${r.status}`);
    return r.body;
  };
  return { getProvider, chat };
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
