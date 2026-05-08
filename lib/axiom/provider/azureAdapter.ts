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
// Azure Adapter — production-ready for read operations
//
// Status:
//   validateConnection — IMPLEMENTED (lists subscriptions + resource groups)
//   collectSnapshot    — IMPLEMENTED (VMs + Storage + Resource Groups + Blobs)
//   estimateCosts      — IMPLEMENTED (shared cost signal engine)
//   generatePlan       — IMPLEMENTED (shared execution plan engine)
//   verifyAction       — IMPLEMENTED (shared verification engine, read-only)
//   applyAction        — TODO: implement Azure Compute/Storage mutations
//   rollbackAction     — TODO: implement Azure rollback execution
// ---------------------------------------------------------------------------

export class AzureAdapter implements CloudProviderAdapter {
  readonly provider = "azure" as const;

  async validateConnection(
    userId: string,
    credentialRef: string,
  ): Promise<AdapterResult<ConnectionValidation>> {
    try {
      const creds = await getCredentialProvider().getAzureCredentials(userId, credentialRef);
      if (!creds) {
        return { ok: false, error: "Azure credentials not found in vault.", code: "invalid_credentials" };
      }

      const mod = await import("@/lib/plugins/azure/snapshot-generator");

      // List subscriptions to validate credentials and enumerate access
      const subs = await mod.listSubscriptions(creds.credential);
      if (subs.length === 0) {
        return {
          ok: false,
          error: "No Azure subscriptions accessible. Verify the Service Principal has Reader role on at least one subscription.",
          code: "permission_denied",
        };
      }

      // List resource groups in the target subscription for region discovery
      const resourceGroups = await mod.listResourceGroups(creds.credential, creds.subscriptionId);
      const regions = [...new Set(resourceGroups.map((rg) => rg.location))].filter(Boolean);

      const permissions = [
        "Microsoft.Resources/subscriptions/read",
        "Microsoft.Resources/subscriptions/resourceGroups/read",
      ];

      // Probe VM read access (best-effort)
      try {
        const { ComputeManagementClient } = await import("@azure/arm-compute");
        const compute = new ComputeManagementClient(creds.credential, creds.subscriptionId);
        const iter = compute.virtualMachines.listAll({ statusOnly: "true" });
        await iter.next();
        permissions.push("Microsoft.Compute/virtualMachines/read");
      } catch { /* VM read not available */ }

      // Probe storage read access (best-effort)
      try {
        const { StorageManagementClient } = await import("@azure/arm-storage");
        const storage = new StorageManagementClient(creds.credential, creds.subscriptionId);
        const iter = storage.storageAccounts.list();
        await iter.next();
        permissions.push("Microsoft.Storage/storageAccounts/read");
      } catch { /* Storage read not available */ }

      return {
        ok: true,
        data: {
          connected: true,
          accountId: creds.subscriptionId,
          regions: regions.length > 0 ? regions : ["unknown"],
          permissions,
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
