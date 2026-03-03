/**
 * Azure Cloud Connector — placeholder implementing CloudConnectorInterface.
 * Real implementation will use Azure SDK for validation, discovery, and scans.
 */

import type {
  CloudConnectorInterface,
  CloudConnectorContext,
  ValidateConnectionResult,
  CloudOperationResult,
} from "./interface";
import { ENABLE_CLOUD_CONNECTORS_AZURE } from "@/lib/featureFlags";

const NOT_AVAILABLE: CloudOperationResult = {
  ok: false,
  error: "Azure connector not yet available. Coming soon.",
  summary: "Coming soon",
};

export class AzureConnector implements CloudConnectorInterface {
  readonly provider = "azure" as const;

  async validateConnection(
    _input: Record<string, unknown>,
    _context?: CloudConnectorContext
  ): Promise<ValidateConnectionResult> {
    if (!ENABLE_CLOUD_CONNECTORS_AZURE) {
      return {
        valid: false,
        status: "unavailable",
        errorCode: "FEATURE_DISABLED",
        error: "Azure connector not yet available. Coming soon.",
      };
    }
    return { valid: true, status: "linked" };
  }

  async discoverInfrastructure(_context: CloudConnectorContext): Promise<CloudOperationResult> {
    return NOT_AVAILABLE;
  }

  async runSecurityScan(_context: CloudConnectorContext): Promise<CloudOperationResult> {
    return NOT_AVAILABLE;
  }

  async applyFix(
    _input: Record<string, unknown>,
    _context: CloudConnectorContext
  ): Promise<CloudOperationResult> {
    return NOT_AVAILABLE;
  }
}
