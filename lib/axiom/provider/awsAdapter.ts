import { getCredentialProvider } from "@/lib/plugins/credentials";
import type { CloudSnapshot } from "../cloudSnapshot";
import { deriveCostSignals } from "../costSignals";
import type { CostSummary } from "../costSignals";
import { generateExecutionPlan as genPlan } from "../executionPlan";
import type { ExecutionPlan, ExecutionPlanItem } from "../executionPlan";
import { getHandlersForProvider } from "../applyEngine";
import { verifyAppliedAction } from "../verificationEngine";
import type { VerificationResult } from "../verificationEngine";
import { generateRollbackPlan } from "../rollbackPlanner";
import type { RollbackPlan } from "../rollbackPlanner";

import type {
  CloudProviderAdapter,
  AdapterResult,
  ConnectionValidation,
  ApplyActionResult,
} from "./types";
import { adapterError } from "./types";

// ---------------------------------------------------------------------------
// AWS Adapter — production-ready, delegates to existing modules
// ---------------------------------------------------------------------------

export class AWSAdapter implements CloudProviderAdapter {
  readonly provider = "aws" as const;

  async validateConnection(
    userId: string,
    credentialRef: string,
  ): Promise<AdapterResult<ConnectionValidation>> {
    try {
      const creds = await getCredentialProvider().getAWSCredentials(userId, credentialRef);
      if (!creds) {
        return { ok: false, error: "AWS credentials not found in vault.", code: "invalid_credentials" };
      }

      // STS GetCallerIdentity — lightweight auth check, no IAM permissions needed
      const { STSClient, GetCallerIdentityCommand } = await import("@aws-sdk/client-sts");
      const sts = new STSClient({ credentials: creds, region: "us-east-1" });
      const identity = await sts.send(new GetCallerIdentityCommand({}));

      // EC2 DescribeRegions — confirms read access and lists available regions
      const { EC2Client, DescribeRegionsCommand } = await import("@aws-sdk/client-ec2");
      const ec2 = new EC2Client({ credentials: creds, region: "us-east-1" });
      const regionsResp = await ec2.send(new DescribeRegionsCommand({ AllRegions: false }));
      const regions = (regionsResp.Regions ?? []).map((r) => r.RegionName).filter(Boolean) as string[];

      return {
        ok: true,
        data: {
          connected: true,
          accountId: identity.Account ?? "",
          regions,
          permissions: ["sts:GetCallerIdentity", "ec2:DescribeRegions", "ec2:DescribeInstances"],
        },
      };
    } catch (e) {
      return adapterError("connection_failed", e);
    }
  }

  async collectSnapshot(
    userId: string,
    credentialRef: string,
  ): Promise<AdapterResult<CloudSnapshot>> {
    try {
      const creds = await getCredentialProvider().getAWSCredentials(userId, credentialRef);
      if (!creds) {
        return { ok: false, error: "AWS credentials not found in vault.", code: "invalid_credentials" };
      }

      const mod = await import("@/lib/plugins/aws/snapshot-generator");
      const snapshot = await mod.generateAWSSnapshot(creds);
      return { ok: true, data: snapshot };
    } catch (e) {
      return adapterError("snapshot_failed", e);
    }
  }

  estimateCosts(snapshot: CloudSnapshot): AdapterResult<CostSummary> {
    try {
      const summary = deriveCostSignals(snapshot);
      return { ok: true, data: summary };
    } catch (e) {
      return adapterError("unknown", e);
    }
  }

  generateExecutionPlan(snapshot: CloudSnapshot): AdapterResult<ExecutionPlan> {
    try {
      const plan = genPlan(snapshot);
      return { ok: true, data: plan };
    } catch (e) {
      return adapterError("unknown", e);
    }
  }

  async applyAction(item: ExecutionPlanItem): Promise<AdapterResult<ApplyActionResult>> {
    const handlers = getHandlersForProvider("aws");
    const handler = handlers[item.actionType];
    if (!handler) {
      return { ok: false, error: `No AWS handler for action type: ${item.actionType}`, code: "apply_failed" };
    }

    try {
      const result = await handler.apply(item);
      return result.success
        ? { ok: true, data: { success: true, message: result.message, resourceIds: item.resourceIds, simulated: result.simulated } }
        : { ok: false, error: result.message, code: "apply_failed" };
    } catch (e) {
      return adapterError("apply_failed", e);
    }
  }

  verifyAction(item: ExecutionPlanItem): AdapterResult<VerificationResult> {
    try {
      const result = verifyAppliedAction(item);
      return { ok: true, data: result };
    } catch (e) {
      return adapterError("verify_failed", e);
    }
  }

  async rollbackAction(item: ExecutionPlanItem): Promise<AdapterResult<RollbackPlan>> {
    try {
      const plan = generateRollbackPlan(item);
      return { ok: true, data: plan };
    } catch (e) {
      return adapterError("rollback_failed", e);
    }
  }
}
