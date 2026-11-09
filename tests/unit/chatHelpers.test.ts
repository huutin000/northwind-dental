import { describe, expect, it } from "vitest";
import {
  MAX_INPUT_LENGTH,
  applyFailure,
  buildHistory,
  friendlyError,
  isChatResponse,
  normalizeInput,
  shouldCloseOnEscape,
  shouldRefocus,
  sourceLabel,
  type ChatMessage,
} from "@/components/chat/helpers";

const msg = (
  id: number,
  role: "user" | "assistant",
  kind: ChatMessage["kind"],
  content = `m${id}`,
): ChatMessage => ({ id: String(id), role, kind, content });

describe("sourceLabel", () => {
  it("maps the three sources", () => {
    expect(sourceLabel("ai")).toBe("AI answer");
    expect(sourceLabel("faq-fallback")).toBe("From our FAQ");
    expect(sourceLabel("out-of-scope")).toBe("Outside my scope");
  });
  it("returns null for unknown values", () => {
    expect(sourceLabel("other")).toBeNull();
    expect(sourceLabel("")).toBeNull();
    expect(sourceLabel(undefined)).toBeNull();
    expect(sourceLabel("constructor")).toBeNull();
    expect(sourceLabel("__proto__")).toBeNull();
  });
});

describe("buildHistory", () => {
  it("returns an empty list when there are no turns", () => {
    expect(buildHistory([])).toEqual([]);
    expect(buildHistory([msg(1, "assistant", "greeting")])).toEqual([]);
  });
  it("keeps only the last 4 real turns with the exact shape", () => {
    const list = [
      msg(0, "assistant", "greeting"),
      msg(1, "user", "turn"),
      msg(2, "assistant", "turn"),
      msg(3, "user", "turn"),
      msg(4, "assistant", "turn"),
      msg(5, "user", "turn"),
      msg(6, "assistant", "turn"),
    ];
    expect(buildHistory(list)).toEqual([
      { role: "user", content: "m3" },
      { role: "assistant", content: "m4" },
      { role: "user", content: "m5" },
      { role: "assistant", content: "m6" },
    ]);
  });
  it("excludes greeting, error notes and unsent user messages", () => {
    const list = [
      msg(0, "assistant", "greeting"),
      msg(1, "user", "turn"),
      msg(2, "assistant", "turn"),
      msg(3, "user", "unsent"),
      msg(4, "assistant", "error"),
    ];
    expect(buildHistory(list)).toEqual([
      { role: "user", content: "m1" },
      { role: "assistant", content: "m2" },
    ]);
  });
  it("does not leak extra fields", () => {
    const [first] = buildHistory([msg(1, "user", "turn")]);
    expect(Object.keys(first).sort()).toEqual(["content", "role"]);
  });
});

describe("friendlyError", () => {
  const generic = "Something went wrong. Please try again.";
  it("shows a short string server error for 400", () => {
    expect(friendlyError(400, "Message is too long.")).toBe("Message is too long.");
  });
  it("falls back for 400 with a missing, non-string or long error", () => {
    const fallback = "Please check your message and try again.";
    expect(friendlyError(400)).toBe(fallback);
    expect(friendlyError(400, 42)).toBe(fallback);
    expect(friendlyError(400, "")).toBe(fallback);
    expect(friendlyError(400, "x".repeat(201))).toBe(fallback);
    expect(friendlyError(400, "x".repeat(200))).toBe("x".repeat(200));
  });
  it("maps 429", () => {
    expect(friendlyError(429)).toBe("Please wait a moment before sending another message.");
  });
  it("maps 500, network (0) and other statuses to the generic text", () => {
    expect(friendlyError(500)).toBe(generic);
    expect(friendlyError(0)).toBe(generic);
    expect(friendlyError(502)).toBe(generic);
    expect(friendlyError(200)).toBe(generic);
  });
});

