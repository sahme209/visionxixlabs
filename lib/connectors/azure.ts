import type { ConnectorStatus } from "./types";
import { ENABLE_CLOUD_CONNECTORS_AZURE } from "@/lib/featureFlags";

/**
 * Phase 5: Azure connector — stub read-only placeholder.
 * When ENABLE_CLOUD_CONNECTORS_AZURE=false, connector is unavailable (no real validation).
 */
export function validateAzureConnection(
  _creds: { tenantId?: string; clientId?: string; clientSecret?: string; subscriptionId?: string }
): { valid: boolean; status: ConnectorStatus; error?: string } {
  if (!ENABLE_CLOUD_CONNECTORS_AZURE) {
    return { valid: false, status: "unavailable", error: "Azure connector not yet available. Coming soon." };
  }
  return { valid: true, status: "linked" };
}
