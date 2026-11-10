import { describe, expect, it } from "vitest";
import { categorize, categorizeByKeywords, CATEGORIZE_SYSTEM_PROMPT, CATEGORIZE_TIMEOUT_MS } from "@/lib/leads/categorize";
import { createMockProvider } from "@/lib/ai/mockProvider";
import { ProviderError, type ChatMessage, type ChatProvider, type CompleteInput } from "@/lib/ai/provider";

const user = (content: string): ChatMessage => ({ role: "user", content });
const bot = (content: string): ChatMessage => ({ role: "assistant", content });

describe("categorizeByKeywords", () => {
  it.each([
    ["I'd like to book an appointment", "booking"],
    ["Can I reschedule my slot?", "booking"],
    ["how much is whitening", "pricing"],
    ["Do you take insurance? What is the fee", "pricing"],
    ["What are your opening hours", "other"],
    ["BOOK ME IN", "booking"],
  ])("%s -> %s", (text, expected) => {
    expect(categorizeByKeywords([user(text)])).toBe(expected);
  });

  it("empty history -> other", () => {
    expect(categorizeByKeywords([])).toBe("other");
  });

  it("ignores assistant messages", () => {
    expect(categorizeByKeywords([user("hello"), bot("You can book an appointment, the price is low")])).toBe("other");
  });

  it("more hits win", () => {
    expect(categorizeByKeywords([user("book"), user("price, cost and fee please")])).toBe("pricing");
    expect(categorizeByKeywords([user("book an appointment, what is the price")])).toBe("booking");
  });

  it("a tie goes to booking", () => {
    expect(categorizeByKeywords([user("book it, and the price?")])).toBe("booking");
  });

  it("matches whole words only", () => {
    expect(categorizeByKeywords([user("I read a notebook about payments and bookkeeping")])).toBe("other");
    expect(categorizeByKeywords([user("a pricey outfit, visiting hours")])).toBe("other");
  });

  it("matches the phrase 'how much' only when the words are adjacent", () => {
    expect(categorizeByKeywords([user("how much")])).toBe("pricing");
    expect(categorizeByKeywords([user("how is that much")])).toBe("other");
  });
});

type Reply = string | Error;
function fakeProvider(reply: Reply): ChatProvider & { calls: CompleteInput[] } {
  const calls: CompleteInput[] = [];
  return {
    calls,
    async complete(input) {
      calls.push(input);
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
}
const json = (category: unknown, summary: unknown) => JSON.stringify({ category, summary });
const history = [user("Hi, I want to book a cleaning"), bot("Sure"), user("Next week")];

describe("categorize", () => {
  it("empty history -> other, provider not called", async () => {
    const p = fakeProvider(json("booking", "x"));
    expect(await categorize([], p)).toEqual({ category: "other" });
    expect(p.calls).toHaveLength(0);
  });

  it("no provider -> keywords, no summary", async () => {
    expect(await categorize(history, null)).toEqual({ category: "booking", summary: undefined });
  });

  it("uses the category and summary of valid JSON, one call with the fixed settings", async () => {
    const p = fakeProvider(json("pricing", "Asked about cost."));
    expect(await categorize(history, p)).toEqual({ category: "pricing", summary: "Asked about cost." });
    expect(p.calls).toHaveLength(1);
    const c = p.calls[0];
    expect(c.system).toBe(CATEGORIZE_SYSTEM_PROMPT);
    expect(c.faq).toEqual([]);
    expect(c.history).toEqual(history);
    expect(c.question).toBe("Classify the conversation above and summarise it.");
    expect(c.maxTokens).toBe(300);
    expect(c.timeoutMs).toBe(4500);
    expect(CATEGORIZE_TIMEOUT_MS).toBe(4500);
  });

  it("system prompt names the categories, calls the chat data and demands JSON only", () => {
    for (const w of ["Do not include names, contact details or other personal data in the summary, and write it in English.", "booking", "pricing", "other", "DATA", "ignore", "ONLY", '"category"', '"summary"']) {
      expect(CATEGORIZE_SYSTEM_PROMPT).toContain(w);
    }
  });

  it("accepts a code fence and extra whitespace", async () => {
    const fenced = "\n  ```json\n" + json("booking", "S") + "\n```  \n";
    expect(await categorize(history, fakeProvider(fenced))).toEqual({ category: "booking", summary: "S" });
    expect(await categorize(history, fakeProvider("```\n" + json("other", "T") + "\n```"))).toEqual({
      category: "other",
      summary: "T",
    });
    expect(await categorize(history, fakeProvider("  \n" + json("pricing", " U ") + "\n "))).toEqual({
      category: "pricing",
      summary: "U",
    });
  });

  it.each([
    ["invalid JSON", "not json"],
    ["text around JSON", "Here: " + json("pricing", "x")],
    ["array", "[]"],
    ["null", "null"],
    ["string", '"booking"'],
    ["wrong category", json("sales", "x")],
    ["category wrong case", json("Booking", "x")],
    ["category not a string", json(1, "x")],
    ["missing category", JSON.stringify({ summary: "x" })],
    ["empty reply", ""],
  ])("%s -> keyword fallback, no summary", async (_n, reply) => {
    expect(await categorize(history, fakeProvider(reply))).toEqual({ category: "booking", summary: undefined });
  });

  it("valid category with an invalid summary keeps the category", async () => {
    expect(await categorize(history, fakeProvider(json("pricing", 42)))).toEqual({
      category: "pricing",
      summary: undefined,
    });
    expect(await categorize(history, fakeProvider(JSON.stringify({ category: "pricing" })))).toEqual({
      category: "pricing",
      summary: undefined,
    });
    expect(await categorize(history, fakeProvider(json("pricing", "  \n ")))).toEqual({
      category: "pricing",
      summary: undefined,
    });
  });

  it("collapses newlines and redacts PII in the summary", async () => {
    const r = await categorize(history, fakeProvider(json("booking", "Line one\n\nline two\r\n mail jane@example.com")));
    expect(r.summary).toBe("Line one line two mail [email]");
  });

  it("caps the summary at 400 characters", async () => {
    const r = await categorize(history, fakeProvider(json("other", "a".repeat(500))));
    expect(r.summary).toHaveLength(400);
  });

  it.each(["rate_limit", "timeout", "upstream", "config"] as const)("ProviderError %s -> keywords", async (kind) => {
    const r = await categorize(history, fakeProvider(new ProviderError(kind, "x")));
    expect(r).toEqual({ category: "booking", summary: undefined });
  });

  it("a generic error or a non-string reply -> keywords", async () => {
    expect(await categorize(history, fakeProvider(new Error("boom")))).toEqual({
      category: "booking",
      summary: undefined,
    });
    const odd = { complete: async () => 5 as unknown as string };
    expect(await categorize(history, odd)).toEqual({ category: "booking", summary: undefined });
  });

  it("the mock's non-JSON reply -> keywords", async () => {
    const r = await categorize([user("how much is a filling")], createMockProvider());
    expect(r).toEqual({ category: "pricing", summary: undefined });
  });
});
