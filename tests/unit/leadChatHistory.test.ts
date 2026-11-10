import { beforeEach, describe, expect, it } from "vitest";
import {
  clearChatHistory,
  getChatHistory,
  normalizeChatHistory,
  setChatHistory,
} from "@/lib/leads/chatHistory";
import { MAX_HISTORY_CONTENT, MAX_HISTORY_ITEMS, parseLeadInput } from "@/lib/leads/schema";

const turn = (i: number) => ({ role: i % 2 ? ("assistant" as const) : ("user" as const), content: `m${i}` });

describe("normalizeChatHistory", () => {
  it("keeps the last 6 turns, oldest first", () => {
    const items = Array.from({ length: 10 }, (_, i) => turn(i));
    const out = normalizeChatHistory(items);
    expect(MAX_HISTORY_ITEMS).toBe(6);
    expect(out.map((m) => m.content)).toEqual(["m4", "m5", "m6", "m7", "m8", "m9"]);
  });

  it("drops invalid roles, empty or non-string content and non-objects before counting", () => {
    const out = normalizeChatHistory([
      { role: "system", content: "x" },
      { role: "user", content: "" },
      { role: "user", content: "   " },
      { role: "user", content: 5 },
      { role: "user" },
      null,
      "text",
      [],
      { role: "user", content: "kept 1" },
      { role: "assistant", content: "kept 2" },
    ]);
    expect(out).toEqual([
      { role: "user", content: "kept 1" },
      { role: "assistant", content: "kept 2" },
    ]);
  });

  it("returns [] for anything that is not an array", () => {
    for (const v of [undefined, null, "x", 3, {}]) expect(normalizeChatHistory(v)).toEqual([]);
  });

  it("truncates content to MAX_HISTORY_CONTENT", () => {
    const out = normalizeChatHistory([{ role: "user", content: "a".repeat(MAX_HISTORY_CONTENT + 50) }]);
    expect(out[0].content).toHaveLength(MAX_HISTORY_CONTENT);
    const exact = normalizeChatHistory([{ role: "user", content: "a".repeat(MAX_HISTORY_CONTENT) }]);
    expect(exact[0].content).toHaveLength(MAX_HISTORY_CONTENT);
  });

  it("does not leave half a surrogate pair when cutting", () => {
    const content = "a".repeat(MAX_HISTORY_CONTENT - 1) + "\u{1F600}";
    const out = normalizeChatHistory([{ role: "user", content }]);
    expect(out[0].content).toBe("a".repeat(MAX_HISTORY_CONTENT - 1));
  });

  it("copies only role and content, and never aliases the input", () => {
    const input = [{ role: "user", content: "hi", extra: "x" }];
    const out = normalizeChatHistory(input);
    expect(out[0]).toEqual({ role: "user", content: "hi" });
    expect(Object.keys(out[0])).toEqual(["role", "content"]);
    expect(out[0]).not.toBe(input[0]);
  });

  it("its output always passes the server schema", () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ ...turn(i), content: "é".repeat(3000) }));
    const r = parseLeadInput({ email: "a@b.co", history: normalizeChatHistory(items) });
    expect(r.ok).toBe(true);
  });
});

describe("chat history store", () => {
  beforeEach(() => clearChatHistory());

  it("starts empty", () => {
    expect(getChatHistory()).toEqual([]);
  });

  it("stores the normalised turns", () => {
    setChatHistory([turn(0), { role: "bogus", content: "x" }, turn(1)]);
    expect(getChatHistory()).toEqual([turn(0), turn(1)]);
  });

  it("set replaces, it does not append", () => {
    setChatHistory([turn(0)]);
    setChatHistory([turn(1)]);
    expect(getChatHistory()).toEqual([turn(1)]);
  });

  it("get returns copies: mutating the result does not change the store", () => {
    setChatHistory([turn(0)]);
    const first = getChatHistory();
    first[0].content = "changed";
    first.push(turn(5));
    expect(getChatHistory()).toEqual([turn(0)]);
  });

  it("set copies its input: later mutation of the caller's array has no effect", () => {
    const src = [turn(0)];
    setChatHistory(src);
    src[0].content = "changed";
    src.push(turn(3));
    expect(getChatHistory()).toEqual([turn(0)]);
  });

  it("clear empties the store", () => {
    setChatHistory([turn(0)]);
    clearChatHistory();
    expect(getChatHistory()).toEqual([]);
  });
});
