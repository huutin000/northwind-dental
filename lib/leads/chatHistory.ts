// Latest chat turns, kept in memory only, for the lead form.
//
// CONTRACT
//   Writer (ChatWidget / ChatPanel, wired in a later task): after every change of the real
//   conversation call  setChatHistory(turns)  with ALL real turns, oldest first, as
//   { role: "user" | "assistant", content: string }. Real turns are the messages with kind "turn"
//   (not the greeting, error notes or unsent bubbles), for example
//     setChatHistory(messages.filter((m) => m.kind === "turn").map(({ role, content }) => ({ role, content })));
//   The store keeps the last MAX_HISTORY_ITEMS (6) and cuts each text to MAX_HISTORY_CONTENT.
//   Reader (LeadForm): getChatHistory() at submit time; returns [] when nothing was set.
//
// PRIVACY: the text lives only in this module variable. It is never written to localStorage,
// sessionStorage, cookies or logs, and a page reload empties it. The server redacts it again.
// Client-only: call the setter from the browser, never from server code (one shared variable).

import type { ChatMessage } from "@/lib/ai/provider";
import { MAX_HISTORY_CONTENT, MAX_HISTORY_ITEMS } from "./schema";

const cut = (text: string): string =>
  text.length <= MAX_HISTORY_CONTENT
    ? text
    : text.slice(0, MAX_HISTORY_CONTENT).replace(/[\uD800-\uDBFF]$/, ""); // no half surrogate pair

/**
 * Keep valid turns only (role "user"/"assistant", non-blank string content), then the last
 * MAX_HISTORY_ITEMS, each cut to MAX_HISTORY_CONTENT. Returns new objects with only the two known fields.
 */
export function normalizeChatHistory(items: unknown): ChatMessage[] {
  if (!Array.isArray(items)) return [];
  const valid: ChatMessage[] = [];
  for (const item of items as unknown[]) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const { role, content } = item as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string" || content.trim() === "") continue;
    valid.push({ role, content });
  }
  return valid.slice(-MAX_HISTORY_ITEMS).map(({ role, content }) => ({ role, content: cut(content) }));
}

let current: ChatMessage[] = [];

/** Replace the stored turns (normalised copy). */
export function setChatHistory(items: unknown): void {
  current = normalizeChatHistory(items);
}

/** A fresh copy of the stored turns. */
export function getChatHistory(): ChatMessage[] {
  return current.map(({ role, content }) => ({ role, content }));
}

export function clearChatHistory(): void {
  current = [];
}
