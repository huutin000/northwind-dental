import { checkRateLimit } from "@/lib/guard/rateLimit";
import { getCounterStore } from "@/lib/kv/counterStore";
import { withDailyCap } from "./dailyCap";
import { createGroqProvider } from "./groqProvider";
import { createMockProvider } from "./mockProvider";
import type { ChatProvider } from "./provider";

export * from "./provider";

/**
 * Chooses the provider from AI_MODE, read at call time:
 *   off | unset | unknown -> null (FAQ-only; the safe default, so a typo or a
 *                            missing variable never sends data to a third party)
 *   mock                  -> a NEW mock each call (its `calls` list cannot grow
 *                            without bound across requests)
 *   groq                  -> Groq (key from GROQ_API_KEY, model from GROQ_MODEL), wrapped in the
 *                            site-wide daily cap (GROQ_DAILY_CAP, see ./dailyCap.ts). Only this
 *                            mode counts; mock and off are not wrapped.
 */
export function getProvider(): ChatProvider | null {
  switch (process.env.AI_MODE) {
    case "mock":
      return createMockProvider();
    case "groq":
      return withDailyCap(
        createGroqProvider({
          apiKey: process.env.GROQ_API_KEY,
          model: process.env.GROQ_MODEL || "openai/gpt-oss-20b", // empty counts as unset
        }),
        { limiter: (key, opts) => checkRateLimit(key, opts, getCounterStore()) },
      );
    default:
      return null;
  }
}
