import { getCredentialProvider } from "@/lib/plugins/credentials";
import type { CloudSnapshot } from "../cloudSnapshot";
import { deriveCostSignals } from "../costSignals";
import type { CostSummary } from "../costSignals";
import { generateExecutionPlan as genPlan } from "../executionPlan";
import type { ExecutionPlan, ExecutionPlanItem } from "../executionPlan";
import { verifyAppliedAction } from "../verificationEngine";
import type { VerificationResult } from "../verificationEngine";
import type { RollbackPlan } from "../rollbackPlanner";

import type {
  CloudProviderAdapter,
  AdapterResult,
  ConnectionValidation,
  ApplyActionResult,
} from "./types";
import { notImplemented, adapterError } from "./types";

// ---------------------------------------------------------------------------
// Azure Adapter
//
// Status:
//   collectSnapshot  — IMPLEMENTED (calls existing Azure snapshot generator)
//   estimateCosts    — IMPLEMENTED (shared cost signal engine)
//   generatePlan     — IMPLEMENTED (shared execution plan engine)
//   verifyAction     — IMPLEMENTED (shared verification engine, read-only)
//   validateConnection — TODO: implement Azure Resource Manager health check
//   applyAction        — TODO: implement Azure Compute/Storage Management mutations
//   rollbackAction     — TODO: implement Azure rollback execution
// ---------------------------------------------------------------------------

export class AzureAdapter implements CloudProviderAdapter {
  readonly provider = "azure" as const;

  async validateConnection(
    _userId: string,
    _credentialRef: string,
  ): Promise<AdapterResult<ConnectionValidation>> {
    // TODO: Call Azure Resource Manager to validate credentials:
    //   1. Use @azure/identity DefaultAzureCredential or ClientSecretCredential
    //   2. Call subscriptions.list() to verify access
    //   3. Return subscription ID and available regions
    return notImplemented("Azure", "validateConnection");
  }

  async collectSnapshot(
    userId: string,
    credentialRef: string,
  ): Promise<AdapterResult<CloudSnapshot>> {
    try {
      const creds = await getCredentialProvider().getAzureCredentials(userId, credentialRef);
      if (!creds) {
        return { ok: false, error: "Azure credentials not found in vault.", code: "invalid_credentials" };
      }

      const mod = await import("@/lib/plugins/azure/snapshot-generator");
      const snapshot = await mod.generateAzureSnapshot(creds.credential, creds.subscriptionId);
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

  async applyAction(_item: ExecutionPlanItem): Promise<AdapterResult<ApplyActionResult>> {
    // TODO: Implement Azure mutations using Azure SDK:
    //   resize_compute:
    //     1. ComputeManagementClient.virtualMachines.beginDeallocate(rg, vmName)
    //     2. ComputeManagementClient.virtualMachines.beginUpdate(rg, vmName, { hardwareProfile: { vmSize } })
    //     3. ComputeManagementClient.virtualMachines.beginStart(rg, vmName)
    //   apply_storage_policy:
    //     1. StorageManagementClient.managementPolicies.createOrUpdate(rg, accountName, policy)
    return notImplemented("Azure", "applyAction");
  }

  verifyAction(item: ExecutionPlanItem): AdapterResult<VerificationResult> {
    try {
      const result = verifyAppliedAction(item);
      return { ok: true, data: result };
    } catch (e) {
      return adapterError("verify_failed", e);
    }
  }

  async rollbackAction(_item: ExecutionPlanItem): Promise<AdapterResult<RollbackPlan>> {
    // TODO: Implement Azure rollback execution:
    //   resize_compute: deallocate → resize back → start
    //   apply_storage_policy: delete management policy
    return notImplemented("Azure", "rollbackAction");
  }
}
