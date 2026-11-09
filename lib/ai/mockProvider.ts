import { ProviderError, type ChatProvider, type CompleteInput } from "./provider";

/** Offline provider for tests and demos. Records every input in `calls`. */
export function createMockProvider(): ChatProvider & { calls: CompleteInput[] } {
  const calls: CompleteInput[] = [];
  return {
    calls,
    async complete(input) {
      calls.push(input); // record first, so failing calls are visible too
      if (input.question.includes("__mock_429__")) {
        throw new ProviderError("rate_limit", "mock rate limit");
      }
      const first = input.faq[0];
      return first ? "Mock answer: " + first.answer : "Mock answer: (no FAQ entries)";
    },
  };
}