describe("isChatResponse", () => {
  it("accepts valid shapes", () => {
    for (const source of ["ai", "faq-fallback", "out-of-scope"]) {
      expect(isChatResponse({ reply: "Hi", source })).toBe(true);
    }
  });
  it("rejects invalid shapes", () => {
    const bad: unknown[] = [
      null,
      undefined,
      "text",
      42,
      [],
      [{ reply: "Hi", source: "ai" }],
      {},
      { reply: "Hi" },
      { source: "ai" },
      { reply: "", source: "ai" },
      { reply: 5, source: "ai" },
      { reply: "Hi", source: "groq" },
      { reply: "Hi", source: 1 },
      { reply: "Hi", source: "constructor" },
    ];
    for (const value of bad) expect(isChatResponse(value)).toBe(false);
  });
});

describe("normalizeInput", () => {
  it("trims", () => {
    expect(normalizeInput("  hello  ")).toBe("hello");
  });
  it("rejects empty or whitespace-only input", () => {
    expect(normalizeInput("")).toBeNull();
    expect(normalizeInput("   \n\t ")).toBeNull();
  });
  it("caps at the maximum length", () => {
    expect(MAX_INPUT_LENGTH).toBe(500);
    expect(normalizeInput("a".repeat(600))).toBe("a".repeat(500));
    expect(normalizeInput("a".repeat(500))).toBe("a".repeat(500));
  });
});

describe("shouldRefocus", () => {
  it("allows focus when it is on the body/null or inside the widget", () => {
    expect(shouldRefocus({ activeIsBodyOrNull: true, activeInsideWidget: false })).toBe(true);
    expect(shouldRefocus({ activeIsBodyOrNull: false, activeInsideWidget: true })).toBe(true);
    expect(shouldRefocus({ activeIsBodyOrNull: true, activeInsideWidget: true })).toBe(true);
  });
  it("does not steal focus from a field elsewhere on the page", () => {
    expect(shouldRefocus({ activeIsBodyOrNull: false, activeInsideWidget: false })).toBe(false);
  });
});

describe("shouldCloseOnEscape", () => {
  const base = { focusInsideWidget: true, defaultPrevented: false, isComposing: false };
  it("closes only when focus is inside the widget", () => {
    expect(shouldCloseOnEscape(base)).toBe(true);
    expect(shouldCloseOnEscape({ ...base, focusInsideWidget: false })).toBe(false);
  });
  it("ignores handled events and IME composition", () => {
    expect(shouldCloseOnEscape({ ...base, defaultPrevented: true })).toBe(false);
    expect(shouldCloseOnEscape({ ...base, isComposing: true })).toBe(false);
  });
});

describe("applyFailure", () => {
  const list: ChatMessage[] = [
    msg(0, "assistant", "greeting"),
    msg(1, "user", "turn", "earlier"),
    msg(2, "assistant", "turn", "answer"),
    msg(3, "user", "turn", "typed text"),
  ];
  const note = msg(9, "assistant", "error", "Something went wrong. Please try again.");

  it("removes the failed bubble, restores its text into an empty input and adds the note", () => {
    const out = applyFailure(list, "3", note, "");
    expect(out.input).toBe("typed text");
    expect(out.messages.map((m) => m.id)).toEqual(["0", "1", "2", "9"]);
  });
  it("treats a whitespace-only input as empty", () => {
    expect(applyFailure(list, "3", note, "  ").input).toBe("typed text");
  });
  it("never overwrites what the visitor typed meanwhile; keeps the bubble as unsent", () => {
    const out = applyFailure(list, "3", note, "new draft");
    expect(out.input).toBe("new draft");
    expect(out.messages.map((m) => [m.id, m.kind])).toEqual([
      ["0", "greeting"],
      ["1", "turn"],
      ["2", "turn"],
      ["3", "unsent"],
      ["9", "error"],
    ]);
  });
  it("leaves history untouched by errors", () => {
    const out = applyFailure(list, "3", note, "");
    expect(buildHistory(out.messages)).toEqual([
      { role: "user", content: "earlier" },
      { role: "assistant", content: "answer" },
    ]);
  });
  it("replaces an older error note and tolerates an unknown id", () => {
    const withOld = [...list, msg(8, "assistant", "error", "old")];
    expect(applyFailure(withOld, "3", note, "").messages.filter((m) => m.kind === "error")).toHaveLength(1);
    expect(applyFailure(list, "zzz", note, "").input).toBe("");
  });
});
