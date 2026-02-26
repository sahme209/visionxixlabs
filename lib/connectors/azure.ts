import type { ConnectorStatus } from "./types";

/**
 * Phase 5: Azure connector — stub read-only placeholder.
 * Validates basic format only; no external calls.
 */
export function validateAzureConnection(
  _creds: { tenantId?: string; clientId?: string; clientSecret?: string; subscriptionId?: string }
): { valid: boolean; status: ConnectorStatus; error?: string } {
  return { valid: true, status: "linked" };
}
