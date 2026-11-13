// Site-wide daily cap on real Groq calls (chat answers AND lead categorisation).
//
// Why: Groq usage costs quota. One counter for the whole site, not per visitor.
//
// How: `withDailyCap` wraps the Groq provider (see getProvider in ./index.ts). Before EVERY
// real provider call it takes one slot from a fixed-window counter (24 h from the first call)
// with the existing `checkRateLimit`, on the shared KV counter store (memory when no KV or the
// KV is down). The counter key is the constant "groq-daily": no session id, no personal data.
// The mock provider and AI_MODE=off are never wrapped, so they neither count nor change.
//
// Over the cap the inner provider is NOT called and a ProviderError is thrown. Both callers
// already turn any ProviderError into the FAQ fallback: handleChat answers from the FAQ
// (no AI badge, no error shown) and writes its single fixed `[chat] provider failure` line;
// lead categorisation falls back to keywords silently. The visitor sees no error either way.
//
// Limits (also in README): the counter is best-effort. Without KV, or while it is down, each
// server instance has its own memory counter, so the real total can be up to cap x instances.
// A check that finds the cap already reached still adds 1 to the counter (checkRateLimit counts
// every check), which does not matter once the cap is reached. If the counter itself throws,
// the call is refused (fail closed: protect the quota) with a fixed message.

import { ProviderError, type ChatProvider, type CompleteInput } from "./provider";
import type { RateLimitResult } from "@/lib/guard/rateLimit";

export const DEFAULT_GROQ_DAILY_CAP = 300;
export const GROQ_CAP_KEY = "groq-daily";
export const GROQ_CAP_WINDOW_SECONDS = 86400;

/** GROQ_DAILY_CAP, read at call time: a positive whole number, else the default. */
export function getGroqDailyCap(): number {
  const raw = process.env.GROQ_DAILY_CAP?.trim();
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_GROQ_DAILY_CAP;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_GROQ_DAILY_CAP;
}

type Limiter = (key: string, opts: { limit: number; windowSeconds: number }) => Promise<RateLimitResult>;

export function withDailyCap(
  inner: ChatProvider,
  options: { limiter: Limiter; cap?: () => number },
): ChatProvider {
  const cap = options.cap ?? getGroqDailyCap;
  return {
    async complete(input: CompleteInput) {
      let allowed: boolean;
      try {
        const result = await options.limiter(GROQ_CAP_KEY, { limit: cap(), windowSeconds: GROQ_CAP_WINDOW_SECONDS });
        allowed = result.allowed;
      } catch {
        // Fixed text only: never the underlying error (it could mention a URL or key).
        throw new ProviderError("upstream", "groq cap check failed");
      }
      if (!allowed) throw new ProviderError("rate_limit", "groq daily cap reached");
      return inner.complete(input);
    },
  };
}
