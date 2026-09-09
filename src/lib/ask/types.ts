/** Wire shape returned by POST /api/ask. The client validates against this. */

export type AskStatus = "ok" | "no_results" | "unavailable" | "error";

export interface AskSource {
  kind: "workspace_record" | "external" | "interpretation";
  label: string;
  url: string | null;
  date: string | null;
}

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
  answer: string;
  cards: AskCard[];
  sources: AskSource[];
  conversationId: string | null;
  /** Non-sensitive telemetry for verification. Never contains secrets/content. */
  meta: {
    intent: string;
    intentSource: "model" | "heuristic";
    model: string | null;
    requestId: string | null;
    usage: { input_tokens?: number; output_tokens?: number } | null;
    retrieval: { tool: string; count: number }[];
    aiConfigured: boolean;
  };
}
