import type { ConnectorStatus } from "./types";
import { ENABLE_CLOUD_CONNECTORS_AWS } from "@/lib/featureFlags";

/**
 * Phase 5: AWS connector — stub read-only placeholder.
 * When ENABLE_CLOUD_CONNECTORS_AWS=false, connector is unavailable (no real validation).
 */
export function validateAwsConnection(
  _creds: { accessKeyId?: string; secretAccessKey?: string; region?: string }
): { valid: boolean; status: ConnectorStatus; error?: string } {
  if (!ENABLE_CLOUD_CONNECTORS_AWS) {
    return { valid: false, status: "unavailable", error: "AWS connector not yet available. Coming soon." };
  }
  return { valid: true, status: "linked" };
}
