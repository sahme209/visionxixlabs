/**
 * Rollback planner — produces a typed RollbackPlan for every execution plan.
 *
 * Three rollback strategies:
 *   - snapshot_restore  (AMI/snapshot → restore)
 *   - state_restore     (Terraform state from operational memory → re-apply)
 *   - manual            (no automated rollback; manual steps documented)
 *
 * If rollback is not possible, the planner clearly says so and surfaces a
 * "rollback.required_before_approval = true" flag so the approval center
 * blocks the plan.
 */

import type { ReasonedRecommendation } from "@/lib/agent/snapshotReasoner";
import type { ResourceRef } from "@/lib/cloud/snapshotModel";

export type RollbackStrategy = "snapshot_restore" | "state_restore" | "manual" | "none";

export interface RollbackPlan {
  strategy: RollbackStrategy;
  /** Measured / estimated time-to-restore. */
  rtoSec: number;
  /** Steps to execute the rollback. */
  steps: { number: number; description: string; command?: string }[];
  /** Manual fallback steps when automation is impossible. */
  manualFallback?: string[];
  /** Post-rollback verification checks. */
  verification: { description: string; command?: string }[];
  /** Honest warnings — e.g., data loss possible. */
  warnings: string[];
  /** Confidence in successful rollback in [0, 1]. */
  confidence: number;
  /** Limitations of this rollback. */
  limitations: string[];
  /** Whether approval flow must surface this rollback to the approver. */
  requiredBeforeApproval: boolean;
}

interface PlannerOptions {
  /** Operational memory says we've successfully rolled back this action class N times. */
  successHistoryCount?: number;
}

/**
 * Build a rollback plan for a recommendation + affected resources.
 */
export function planRollback(
  rec: ReasonedRecommendation,
  affectedResources: ResourceRef[],
  options: PlannerOptions = {}
): RollbackPlan {
  const action = rec.action.toLowerCase();
  const provider = affectedResources[0]?.provider ?? "aws";
  const successCount = options.successHistoryCount ?? 0;

  // Right-sizing → AMI/snapshot restore
  if (/right-?size/.test(action)) {
    return planRightsizeRollback(rec, affectedResources, provider, successCount);
  }
  // Tagging → simple inverse
  if (/tag/.test(action)) {
    return planTagRollback(rec, affectedResources, provider, successCount);
  }
  // Lifecycle policy → state restore
  if (/lifecycle/.test(action)) {
    return planLifecycleRollback(rec, affectedResources, provider, successCount);
  }
  // Destructive intent → manual / blocked
  if (/destroy|delete|terminate|drop|remove/.test(action)) {
    return planDestructiveRollback(rec, affectedResources, provider);
  }

  // Default — generic state restore via Terraform
  return planGenericStateRollback(rec, affectedResources, provider, successCount);
}

// ---------------------------------------------------------------------------
// Specific rollback strategies
// ---------------------------------------------------------------------------

function planRightsizeRollback(rec: ReasonedRecommendation, refs: ResourceRef[], provider: string, successCount: number): RollbackPlan {
  void provider;
  return {
    strategy: "snapshot_restore",
    rtoSec: 60,
    steps: [
      { number: 1, description: "Stop the modified instance" },
      { number: 2, description: "Restore prior instance type from pre-flight AMI ID" },
      { number: 3, description: "Start the instance" },
      { number: 4, description: "Wait for ALB target to return to healthy state" },
    ],
    verification: [
      { description: "Verify instance type matches pre-flight value", command: `aws ec2 describe-instances --instance-ids ${refs[0]?.id ?? "<id>"} --query 'Reservations[].Instances[].InstanceType'` },
      { description: "Confirm ALB health checks pass" },
      { description: "Verify CPU/memory metrics return to baseline" },
    ],
    warnings: ["Instance is unavailable during the rollback window (~60 seconds)."],
    confidence: Math.min(0.98, 0.85 + successCount * 0.005),
    limitations: ["Rollback cannot recover application-layer data created on the rightsized instance."],
    requiredBeforeApproval: false,
  };
}

function planTagRollback(rec: ReasonedRecommendation, refs: ResourceRef[], provider: string, successCount: number): RollbackPlan {
  void provider;
  return {
    strategy: "state_restore",
    rtoSec: 5,
    steps: [
      { number: 1, description: "Remove Axiom-applied tags", command: `aws ec2 delete-tags --resources ${refs.map((r) => r.id).join(" ")} --tags Key=Managed_By Key=Plan_Id` },
    ],
    verification: [
      { description: "Confirm prior tag set is intact", command: `aws ec2 describe-tags --filters Name=resource-id,Values=${refs.map((r) => r.id).join(",")}` },
    ],
    warnings: [],
    confidence: Math.min(0.99, 0.95 + successCount * 0.005),
    limitations: [],
    requiredBeforeApproval: false,
  };
}

function planLifecycleRollback(rec: ReasonedRecommendation, refs: ResourceRef[], provider: string, successCount: number): RollbackPlan {
  void provider;
  return {
    strategy: "state_restore",
    rtoSec: 15,
    steps: [
      { number: 1, description: "Restore prior bucket lifecycle config from pre-flight capture", command: `aws s3api put-bucket-lifecycle-configuration --bucket <name> --lifecycle-configuration file://${rec.id}_lifecycle_prior.json` },
    ],
    verification: [
      { description: "Confirm lifecycle config matches pre-flight snapshot", command: `aws s3api get-bucket-lifecycle-configuration --bucket <name>` },
    ],
    warnings: [
      "Objects already transitioned to a colder storage class cannot be moved back automatically.",
      "Some lifecycle effects (object transitions) are not reversible.",
    ],
    confidence: Math.min(0.92, 0.80 + successCount * 0.005),
    limitations: ["Lifecycle policy rollback does not retro-actively un-transition objects."],
    requiredBeforeApproval: true, // Force the approver to see the limitation
  };
}

function planDestructiveRollback(rec: ReasonedRecommendation, refs: ResourceRef[], provider: string): RollbackPlan {
  void rec;
  void provider;
  return {
    strategy: "manual",
    rtoSec: 0,
    steps: [],
    manualFallback: [
      "Destructive actions cannot be programmatically rolled back.",
      `Confirm with the resource owner before approval.`,
      "Re-create resources from snapshots, AMIs, backups, or IaC if needed.",
      "Restore data from S3 / RDS / EBS backups separately.",
    ],
    verification: [
      { description: "Manually verify replacement resources match prior state" },
    ],
    warnings: [
      "Destructive actions have no automated rollback path.",
      "Data and resources may be lost permanently.",
    ],
    confidence: 0.0,
    limitations: ["No automated rollback exists for destructive operations."],
    requiredBeforeApproval: true,
  };
}

function planGenericStateRollback(rec: ReasonedRecommendation, refs: ResourceRef[], provider: string, successCount: number): RollbackPlan {
  void rec;
  void provider;
  return {
    strategy: "state_restore",
    rtoSec: 30,
    steps: [
      { number: 1, description: "Re-apply pre-flight Terraform state from operational memory" },
      { number: 2, description: "Wait for provider to reconcile" },
    ],
    verification: [
      { description: "Verify resource state matches pre-flight capture for each affected resource" },
    ],
    warnings: [],
    confidence: Math.min(0.90, 0.75 + successCount * 0.005),
    limitations: ["State restore depends on operational memory having captured a usable pre-flight snapshot."],
    requiredBeforeApproval: false,
  };
}
