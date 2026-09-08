import { z } from "zod";

/**
 * Central, validated environment access. Import `env` anywhere instead of
 * touching `process.env` directly so misconfiguration fails fast and loudly.
 */
const schema = z.object({
  DATABASE_URL: z.string().optional().default(""),
  PGLITE_DATA_DIR: z.string().default("./.pglite"),

  LLM_PROVIDER: z.enum(["anthropic", "openai", "mock"]).default("mock"),
  LLM_MODEL: z.string().default("claude-sonnet-5"),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  OPENAI_API_KEY: z.string().optional().default(""),

  CLINICALTRIALS_BASE_URL: z
    .string()
    .default("https://clinicaltrials.gov/api/v2"),
  CLINICALTRIALS_USER_AGENT: z
    .string()
    .default("oncology-bd-platform/0.1"),

  NCBI_API_KEY: z.string().optional().default(""),
  CROSSREF_MAILTO: z.string().optional().default(""),

  CRON_SECRET: z.string().default("dev-only-change-me"),
});

export const env = schema.parse({
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
});

export const usingPglite = env.DATABASE_URL.trim() === "";
