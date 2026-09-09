import { env } from "@/lib/env";

export interface LlmStatus {
  /** True when a real model provider is configured and usable. */
  configured: boolean;
  provider: "anthropic" | "openai" | "mock";
  model: string;
  /** Human-readable reason when not configured. */
  reason?: string;
  /** True when the Anthropic web-search tool can be used. */
  webSearch: boolean;
}

/**
 * Cheap, synchronous check of the model configuration. Does NOT call the API.
 * Used to render an honest "AI unavailable" state instead of faking success.
 */
export function llmStatus(): LlmStatus {
  const provider = env.LLM_PROVIDER;
  const model = env.LLM_MODEL;

  if (provider === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) {
      return {
        configured: false,
        provider,
        model,
        reason: "ANTHROPIC_API_KEY is not set",
        webSearch: false,
      };
    }
    return { configured: true, provider, model, webSearch: true };
  }

  if (provider === "openai") {
    return {
      configured: false,
      provider,
      model,
      reason: "LLM_PROVIDER=openai is not implemented; use anthropic",
      webSearch: false,
    };
  }

  return {
    configured: false,
    provider: "mock",
    model,
    reason: "LLM_PROVIDER is mock (no model configured)",
    webSearch: false,
  };
}
