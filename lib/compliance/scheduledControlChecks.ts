/**
 * Scheduled compliance control checks — run by the cron route at
 * app/api/cron/compliance-control-check/route.ts.
 *
 * Deliberately narrow scope: only controls whose evidence kind in
 * CONTROL_REGISTRY is "config_value" — a runtime fact that can silently
 * drift false without any code change (a secret gets unset, rotated to
 * something too short, etc.) — and only via reading config/environment
 * state, never by probing a live security boundary (e.g. attempting a
 * cross-tenant read to "verify" tenant isolation actually holds). That
 * second category is a materially different, riskier kind of automation
 * that needs an explicit decision, not something to fold in here.
 */

import "server-only";

export interface ControlCheckResult {
  controlId: string;
  status: "pass" | "fail" | "error";
  detail: string;
}

/** Matches lib/security/credentialVault.ts's own getKey() validation exactly. */
function checkCredentialEncryptionKey(): ControlCheckResult {
  const controlId = "cs.vault.encryption";
  try {
    const secret = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.STARTER_TOKEN_SECRET;
    if (!secret) {
      return { controlId, status: "fail", detail: "Neither CREDENTIAL_ENCRYPTION_KEY nor STARTER_TOKEN_SECRET is set." };
    }
    if (secret.length < 32) {
      return { controlId, status: "fail", detail: "The configured secret is shorter than the required 32 characters." };
    }
    return { controlId, status: "pass", detail: "A credential-encryption secret of sufficient length is configured." };
  } catch (err) {
    return { controlId, status: "error", detail: err instanceof Error ? err.message : "Unknown error reading environment." };
  }
}

export function runScheduledControlChecks(): ControlCheckResult[] {
  return [checkCredentialEncryptionKey()];
}
