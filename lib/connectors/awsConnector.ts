/**
 * AWS Cloud Connector — implements CloudConnectorInterface.
 * Wraps validateAWSConnection and delegates discover/scan/fix to execution plugins.
 */

// Ensure AWS execution plugins are registered when connector runs
import "@/lib/plugins/aws";

import type {
  CloudConnectorInterface,
  CloudConnectorContext,
  ValidateConnectionResult,
  CloudOperationResult,
} from "./interface";
import { validateAWSConnection, type AWSAssumeRoleInput } from "./aws";
import { executePlugin } from "@/lib/execution/pluginEngine";

const INFRA_DISCOVERY_PLUGIN = "aws:infra-discovery";
const SECURITY_SCAN_PLUGIN = "aws:iam-readonly-scan";
const APPLY_FIX_PLUGIN = "aws:disable-unused-access-key";

export class AWSConnector implements CloudConnectorInterface {
  readonly provider = "aws" as const;

  async validateConnection(
    input: Record<string, unknown>,
    context?: CloudConnectorContext
  ): Promise<ValidateConnectionResult> {
    const awsInput: AWSAssumeRoleInput = {
      roleArn: String(input?.roleArn ?? ""),
      externalId: (input?.externalId as string) ?? null,
      region: (input?.region as string) ?? null,
      awsAccountId: String(input?.awsAccountId ?? ""),
    };
    return validateAWSConnection(awsInput, {
      userId: context?.userId,
      leadId: context?.leadId,
    });
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
    input: Record<string, unknown>,
    context: CloudConnectorContext
  ): Promise<CloudOperationResult> {
    const dryRun = context.dryRun ?? false;
    const result = await executePlugin({
      pluginId: APPLY_FIX_PLUGIN,
      input,
      ctx: {
        userId: context.userId,
        leadId: context.leadId,
        dryRun,
        userPlan: context.userPlan,
        credentialsKey: context.credentialsKey,
        userConfirmedApply: context.userConfirmedApply,
      },
    });
    return toCloudOperationResult(result);
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
