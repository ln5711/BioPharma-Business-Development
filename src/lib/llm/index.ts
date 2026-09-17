import { env } from "@/lib/env";
import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import type { LlmProvider } from "./types";

let cached: LlmProvider | null = null;
let cachedAnthropic: AnthropicProvider | null = null;

/** Returns the configured provider (spec: provider abstraction). */
export function llm(): LlmProvider {
  if (cached) return cached;
  switch (env.LLM_PROVIDER) {
    case "anthropic":
      cached = new AnthropicProvider();
      break;
    case "openai":
      // Intentionally not implemented — fail loudly rather than fake it.
      throw new Error(
        "LLM_PROVIDER=openai is not implemented. Use 'anthropic' or 'mock'.",
      );
    default:
      cached = new MockProvider();
  }
  return cached;
}

/**
 * The concrete Anthropic provider, or null when it is not the configured
 * provider / no key is set. Callers that need `research()` (web search) or
 * `generateTextRich()` (usage metadata) use this rather than `llm()`.
 */
export function anthropic(): AnthropicProvider | null {
  if (env.LLM_PROVIDER !== "anthropic" || !env.ANTHROPIC_API_KEY) return null;
  if (!cachedAnthropic) cachedAnthropic = new AnthropicProvider();
  return cachedAnthropic;
}

export const usingMockLlm = env.LLM_PROVIDER === "mock";
export type { LlmProvider } from "./types";
export { AnthropicError } from "./anthropic";
export type { LlmCallMeta, ResearchResult, WebSearchCitation } from "./anthropic";
