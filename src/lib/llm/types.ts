import type { z } from "zod";

/**
 * Provider abstraction (spec §57). Core logic never imports a vendor SDK
 * directly — it calls these functions, which route to the configured provider.
 * Scores, dates, dedupe and DB writes stay in deterministic code.
 */
export interface LlmProvider {
  readonly name: string;
  /** Structured generation validated against a Zod schema. */
  generateObject<T>(args: {
    system?: string;
    prompt: string;
    schema: z.ZodType<T>;
    temperature?: number;
  }): Promise<T>;
  /** Free-form text generation (outreach drafts, briefs). */
  generateText(args: {
    system?: string;
    prompt: string;
    temperature?: number;
  }): Promise<string>;
}

export type LlmTaskName =
  | "extractEntities"
  | "classifySignal"
  | "summarizeChange"
  | "interpretCommercialRelevance"
  | "recommendPersonas"
  | "generateOutreach"
  | "generateFollowup"
  | "classifyReply"
  | "prepareMeetingBrief"
  | "answerCopilotQuery";
