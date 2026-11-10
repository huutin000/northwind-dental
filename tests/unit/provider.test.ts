import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProviderError,
  buildMessages,
  type CompleteInput,
} from "@/lib/ai/provider";
import { createMockProvider } from "@/lib/ai/mockProvider";
import { createGroqProvider } from "@/lib/ai/groqProvider";
import { getProvider } from "@/lib/ai/index";
import type { FaqEntry } from "@/lib/faq/data";

const KEY = "test-key-SECRET-123";
const QUESTION = "UNIQUE-QUESTION-TEXT about hours";
const FAQ_TEXT = "UNIQUE-FAQ-ANSWER";
const BODY_TEXT = "UNIQUE-RESPONSE-BODY";

const faq: FaqEntry[] = [
  { id: "hours", group: "Services", question: "When open?", answer: FAQ_TEXT, keywords: [] },
  { id: "x", group: "Services", question: "Second?", answer: "Second answer", keywords: [] },
];

function input(over: Partial<CompleteInput> = {}): CompleteInput {
  return {
    system: "SYSTEM PROMPT",
    faq,
    history: [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ],
    question: QUESTION,
    maxTokens: 123,
    timeoutMs: 1000,
    ...over,
  };
}

/** Fake fetch returning a JSON body with the given status. */
function jsonFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

function okBody(content: unknown, extra: Record<string, unknown> = {}) {
  return { choices: [{ message: { content, ...extra }, finish_reason: "stop" }] };
}

async function kindOf(p: Promise<unknown>): Promise<ProviderError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ProviderError);
    return e as ProviderError;
  }
  throw new Error("expected ProviderError");
}

