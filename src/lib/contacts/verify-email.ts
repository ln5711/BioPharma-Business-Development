import "server-only";

/**
 * Deliverability verification is a SEPARATE, optional capability from email
 * discovery. Nothing in this codebase fabricates a "verified" result: unless a
 * real provider is configured via env vars, every address stays
 * `not_checked` — which is the honest, correct default per spec.
 *
 * To enable real verification, set EMAIL_VERIFY_PROVIDER (e.g. "generic") and
 * EMAIL_VERIFY_API_URL / EMAIL_VERIFY_API_KEY for that provider, and implement
 * the fetch below. No provider is wired up in this change.
 */
export type Deliverability = "not_checked" | "verified" | "undeliverable" | "unknown_catch_all";

export function deliverabilityProviderConfigured(): boolean {
  return Boolean(process.env.EMAIL_VERIFY_PROVIDER && process.env.EMAIL_VERIFY_API_KEY);
}

export async function checkDeliverability(email: string): Promise<Deliverability> {
  void email; // no provider is wired up in this change — see the module doc
  if (!deliverabilityProviderConfigured()) return "not_checked";
  // Configuring the env vars alone must not fabricate a result.
  return "not_checked";
}
