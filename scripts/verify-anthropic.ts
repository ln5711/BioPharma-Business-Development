/**
 * Proves the Claude connection with ONE real API request.
 *
 * Prints only non-sensitive telemetry — model, HTTP status, request-id, token
 * usage, stop reason. No secrets, no private content. Distinguish this from the
 * mocked test suite.
 *
 *   LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-... npx tsx scripts/verify-anthropic.ts
 *
 * The key is read from your shell environment — never pass it on the command
 * line in a shared terminal, and never paste it into chat.
 */
import "dotenv/config";

async function main() {
  const { llmStatus } = await import("@/lib/llm/status");
  const { anthropic } = await import("@/lib/llm");

  const status = llmStatus();
  console.log("config:", JSON.stringify(status));
  if (!status.configured) {
    console.error(`\n✖ not configured: ${status.reason}`);
    console.error("  set LLM_PROVIDER=anthropic and ANTHROPIC_API_KEY, then re-run.");
    process.exit(1);
  }

  const client = anthropic()!;
  const started = Date.now();
  const res = await client.generateTextRich({
    system: "Reply with exactly: OK",
    prompt: "Connectivity check. Reply with OK.",
    temperature: 0,
    timeoutMs: 20_000,
  });

  console.log("\n✔ real Anthropic request succeeded");
  console.log(
    JSON.stringify(
      {
        model: res.meta.model,
        requestId: res.meta.requestId,
        stopReason: res.meta.stopReason,
        usage: res.meta.usage,
        latencyMs: Date.now() - started,
        replyLength: res.text.trim().length,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((e) => {
  // Print the class + status, not the full body (may echo the request).
  console.error(`\n✖ request failed: ${(e as Error)?.name ?? "Error"} — ${(e as Error)?.message?.slice(0, 200)}`);
  process.exit(1);
});
