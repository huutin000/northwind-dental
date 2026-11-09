import { ProviderError, buildMessages, type ChatProvider } from "./provider";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Groq provider over plain fetch. No logging; error messages are fixed strings. */
export function createGroqProvider(opts: {
  apiKey: string | undefined;
  model: string;
}): ChatProvider {
  return {
    async complete(input) {
      if (!opts.apiKey) throw new ProviderError("config", "groq api key missing");

      const body: Record<string, unknown> = {
        model: opts.model,
        messages: buildMessages(input),
        max_completion_tokens: input.maxTokens,
        temperature: 0.2,
        stream: false,
      };
      // reasoning_effort is accepted by the gpt-oss models only (others get HTTP 400).
      if (opts.model.startsWith("openai/gpt-oss")) body.reasoning_effort = "low";

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), input.timeoutMs);
      try {
        const res = await fetch(GROQ_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${opts.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (res.status === 429) throw new ProviderError("rate_limit", "groq http 429");
        if (!res.ok) throw new ProviderError("upstream", `groq http ${res.status}`);

        const data: unknown = await res.json();
        // Read ONLY choices[0].message.content; any `reasoning` field is ignored.
        const choice = (
          data as {
            choices?: Array<{ message?: { content?: unknown }; finish_reason?: unknown }>;
          }
        )?.choices?.[0];
        const content = choice?.message?.content;
        // finish_reason is read only to detect a cut-off reply (max tokens reached).
        if (choice?.finish_reason === "length") {
          throw new ProviderError("upstream", "groq reply truncated");
        }
        if (typeof content !== "string" || content.trim() === "") {
          throw new ProviderError("upstream", "groq empty response");
        }
        return content;
      } catch (e) {
        if (e instanceof ProviderError) throw e;
        if (controller.signal.aborted) throw new ProviderError("timeout", "groq timeout");
        throw new ProviderError("upstream", "groq request failed");
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
