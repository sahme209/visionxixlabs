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
// GCP Adapter — production-ready for read operations
//
// Status:
//   validateConnection — IMPLEMENTED (lists projects + regions, probes Compute & Storage)
//   collectSnapshot    — IMPLEMENTED (Compute Engine + Cloud Storage + metrics)
//   estimateCosts      — IMPLEMENTED (shared cost signal engine)
//   generatePlan       — IMPLEMENTED (shared execution plan engine)
//   verifyAction       — IMPLEMENTED (shared verification engine, read-only)
//   applyAction        — TODO: implement Compute Engine / Cloud Storage mutations
//   rollbackAction     — TODO: implement GCP rollback execution
// ---------------------------------------------------------------------------

export class GCPAdapter implements CloudProviderAdapter {
  readonly provider = "gcp" as const;

  async validateConnection(
    userId: string,
    credentialRef: string,
  ): Promise<AdapterResult<ConnectionValidation>> {
    try {
      const creds = await getCredentialProvider().getGCPCredentials(userId, credentialRef);
      if (!creds) {
        return { ok: false, error: "GCP credentials not found in vault.", code: "invalid_credentials" };
      }

      const mod = await import("@/lib/plugins/gcp/snapshot-generator");

      const projects = await mod.listProjects(creds.credentials);
      if (projects.length === 0) {
        return {
          ok: false,
          error: "No GCP projects accessible. Verify the service account has resourcemanager.projects.list permission or roles/browser on the organization.",
          code: "permission_denied",
        };
      }

      const regions = await mod.listRegions(creds.credentials, creds.projectId);

      const permissions = [
        "resourcemanager.projects.list",
      ];

      if (regions.length > 0) {
        permissions.push("compute.regions.list");
      }

      // Probe Compute Engine read access (best-effort)
      try {
        const { InstancesClient } = await import("@google-cloud/compute");
        const client = new InstancesClient({ credentials: creds.credentials });
        const iter = client.aggregatedListAsync({ project: creds.projectId, maxResults: 1 });
        await iter[Symbol.asyncIterator]().next();
        permissions.push("compute.instances.list");
      } catch { /* Compute read not available */ }

      // Probe Cloud Storage read access (best-effort)
      try {
        const { Storage } = await import("@google-cloud/storage");
        const storage = new Storage({ credentials: creds.credentials, projectId: creds.projectId });
        await storage.getBuckets({ project: creds.projectId, maxResults: 1 });
        permissions.push("storage.buckets.list");
      } catch { /* Storage read not available */ }

      return {
        ok: true,
        data: {
          connected: true,
          accountId: creds.projectId,
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
      const creds = await getCredentialProvider().getGCPCredentials(userId, credentialRef);
      if (!creds) {
        return { ok: false, error: "GCP credentials not found in vault.", code: "invalid_credentials" };
      }

      const mod = await import("@/lib/plugins/gcp/snapshot-generator");
      const snapshot = await mod.generateGCPSnapshot(creds.credentials, creds.projectId);
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
    // TODO: Implement GCP mutations using Compute Engine REST API:
    //   resize_compute:
    //     1. instances.stop(project, zone, instance)
    //     2. instances.setMachineType(project, zone, instance, { machineType })
    //     3. instances.start(project, zone, instance)
    //   apply_storage_policy:
    //     1. Build lifecycle JSON config
    //     2. buckets.patch(bucket, { lifecycle: config })
    return notImplemented("GCP", "applyAction");
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
    // TODO: Implement GCP rollback execution:
    //   resize_compute: stop → set-machine-type back → start
    //   apply_storage_policy: gsutil lifecycle set /dev/null gs://bucket
    return notImplemented("GCP", "rollbackAction");
  }
}