function expectNoLeak(e: ProviderError) {
  for (const s of [KEY, QUESTION, FAQ_TEXT, BODY_TEXT, "SYSTEM PROMPT", "hello"]) {
    expect(e.message).not.toContain(s);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("ProviderError", () => {
  it("keeps instanceof, kind and name", () => {
    const e = new ProviderError("config", "msg");
    expect(e).toBeInstanceOf(ProviderError);
    expect(e).toBeInstanceOf(Error);
    expect(e.kind).toBe("config");
    expect(e.name).toBe("ProviderError");
  });
});

describe("mock provider", () => {
  it("records calls and returns the first FAQ answer", async () => {
    const p = createMockProvider();
    const i = input();
    expect(await p.complete(i)).toBe("Mock answer: " + FAQ_TEXT);
    expect(p.calls).toEqual([i]);
  });

  it("handles an empty faq", async () => {
    const p = createMockProvider();
    expect(await p.complete(input({ faq: [] }))).toMatch(/^Mock answer: /);
  });

  it("throws rate_limit for __mock_429__ and still records the call", async () => {
    const p = createMockProvider();
    const e = await kindOf(p.complete(input({ question: "x __mock_429__" })));
    expect(e.kind).toBe("rate_limit");
    expect(p.calls).toHaveLength(1);
  });
});

describe("buildMessages", () => {
  it("empty faq: the system message is exactly input.system (no FAQ block)", () => {
    const m = buildMessages(input({ faq: [] }));
    expect(m[0]).toEqual({ role: "system", content: "SYSTEM PROMPT" });
  });

  it("orders system, history, question; customer text stays out of system", () => {
    const m = buildMessages(input());
    expect(m.map((x) => x.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(m[0].content.startsWith("SYSTEM PROMPT\n\nFAQ:\n")).toBe(true);
    expect(m[0].content).toContain("[1] Q: When open?\nA: " + FAQ_TEXT);
    expect(m[0].content).toContain("[2] Q: Second?\nA: Second answer");
    expect(m[0].content).not.toContain(QUESTION);
    expect(m[0].content).not.toContain("hello");
    expect(m[1]).toEqual({ role: "user", content: "hi" });
    expect(m[2]).toEqual({ role: "assistant", content: "hello" });
    expect(m[3]).toEqual({ role: "user", content: QUESTION });
  });
});

describe("groq provider", () => {
  it("missing or empty key -> config, fetch not called", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    for (const apiKey of [undefined, ""]) {
      const e = await kindOf(createGroqProvider({ apiKey, model: "m" }).complete(input()));
      expect(e.kind).toBe("config");
      expectNoLeak(e);
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("429 -> rate_limit", async () => {
    vi.stubGlobal("fetch", jsonFetch({ error: BODY_TEXT }, 429));
    const e = await kindOf(createGroqProvider({ apiKey: KEY, model: "m" }).complete(input()));
    expect(e.kind).toBe("rate_limit");
    expectNoLeak(e);
  });

  it("hanging fetch past timeoutMs -> timeout and the signal is aborted", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_u: string, init: RequestInit) => {
        const s = init.signal as AbortSignal;
        signal = s;
        return new Promise((_res, rej) => {
          s.addEventListener("abort", () =>
            rej(new DOMException("aborted", "AbortError")),
          );
        });
      }),
    );
    const e = await kindOf(
      createGroqProvider({ apiKey: KEY, model: "m" }).complete(input({ timeoutMs: 30 })),
    );
    expect(e.kind).toBe("timeout");
    expect(signal?.aborted).toBe(true);
    expectNoLeak(e);
  });

  it("sends the expected request for gpt-oss (with reasoning_effort)", async () => {
    const f = jsonFetch(okBody("ok"));
    vi.stubGlobal("fetch", f);
    const out = await createGroqProvider({ apiKey: KEY, model: "openai/gpt-oss-20b" }).complete(input());
    expect(out).toBe("ok");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(String(init.body)).not.toContain(KEY);
    const body = JSON.parse(String(init.body));
    expect(Object.keys(body).sort()).toEqual(
      ["max_completion_tokens", "messages", "model", "reasoning_effort", "stream", "temperature"],
    );
    expect(body.model).toBe("openai/gpt-oss-20b");
    expect(body.max_completion_tokens).toBe(123);
    expect(body.stream).toBe(false);
    expect(body.temperature).toBe(0.2);
    expect(body.reasoning_effort).toBe("low");
    expect(body.messages).toEqual(buildMessages(input()));
  });

  it("omits reasoning_effort for other models", async () => {
    const f = jsonFetch(okBody("ok"));
    vi.stubGlobal("fetch", f);
    await createGroqProvider({ apiKey: KEY, model: "llama-3.1-8b-instant" }).complete(input());
    const body = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("returns only content, never the reasoning field", async () => {
    vi.stubGlobal("fetch", jsonFetch(okBody("The answer", { reasoning: "SECRET-THOUGHTS" })));
    const out = await createGroqProvider({ apiKey: KEY, model: "openai/gpt-oss-20b" }).complete(input());
    expect(out).toBe("The answer");
    expect(out).not.toContain("SECRET-THOUGHTS");
  });

  it("finish_reason length with non-empty content -> upstream (truncated), no content in message", async () => {
    const body = { choices: [{ message: { content: BODY_TEXT }, finish_reason: "length" }] };
    vi.stubGlobal("fetch", jsonFetch(body));
    const e = await kindOf(createGroqProvider({ apiKey: KEY, model: "m" }).complete(input()));
    expect(e.kind).toBe("upstream");
    expect(e.message).toBe("groq reply truncated");
    expectNoLeak(e);
  });

  it("finish_reason stop, other strings, missing or non-string -> content returned", async () => {
    for (const finish of ["stop", "tool_calls", "LENGTH", undefined, null, 5]) {
      const body = { choices: [{ message: { content: "Fine answer" }, finish_reason: finish }] };
      vi.stubGlobal("fetch", jsonFetch(body));
      const out = await createGroqProvider({ apiKey: KEY, model: "m" }).complete(input());
      expect(out).toBe("Fine answer");
    }
  });

  it("empty content with reasoning -> upstream", async () => {
    for (const content of ["", "   \n", null]) {
      vi.stubGlobal("fetch", jsonFetch(okBody(content, { reasoning: "SECRET-THOUGHTS" })));
      const e = await kindOf(createGroqProvider({ apiKey: KEY, model: "m" }).complete(input()));
      expect(e.kind).toBe("upstream");
      expect(e.message).not.toContain("SECRET-THOUGHTS");
    }
  });

  it("other failures -> upstream with no leaked text", async () => {
    const cases: Array<() => Response | Promise<Response>> = [
      () => new Response(BODY_TEXT, { status: 200 }), // not JSON
      () => new Response(JSON.stringify({ note: BODY_TEXT }), { status: 200 }), // no choices
      () => new Response(JSON.stringify({ choices: [] }), { status: 200 }),
      () => new Response(JSON.stringify({ error: BODY_TEXT }), { status: 500 }),
      () => new Response(JSON.stringify({ error: BODY_TEXT }), { status: 401 }),
      () => {
        throw new TypeError(`network ${KEY} ${QUESTION}`);
      },
    ];
    for (const c of cases) {
      vi.stubGlobal("fetch", vi.fn(async () => c()));
      const e = await kindOf(createGroqProvider({ apiKey: KEY, model: "m" }).complete(input()));
      expect(e.kind).toBe("upstream");
      expectNoLeak(e);
    }
  });

  it("clears its timer after a successful call", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", jsonFetch(okBody("ok")));
    await createGroqProvider({ apiKey: KEY, model: "m" }).complete(input());
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its timer after a failed call", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", jsonFetch({}, 500));
    await kindOf(createGroqProvider({ apiKey: KEY, model: "m" }).complete(input()));
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("getProvider", () => {
  it("off -> null", () => {
    vi.stubEnv("AI_MODE", "off");
    expect(getProvider()).toBeNull();
  });

  it("unset or unknown -> null", () => {
    vi.stubEnv("AI_MODE", "");
    expect(getProvider()).toBeNull();
    vi.stubEnv("AI_MODE", "banana");
    expect(getProvider()).toBeNull();
    vi.unstubAllEnvs();
    delete process.env.AI_MODE;
    expect(getProvider()).toBeNull();
  });

  it("mock -> a new mock provider each call", () => {
    vi.stubEnv("AI_MODE", "mock");
    const a = getProvider() as ReturnType<typeof createMockProvider>;
    const b = getProvider();
    expect(a).not.toBeNull();
    expect(a.calls).toEqual([]);
    expect(b).not.toBe(a);
  });

  it("groq -> groq provider; missing key fails with config", async () => {
    vi.stubEnv("AI_MODE", "groq");
    vi.stubEnv("GROQ_API_KEY", "");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const p = getProvider();
    expect(p).not.toBeNull();
    const e = await kindOf(p!.complete(input()));
    expect(e.kind).toBe("config");
    expect(f).not.toHaveBeenCalled();
  });

  it("groq -> default model openai/gpt-oss-20b", async () => {
    vi.stubEnv("AI_MODE", "groq");
    vi.stubEnv("GROQ_API_KEY", KEY);
    vi.stubEnv("GROQ_MODEL", "");
    const f = jsonFetch(okBody("ok"));
    vi.stubGlobal("fetch", f);
    await getProvider()!.complete(input());
    const body = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.model).toBe("openai/gpt-oss-20b");
  });
});
