/** Wire shape returned by POST /api/ask. The client validates against this. */

export type AskStatus = "ok" | "no_results" | "unavailable" | "error";

export interface AskSource {
  kind: "workspace_record" | "external" | "interpretation";
  label: string;
  url: string | null;
  date: string | null;
}

/** How the model synthesis step went. */
export type SynthesisState = "ok" | "skipped" | "failed" | "no_model";

export interface AskCard {
  kind: string;
  title: string;
  subtitle?: string;
  why?: string[];
  /** ISO event date + how it should be labelled. */
  eventDate?: string | null;
  eventDateKind?: string | null;
  actions: { label: string; href: string }[];
}

export interface AskResponse {
  status: AskStatus;
  /** How the answer was produced. */
  mode: "database" | "database+ai" | "external+ai" | "unavailable";
  /** The primary answer (a web-research summary, a workspace analysis, or an honest error). */
  answer: string;
  /** Separate note about the workspace when the primary answer is external research. */
  workspaceNote: string | null;
  cards: AskCard[];
  sources: AskSource[];
  conversationId: string | null;
  /** Non-sensitive telemetry for verification. Never contains secrets/content. */
  meta: {
    intent: string;
    intentSource: "model" | "heuristic";
    model: string | null;
    /** Request id of the FINAL answer-producing Anthropic call. */
    requestId: string | null;
    usage: { input_tokens?: number; output_tokens?: number } | null;
    /** Request id of the web_search research call, when one ran. */
    researchRequestId: string | null;
    retrieval: { tool: string; count: number }[];
    aiConfigured: boolean;
    synthesis: SynthesisState;
    /** Set when synthesis failed / was skipped, for an honest UI. */
    synthesisError: string | null;
  };
}
