import type { ConnectorStatus } from "./types";

/**
 * Phase 5: AWS connector — stub read-only placeholder.
 * Validates basic format only; no external calls.
 */
export function validateAwsConnection(
  _creds: { accessKeyId?: string; secretAccessKey?: string; region?: string }
): { valid: boolean; status: ConnectorStatus; error?: string } {
  return { valid: true, status: "linked" };
}
