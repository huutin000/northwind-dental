import type { FaqEntry } from "@/lib/faq/data";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type CompleteInput = {
  system: string;
  faq: FaqEntry[];
  history: ChatMessage[];
  question: string;
  maxTokens: number;
  timeoutMs: number;
};

/**
 * The only error a provider throws. `message` is always a short fixed string:
 * never the API key, the question, history, FAQ text or a response body.
 */
export class ProviderError extends Error {
  constructor(
    public kind: "rate_limit" | "timeout" | "upstream" | "config",
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}

export interface ChatProvider {
  /** Resolves to the reply text; rejects with `ProviderError`. */
  complete(input: CompleteInput): Promise<string>;
}

/**
 * System message (prompt + numbered FAQ), then history, then the question.
 * Customer text only ever goes into user/assistant messages, never the system one.
 */
export function buildMessages(
  input: CompleteInput,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const faqBlock = input.faq
    .map((e, i) => `[${i + 1}] Q: ${e.question}\nA: ${e.answer}`)
    .join("\n");
  return [
    { role: "system", content: `${input.system}\n\nFAQ:\n${faqBlock}` },
    ...input.history,
    { role: "user", content: input.question },
  ];
}
