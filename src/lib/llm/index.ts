import { env } from "@/lib/env";
import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import type { LlmProvider } from "./types";

let cached: LlmProvider | null = null;

/** Returns the configured provider (spec §57 — provider abstraction). */
export function llm(): LlmProvider {
  if (cached) return cached;
  switch (env.LLM_PROVIDER) {
    case "anthropic":
      cached = new AnthropicProvider();
      break;
    case "openai":
      // Intentionally not implemented yet — fail loudly rather than fake it.
      throw new Error(
        "LLM_PROVIDER=openai is not implemented. Use 'anthropic' or 'mock'.",
      );
    default:
      cached = new MockProvider();
  }
  return cached;
}

export const usingMockLlm = env.LLM_PROVIDER === "mock";
export type { LlmProvider } from "./types";
