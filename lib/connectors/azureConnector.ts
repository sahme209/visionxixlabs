/**
 * Azure Cloud Connector — implements CloudConnectorInterface.
 * Wraps validateAzureConnection and delegates discover/scan/fix to execution plugins.
 */

import "@/lib/plugins/azure";

import type {
  CloudConnectorInterface,
  CloudConnectorContext,
  ValidateConnectionResult,
  CloudOperationResult,
} from "./interface";
import { validateAzureConnection, type AzureServicePrincipalInput } from "./azure";
import { executePlugin } from "@/lib/execution/pluginEngine";

const INFRA_DISCOVERY_PLUGIN = "azure:infra-discovery";
const SECURITY_SCAN_PLUGIN = "azure:security-scan";

export class AzureConnector implements CloudConnectorInterface {
  readonly provider = "azure" as const;

  async validateConnection(
    input: Record<string, unknown>,
    context?: CloudConnectorContext
  ): Promise<ValidateConnectionResult> {
    const azureInput: AzureServicePrincipalInput = {
      tenantId: String(input?.tenantId ?? ""),
      clientId: String(input?.clientId ?? ""),
      clientSecret: String(input?.clientSecret ?? ""),
      subscriptionId: input?.subscriptionId ? String(input.subscriptionId) : undefined,
    };
    const result = await validateAzureConnection(azureInput, {
      userId: context?.userId,
      leadId: context?.leadId,
    });
    return {
      valid: result.valid,
      status: result.status,
      account: result.subscriptionId,
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
      error: "Azure remediation plugins coming soon.",
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
