import type { z } from "zod";
import { env } from "@/lib/env";
import type { LlmProvider } from "./types";

const API = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

/**
 * Minimal Anthropic Messages provider over fetch (no SDK dependency).
 * Structured output is requested as a single JSON object and validated with Zod;
 * on a validation miss we retry once with the errors fed back.
 */
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";

  private async call(body: Record<string, unknown>): Promise<string> {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set (LLM_PROVIDER=anthropic)");
    }
    const res = await fetch(API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": VERSION,
      },
      body: JSON.stringify({ model: env.LLM_MODEL, max_tokens: 2048, ...body }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { content: { type: string; text?: string }[] };
    return json.content.map((c) => c.text ?? "").join("");
  }

  async generateText(args: { system?: string; prompt: string; temperature?: number }) {
    return this.call({
      system: args.system,
      temperature: args.temperature ?? 0.4,
      messages: [{ role: "user", content: args.prompt }],
    });
  }

  async generateObject<T>(args: {
    system?: string;
    prompt: string;
    schema: z.ZodType<T>;
    temperature?: number;
  }): Promise<T> {
    const instruction =
      "Respond with a single valid JSON object and nothing else. No markdown fences.";
    let lastErr = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await this.call({
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
      });
      const parsed = args.schema.safeParse(safeJson(text));
      if (parsed.success) return parsed.data;
      lastErr = parsed.error.message;
    }
    throw new Error(`Anthropic structured output failed validation: ${lastErr}`);
  }
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
