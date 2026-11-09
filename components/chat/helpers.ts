// Pure helpers for the chat widget (no React, no DOM), so they can be unit tested.

export const MAX_INPUT_LENGTH = 500;
const HISTORY_TURNS = 4;
const MAX_SERVER_ERROR_LENGTH = 200;

export type ChatSource = "ai" | "faq-fallback" | "out-of-scope";

export type ChatResponse = { reply: string; source: ChatSource };

/**
 * One entry of the visible list.
 * - "turn": a real exchange item (user message that got a reply, or an API reply)
 * - "greeting": the static welcome note (never sent to the server)
 * - "error": an error note (never sent)
 * - "unsent": a user message whose request failed (never sent)
 */
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  kind: "turn" | "greeting" | "error" | "unsent";
  content: string;
  source?: ChatSource;
};

export type HistoryItem = { role: "user" | "assistant"; content: string };

/** Visible label for a reply source; null for anything unknown. */
export function sourceLabel(source: unknown): string | null {
  switch (source) {
    case "ai":
      return "AI answer";
    case "faq-fallback":
      return "From our FAQ";
    case "out-of-scope":
      return "Outside my scope";
    default:
      return null;
  }
}

/** The last 4 real turns (before the new message) in the exact shape the API expects. */
export function buildHistory(messages: readonly ChatMessage[]): HistoryItem[] {
  return messages
    .filter((m) => m.kind === "turn")
    .slice(-HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content }));
}

/** User-facing error text. Status 0 means a network error or an abort. */
export function friendlyError(status: number, serverError?: unknown): string {
  if (status === 400) {
    if (
      typeof serverError === "string" &&
      serverError.length > 0 &&
      serverError.length <= MAX_SERVER_ERROR_LENGTH
    ) {
      return serverError;
    }
    return "Please check your message and try again.";
  }
  if (status === 429) return "Please wait a moment before sending another message.";
  return "Something went wrong. Please try again.";
}

/** Type guard for a trusted 200 response body. */
export function isChatResponse(json: unknown): json is ChatResponse {
  if (typeof json !== "object" || json === null || Array.isArray(json)) return false;
  const { reply, source } = json as Record<string, unknown>;
  return typeof reply === "string" && reply.length > 0 && sourceLabel(source) !== null;
}

/** Trim, reject empty (null), cap at MAX_INPUT_LENGTH characters. */
export function normalizeInput(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_INPUT_LENGTH);
}

/** Programmatic focus into the input is allowed only when it cannot steal focus from elsewhere. */
export function shouldRefocus(state: {
  activeIsBodyOrNull: boolean;
  activeInsideWidget: boolean;
}): boolean {
  return state.activeIsBodyOrNull || state.activeInsideWidget;
}

/** Escape closes the panel only for focus inside the widget, unhandled and outside IME composition. */
export function shouldCloseOnEscape(state: {
  focusInsideWidget: boolean;
  defaultPrevented: boolean;
  isComposing: boolean;
}): boolean {
  return state.focusInsideWidget && !state.defaultPrevented && !state.isComposing;
}

/**
 * New list and input after a failed send. The failed user bubble is removed and its
 * text restored when the input is empty (never overwriting a newer draft); otherwise
 * the bubble stays, marked "unsent". Older error notes are replaced by `note`.
 */
export function applyFailure(
  messages: readonly ChatMessage[],
  failedUserId: string,
  note: ChatMessage,
  currentInput: string,
): { messages: ChatMessage[]; input: string } {
  const failed = messages.find((m) => m.id === failedUserId && m.role === "user");
  const restore = failed !== undefined && currentInput.trim().length === 0;
  const kept = messages
    .filter((m) => m.kind !== "error" && !(restore && m.id === failedUserId))
    .map((m) =>
      !restore && m.id === failedUserId ? { ...m, kind: "unsent" as const } : m,
    );
  return {
    messages: [...kept, note],
    input: restore ? failed.content : currentInput,
  };
}
