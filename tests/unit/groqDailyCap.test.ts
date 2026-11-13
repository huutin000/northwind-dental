import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GROQ_DAILY_CAP,
  GROQ_CAP_KEY,
  GROQ_CAP_WINDOW_SECONDS,
  getGroqDailyCap,
  withDailyCap,
} from "@/lib/ai/dailyCap";
import { ProviderError, type ChatProvider, type CompleteInput } from "@/lib/ai/provider";
import { checkRateLimit, createMemoryCounterStore } from "@/lib/guard/rateLimit";

afterEach(() => vi.unstubAllEnvs());

const INPUT: CompleteInput = { system: "s", faq: [], history: [], question: "q", maxTokens: 10, timeoutMs: 1000 };

function innerProvider(): ChatProvider & { calls: number } {
  const p = {
    calls: 0,
    async complete() {
      p.calls += 1;
      return "inner reply";
    },
  };
  return p;
}

/** A capped provider on its own memory counter, so tests never share the site-wide counter. */
function capped(cap: number) {
  const inner = innerProvider();
  const store = createMemoryCounterStore();
  const seen: Array<{ key: string; limit: number; windowSeconds: number }> = [];
  const provider = withDailyCap(inner, {
    cap: () => cap,
    limiter: (key, opts) => {
      seen.push({ key, ...opts });
      return checkRateLimit(key, opts, store);
    },
  });
  return { inner, provider, seen };
}

describe("getGroqDailyCap", () => {
  it("defaults to 300 when the variable is not set", () => {
    vi.stubEnv("GROQ_DAILY_CAP", "");
    expect(DEFAULT_GROQ_DAILY_CAP).toBe(300);
    expect(getGroqDailyCap()).toBe(300);
  });

  it("reads a positive whole number, ignoring surrounding spaces", () => {
    vi.stubEnv("GROQ_DAILY_CAP", " 50 ");
    expect(getGroqDailyCap()).toBe(50);
    vi.stubEnv("GROQ_DAILY_CAP", "1");
    expect(getGroqDailyCap()).toBe(1);
  });

  it.each(["0", "-5", "3.5", "1e3", "abc", "300abc", "0x10", "+7", "   ", "NaN", "Infinity", "99999999999999999999"])(
    "falls back to 300 for an invalid value: %j",
    (value) => {
      vi.stubEnv("GROQ_DAILY_CAP", value);
      expect(getGroqDailyCap()).toBe(300);
    },
  );
});

describe("withDailyCap", () => {
  it("below the cap: calls the inner provider and returns its reply", async () => {
    const { inner, provider } = capped(3);
    expect(await provider.complete(INPUT)).toBe("inner reply");
    expect(await provider.complete(INPUT)).toBe("inner reply");
    expect(inner.calls).toBe(2);
  });

  it("exactly at the cap: the last allowed call still goes through", async () => {
    const { inner, provider } = capped(3);
    for (let i = 0; i < 3; i++) expect(await provider.complete(INPUT)).toBe("inner reply");
    expect(inner.calls).toBe(3);
  });

  it("over the cap: the inner provider is NOT called and a rate_limit ProviderError with a fixed message is thrown", async () => {
    const { inner, provider } = capped(2);
    await provider.complete(INPUT);
    await provider.complete(INPUT);
    const error = await provider.complete(INPUT).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).kind).toBe("rate_limit");
    expect((error as ProviderError).message).toBe("groq daily cap reached");
    await provider.complete(INPUT).catch(() => undefined);
    expect(inner.calls).toBe(2);
  });

  it("uses one site-wide key without personal data and a 24 hour window", async () => {
    const { provider, seen } = capped(5);
    await provider.complete({ ...INPUT, question: "my email is jane@example.com", history: [{ role: "user", content: "Zed Quill" }] });
    expect(seen).toEqual([{ key: GROQ_CAP_KEY, limit: 5, windowSeconds: GROQ_CAP_WINDOW_SECONDS }]);
    expect(GROQ_CAP_KEY).toBe("groq-daily");
    expect(GROQ_CAP_WINDOW_SECONDS).toBe(86400);
  });

  it("fails closed with a fixed message when the counter itself fails; the inner provider is not called", async () => {
    const inner = innerProvider();
    const provider = withDailyCap(inner, {
      cap: () => 5,
      limiter: async () => {
        throw new Error("secret-token-should-not-leak");
      },
    });
    const error = await provider.complete(INPUT).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).message).toBe("groq cap check failed");
    expect(String((error as ProviderError).message)).not.toContain("secret");
    expect(inner.calls).toBe(0);
  });

  it("an error from the inner provider passes through unchanged", async () => {
    const failing: ChatProvider = {
      async complete() {
        throw new ProviderError("upstream", "groq http 500");
      },
    };
    const provider = withDailyCap(failing, { cap: () => 5, limiter: (k, o) => checkRateLimit(k, o, createMemoryCounterStore()) });
    await expect(provider.complete(INPUT)).rejects.toMatchObject({ kind: "upstream", message: "groq http 500" });
  });
});
