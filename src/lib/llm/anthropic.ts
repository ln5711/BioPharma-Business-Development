import type { z } from "zod";
import { env } from "@/lib/env";
import type { LlmProvider } from "./types";

const API = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";
const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 2;

export interface LlmCallMeta {
  requestId: string | null;
  model: string;
  stopReason: string | null;
  usage: { input_tokens?: number; output_tokens?: number } | null;
  /** Web-search / other server tool invocations, for cost visibility. */
  serverToolUse?: Record<string, number> | null;
}

export interface WebSearchCitation {
  url: string;
  title: string;
  /** Cited text snippet from the page. */
  citedText?: string;
}

export interface ResearchResult {
  text: string;
  citations: WebSearchCitation[];
  meta: LlmCallMeta;
}

export class AnthropicError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId: string | null,
  ) {
    super(message);
    this.name = "AnthropicError";
  }
}

/**
 * Anthropic Messages provider over fetch (no SDK). Adds: per-request timeout,
 * bounded retries with backoff on 429/5xx, request-id + usage capture, and an
 * optional `research()` path that uses the hosted `web_search` tool.
 */
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";

  private async raw(
    body: Record<string, unknown>,
    opts: { timeoutMs?: number; signal?: AbortSignal } = {},
  ): Promise<{ json: AnthropicResponse; requestId: string | null }> {
    if (!env.ANTHROPIC_API_KEY) {
      throw new AnthropicError("ANTHROPIC_API_KEY is not set (LLM_PROVIDER=anthropic)", 0, null);
    }

    let lastErr: unknown = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const ctl = new AbortController();
      const onAbort = () => ctl.abort();
      opts.signal?.addEventListener("abort", onAbort, { once: true });
      const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      try {
        const res = await fetch(API, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": VERSION,
          },
          body: JSON.stringify({ model: env.LLM_MODEL, max_tokens: 2048, ...body }),
          signal: ctl.signal,
        });
        const requestId = res.headers.get("request-id");

        if (res.status === 429 || res.status >= 500) {
          lastErr = new AnthropicError(
            `Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`,
            res.status,
            requestId,
          );
          if (attempt < MAX_RETRIES) {
            await sleep(400 * 2 ** attempt + Math.random() * 200);
            continue;
          }
          throw lastErr;
        }
        if (!res.ok) {
          throw new AnthropicError(
            `Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`,
            res.status,
            requestId,
          );
        }
        return { json: (await res.json()) as AnthropicResponse, requestId };
      } catch (err) {
        if (err instanceof AnthropicError) throw err;
        lastErr = err;
        if ((err as Error)?.name === "AbortError" && opts.signal?.aborted) {
          throw new AnthropicError("request cancelled", 499, null);
        }
        if (attempt < MAX_RETRIES) {
          await sleep(400 * 2 ** attempt);
          continue;
        }
        throw new AnthropicError(
          `Anthropic request failed: ${(err as Error)?.message ?? "unknown"}`,
          0,
          null,
        );
      } finally {
        clearTimeout(timer);
        opts.signal?.removeEventListener("abort", onAbort);
      }
    }
    throw (lastErr as Error) ?? new AnthropicError("Anthropic request failed", 0, null);
  }

  private textOf(json: AnthropicResponse): string {
    return (json.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("");
  }

  private metaOf(json: AnthropicResponse, requestId: string | null): LlmCallMeta {
    return {
      requestId,
      model: json.model ?? env.LLM_MODEL,
      stopReason: json.stop_reason ?? null,
      usage: json.usage ?? null,
      serverToolUse: json.usage?.server_tool_use ?? null,
    };
  }

  async generateText(args: {
    system?: string;
    prompt: string;
    temperature?: number;
    signal?: AbortSignal;
    timeoutMs?: number;
  }): Promise<string> {
    const { json } = await this.raw(
      {
        system: args.system,
        temperature: args.temperature ?? 0.4,
        messages: [{ role: "user", content: args.prompt }],
      },
      { signal: args.signal, timeoutMs: args.timeoutMs },
    );
    return this.textOf(json);
  }

  /** Free-form text plus the call metadata (request id, model, usage). */
  async generateTextRich(args: {
    system?: string;
    prompt: string;
    temperature?: number;
    signal?: AbortSignal;
    timeoutMs?: number;
  }): Promise<{ text: string; meta: LlmCallMeta }> {
    const { json, requestId } = await this.raw(
      {
        system: args.system,
        temperature: args.temperature ?? 0.4,
        messages: [{ role: "user", content: args.prompt }],
      },
      { signal: args.signal, timeoutMs: args.timeoutMs },
    );
    return { text: this.textOf(json), meta: this.metaOf(json, requestId) };
  }

  /**
   * Answer with the hosted `web_search` tool enabled. Returns the model's text
   * plus the citations it attached (url + title + cited snippet), so the UI can
   * show *current external sources* distinctly from workspace records.
   */
  async research(args: {
    system?: string;
    prompt: string;
    maxUses?: number;
    allowedDomains?: string[];
    signal?: AbortSignal;
    timeoutMs?: number;
  }): Promise<ResearchResult> {
    const { json, requestId } = await this.raw(
      {
        system: args.system,
        max_tokens: 3000,
        messages: [{ role: "user", content: args.prompt }],
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: args.maxUses ?? 4,
            ...(args.allowedDomains ? { allowed_domains: args.allowedDomains } : {}),
          },
        ],
      },
      { signal: args.signal, timeoutMs: args.timeoutMs ?? 60_000 },
    );

    const citations: WebSearchCitation[] = [];
    for (const block of json.content ?? []) {
      for (const cit of block.citations ?? []) {
        if (cit.type === "web_search_result_location" && cit.url) {
          citations.push({
            url: cit.url,
            title: cit.title ?? cit.url,
            citedText: cit.cited_text,
          });
        }
      }
    }
    return { text: this.textOf(json), citations: dedupeCitations(citations), meta: this.metaOf(json, requestId) };
  }

  async generateObject<T>(args: {
    system?: string;
    prompt: string;
    schema: z.ZodType<T>;
    temperature?: number;
    signal?: AbortSignal;
    timeoutMs?: number;
  }): Promise<T> {
    const instruction =
      "Respond with a single valid JSON object and nothing else. No markdown fences.";
    let lastErr = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const { json } = await this.raw(
        {
          system: [args.system, instruction].filter(Boolean).join("\n\n"),
          temperature: args.temperature ?? 0.2,
          messages: [
            {
              role: "user",
              content: lastErr
                ? `${args.prompt}\n\nYour previous reply failed validation:\n${lastErr}\nReturn corrected JSON.`
                : args.prompt,
            },
          ],
        },
        { signal: args.signal, timeoutMs: args.timeoutMs },
      );
      const parsed = args.schema.safeParse(safeJson(this.textOf(json)));
      if (parsed.success) return parsed.data;
      lastErr = parsed.error.message;
    }
    throw new AnthropicError(`structured output failed validation: ${lastErr}`, 0, null);
  }
}

interface AnthropicResponse {
  model?: string;
  stop_reason?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    server_tool_use?: Record<string, number>;
  } | null;
  content?: {
    type: string;
    text?: string;
    citations?: {
      type: string;
      url?: string;
      title?: string;
      cited_text?: string;
    }[];
  }[];
}

function dedupeCitations(list: WebSearchCitation[]): WebSearchCitation[] {
  const seen = new Set<string>();
  const out: WebSearchCitation[] = [];
  for (const c of list) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    out.push(c);
  }
  return out;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return {};
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return {};
  }
}
