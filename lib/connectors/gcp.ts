import type { ConnectorStatus } from "./types";
import { ENABLE_CLOUD_CONNECTORS_GCP } from "@/lib/featureFlags";

/**
 * Phase 5: GCP connector — stub read-only placeholder.
 * When ENABLE_CLOUD_CONNECTORS_GCP=false, connector is unavailable (no real validation).
 */
export function validateGcpConnection(
  _creds: { projectId?: string; serviceAccountJson?: string }
): { valid: boolean; status: ConnectorStatus; error?: string } {
  if (!ENABLE_CLOUD_CONNECTORS_GCP) {
    return { valid: false, status: "unavailable", error: "GCP connector not yet available. Coming soon." };
  }
  return { valid: true, status: "linked" };
}
