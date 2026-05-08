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
// GCP Adapter
//
// Status:
//   collectSnapshot  — IMPLEMENTED (calls existing GCP snapshot generator)
//   estimateCosts    — IMPLEMENTED (shared cost signal engine)
//   generatePlan     — IMPLEMENTED (shared execution plan engine)
//   verifyAction     — IMPLEMENTED (shared verification engine, read-only)
//   validateConnection — TODO: implement GCP service account health check
//   applyAction        — TODO: implement Compute Engine / Cloud Storage mutations
//   rollbackAction     — TODO: implement GCP rollback execution
// ---------------------------------------------------------------------------

export class GCPAdapter implements CloudProviderAdapter {
  readonly provider = "gcp" as const;

  async validateConnection(
    _userId: string,
    _credentialRef: string,
  ): Promise<AdapterResult<ConnectionValidation>> {
    // TODO: Validate GCP service account credentials:
    //   1. Use google-auth-library to create JWT client
    //   2. Call projects.get(projectId) to verify access
    //   3. List compute.regions to confirm permissions
    return notImplemented("GCP", "validateConnection");
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
