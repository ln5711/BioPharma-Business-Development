import type { z } from "zod";
import type { LlmProvider } from "./types";

/**
 * Deterministic, network-free provider used when LLM_PROVIDER=mock (the default).
 * It produces schema-valid, clearly-templated output so every downstream flow —
 * signal interpretation, outreach drafting, briefs — works end to end without an
 * API key (spec §115: "Do NOT fake successful integrations" — this is labelled
 * as generated, not passed off as a model result).
 */
export class MockProvider implements LlmProvider {
  readonly name = "mock";

  async generateObject<T>(args: { schema: z.ZodType<T>; prompt: string }): Promise<T> {
    // Best-effort: fill a minimal object the schema accepts.
    const shape = (args.schema as unknown as { _def?: { shape?: () => Record<string, unknown> } })
      ._def?.shape?.();
    const draft: Record<string, unknown> = {};
    if (shape) {
      for (const key of Object.keys(shape)) draft[key] = placeholderFor(key);
    }
    const parsed = args.schema.safeParse(draft);
    if (parsed.success) return parsed.data;
    // Fall back to an empty object cast — callers always have deterministic
    // defaults layered on top of LLM output.
    return {} as T;
  }

  async generateText(args: { prompt: string; system?: string }): Promise<string> {
    return [
      "[draft generated without a language model — set LLM_PROVIDER=anthropic|openai for production copy]",
      "",
      args.prompt.slice(0, 600),
    ].join("\n");
  }
}

function placeholderFor(key: string): unknown {
  const k = key.toLowerCase();
  if (k.includes("score") || k.includes("confidence")) return 50;
  if (k.includes("personas") || k.endsWith("s")) return [];
  if (k.includes("urgency")) return "medium";
  return `[${key}]`;
}
