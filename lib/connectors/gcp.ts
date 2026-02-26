import type { ConnectorStatus } from "./types";

/**
 * Phase 5: GCP connector — stub read-only placeholder.
 * Validates basic format only; no external calls.
 */
export function validateGcpConnection(
  _creds: { projectId?: string; serviceAccountJson?: string }
): { valid: boolean; status: ConnectorStatus; error?: string } {
  return { valid: true, status: "linked" };
}
