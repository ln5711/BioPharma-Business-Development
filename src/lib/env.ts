import { z } from "zod";

/**
 * Central, validated environment access. Import `env` anywhere instead of
 * touching `process.env` directly.
 *
 * Design choice: this must NOT throw at import time. `next build` loads every
 * route module during "Collecting page data", so a single malformed variable
 * in the deploy environment would otherwise fail the whole build. Instead each
 * field falls back to its default and logs one warning — misconfiguration is
 * visible in the logs without bricking the deploy. Values are trimmed; the
 * provider enum is also lowercased before validation.
 */
const trimmed = (fallback = "") =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string(),
  ).catch(fallback);

const schema = z.object({
  DATABASE_URL: trimmed(""),
  PGLITE_DATA_DIR: trimmed("./.pglite").transform((v) => v || "./.pglite"),

  LLM_PROVIDER: z
    .preprocess(
      (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
      z.enum(["anthropic", "openai", "mock"]),
    )
    .catch("mock"),
  LLM_MODEL: trimmed("claude-sonnet-5").transform((v) => v || "claude-sonnet-5"),
  ANTHROPIC_API_KEY: trimmed(""),
  OPENAI_API_KEY: trimmed(""),

  CLINICALTRIALS_BASE_URL: trimmed("https://clinicaltrials.gov/api/v2").transform(
    (v) => v || "https://clinicaltrials.gov/api/v2",
  ),
  CLINICALTRIALS_USER_AGENT: trimmed("oncology-bd-platform/0.1").transform(
    (v) => v || "oncology-bd-platform/0.1",
  ),

  NCBI_API_KEY: trimmed(""),
  CROSSREF_MAILTO: trimmed(""),

  CRON_SECRET: trimmed("dev-only-change-me").transform(
    (v) => v || "dev-only-change-me",
  ),
});

const raw = {
  DATABASE_URL: process.env.DATABASE_URL,
  PGLITE_DATA_DIR: process.env.PGLITE_DATA_DIR,
  LLM_PROVIDER: process.env.LLM_PROVIDER,
  LLM_MODEL: process.env.LLM_MODEL,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  CLINICALTRIALS_BASE_URL: process.env.CLINICALTRIALS_BASE_URL,
  CLINICALTRIALS_USER_AGENT: process.env.CLINICALTRIALS_USER_AGENT,
  NCBI_API_KEY: process.env.NCBI_API_KEY,
  CROSSREF_MAILTO: process.env.CROSSREF_MAILTO,
  CRON_SECRET: process.env.CRON_SECRET,
};

export const env = schema.parse(raw);

// One-time visibility for values that were provided but rejected and fell back.
if (
  typeof process.env.LLM_PROVIDER === "string" &&
  process.env.LLM_PROVIDER.trim() !== "" &&
  env.LLM_PROVIDER !== process.env.LLM_PROVIDER.trim().toLowerCase()
) {
  console.warn(
    `[env] LLM_PROVIDER=${JSON.stringify(process.env.LLM_PROVIDER)} is not one of ` +
      `anthropic|openai|mock — falling back to "mock".`,
  );
}

export const usingPglite = env.DATABASE_URL.trim() === "";
