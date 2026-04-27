/**
 * GCP Cloud Connector — implements CloudConnectorInterface.
 * Wraps validateGCPConnection and delegates discover/scan/fix to execution plugins.
 */

import "@/lib/plugins/gcp";

import type {
  CloudConnectorInterface,
  CloudConnectorContext,
  ValidateConnectionResult,
  CloudOperationResult,
} from "./interface";
import { validateGCPConnection, type GCPServiceAccountInput } from "./gcp";
import { executePlugin } from "@/lib/execution/pluginEngine";

const INFRA_DISCOVERY_PLUGIN = "gcp:infra-discovery";
const SECURITY_SCAN_PLUGIN = "gcp:security-scan";

export class GCPConnector implements CloudConnectorInterface {
  readonly provider = "gcp" as const;

  async validateConnection(
    input: Record<string, unknown>,
    context?: CloudConnectorContext
  ): Promise<ValidateConnectionResult> {
    const gcpInput: GCPServiceAccountInput = {
      projectId: String(input?.projectId ?? ""),
      serviceAccountJson: String(input?.serviceAccountJson ?? ""),
    };
    const result = await validateGCPConnection(gcpInput, {
      userId: context?.userId,
      leadId: context?.leadId,
    });
    return {
      valid: result.valid,
      status: result.status,
      account: result.projectId,
      errorCode: result.errorCode,
    };
  }

  async discoverInfrastructure(context: CloudConnectorContext): Promise<CloudOperationResult> {
    const result = await executePlugin({
      pluginId: INFRA_DISCOVERY_PLUGIN,
      input: {},
      ctx: {
        userId: context.userId,
        leadId: context.leadId,
        dryRun: true,
        userPlan: context.userPlan,
        credentialsKey: context.credentialsKey,
      },
    });
    return toCloudOperationResult(result);
  }

  async runSecurityScan(context: CloudConnectorContext): Promise<CloudOperationResult> {
    const result = await executePlugin({
      pluginId: SECURITY_SCAN_PLUGIN,
      input: {},
      ctx: {
        userId: context.userId,
        leadId: context.leadId,
        dryRun: true,
        userPlan: context.userPlan,
        credentialsKey: context.credentialsKey,
      },
    });
    return toCloudOperationResult(result);
  }

  async applyFix(
    _input: Record<string, unknown>,
    _context: CloudConnectorContext
  ): Promise<CloudOperationResult> {
    return {
      ok: false,
      error: "GCP remediation plugins coming soon.",
      summary: "Not yet available",
    };
  }
}

function toCloudOperationResult(r: {
  status: string;
  data?: Record<string, unknown>;
  error?: string;
  resultSummary?: string;
  executionId?: string;
}): CloudOperationResult {
  return {
    ok: r.status === "success",
    data: r.data,
    error: r.error,
    summary: r.resultSummary,
    executionId: r.executionId,
  };
}
