import type { ExecutionPlan, ExecutionPlanItem, ActionType, RiskLevel } from "./executionPlan";
import type { CloudProvider } from "./cloudSnapshot";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RiskEntry = {
  itemId: string;
  actionType: ActionType;
  severity: RiskLevel;
  message: string;
  mitigation: string;
};

export type AffectedService = {
  resourceIds: string[];
  region: string;
  provider: CloudProvider;
  actionType: ActionType;
  impact: string;
};

export type DryRunResult = {
  summary: string;
  risks: RiskEntry[];
  affectedServices: AffectedService[];
  downtimeEstimate: string;
  rollbackComplexity: "trivial" | "moderate" | "complex";
  safeToApply: boolean;
  itemBreakdown: ItemDryRun[];
};

export type ItemDryRun = {
  itemId: string;
  actionType: ActionType;
  provider: CloudProvider;
  downtime: string;
  rollback: string;
  risk: RiskLevel;
};

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function simulateDryRun(plan: ExecutionPlan): DryRunResult {
  const risks: RiskEntry[] = [];
  const affected: AffectedService[] = [];
  const itemBreakdowns: ItemDryRun[] = [];

  for (const item of plan.items) {
    const assess = ASSESSORS[item.actionType];
    if (!assess) continue;

    const result = assess(item);
    risks.push(...result.risks);
    affected.push(result.affected);
    itemBreakdowns.push(result.breakdown);
  }

  const downtimeEstimate = aggregateDowntime(plan.items, plan.provider);
  const rollbackComplexity = aggregateRollbackComplexity(plan.items);
  const safeToApply = deriveSafety(risks, plan.items);

  const highCount = risks.filter((r) => r.severity === "high").length;
  const medCount = risks.filter((r) => r.severity === "medium").length;

  let summary: string;
  if (highCount > 0) {
    summary = `${plan.items.length} actions planned — ${highCount} high-risk item(s) detected. Manual review strongly recommended before applying.`;
  } else if (medCount > 0) {
    summary = `${plan.items.length} actions planned — ${medCount} medium-risk item(s). Review recommended, but generally safe with maintenance window.`;
  } else {
    summary = `${plan.items.length} actions planned — all low risk. Safe to apply during normal operations.`;
  }

  return {
    summary,
    risks,
    affectedServices: affected,
    downtimeEstimate,
    rollbackComplexity,
    safeToApply,
    itemBreakdown: itemBreakdowns,
  };
}

// ---------------------------------------------------------------------------
// Per-action assessors
// ---------------------------------------------------------------------------

type AssessorResult = {
  risks: RiskEntry[];
  affected: AffectedService;
  breakdown: ItemDryRun;
};

type Assessor = (item: ExecutionPlanItem) => AssessorResult;

const ASSESSORS: Record<string, Assessor> = {
  resize_compute: assessResizeCompute,
  apply_storage_policy: assessStoragePolicy,
  purchase_commitment: assessCommitment,
  decommission_compute: assessDecommission,
  restrict_public_access: assessRestrictPublicAccess,
  enable_backup: assessEnableBackup,
};

// ---- 1. Compute resize ----

function assessResizeCompute(item: ExecutionPlanItem): AssessorResult {
  const risks: RiskEntry[] = [];
  const downtime = RESIZE_DOWNTIME[item.provider];

  if (item.riskLevel === "high") {
    risks.push({
      itemId: item.id,
      actionType: item.actionType,
      severity: "high",
      message: `Resizing ${item.resourceIds.length} instance(s) with insufficient usage data — downsizing may cause performance degradation.`,
      mitigation: "Collect at least 7 days of CPU/memory metrics before resizing. Consider resizing one instance first as a canary.",
    });
  }

  if (item.resourceIds.length > 5) {
    risks.push({
      itemId: item.id,
      actionType: item.actionType,
      severity: "medium",
      message: `Batch resize of ${item.resourceIds.length} instances — simultaneous stop/start may cause capacity issues in ${item.region}.`,
      mitigation: "Apply in rolling batches of 2-3 instances with health checks between batches.",
    });
  }

  if (item.provider === "azure") {
    risks.push({
      itemId: item.id,
      actionType: item.actionType,
      severity: "medium",
      message: "Azure VM resize requires full deallocation — longer downtime than AWS/GCP stop/start.",
      mitigation: "Schedule during maintenance window. Verify no availability set constraints block the target size.",
    });
  }

  return {
    risks,
    affected: {
      resourceIds: item.resourceIds,
      region: item.region,
      provider: item.provider,
      actionType: item.actionType,
      impact: `${item.resourceIds.length} compute instance(s) will be temporarily stopped for resize`,
    },
    breakdown: {
      itemId: item.id,
      actionType: item.actionType,
      provider: item.provider,
      downtime: downtime,
      rollback: `Resize back to original instance type (${downtime})`,
      risk: item.riskLevel,
    },
  };
}

const RESIZE_DOWNTIME: Record<CloudProvider, string> = {
  aws: "~2-5 min per instance (stop → modify → start)",
  azure: "~5-10 min per instance (deallocate → resize → start)",
  gcp: "~2-5 min per instance (stop → set-machine-type → start)",
};

// ---- 2. Storage lifecycle policy ----

function assessStoragePolicy(item: ExecutionPlanItem): AssessorResult {
  const risks: RiskEntry[] = [];

  risks.push({
    itemId: item.id,
    actionType: item.actionType,
    severity: "low",
    message: `Applying tiering policy to ${item.resourceIds.length} storage resource(s) — no data movement on apply, transitions happen over time.`,
    mitigation: "Monitor access patterns for 30 days after enabling. Retrieval costs apply for archived data.",
  });

  if (item.resourceIds.length > 10) {
    risks.push({
      itemId: item.id,
      actionType: item.actionType,
      severity: "low",
      message: `Bulk policy change across ${item.resourceIds.length} resources — verify no hot-access buckets are included.`,
      mitigation: "Audit access logs before applying. Exclude buckets with frequent reads.",
    });
  }

  return {
    risks,
    affected: {
      resourceIds: item.resourceIds,
      region: item.region,
      provider: item.provider,
      actionType: item.actionType,
      impact: `${item.resourceIds.length} storage resource(s) will have lifecycle policies applied — no immediate data movement`,
    },
    breakdown: {
      itemId: item.id,
      actionType: item.actionType,
      provider: item.provider,
      downtime: "No downtime — policy applies asynchronously",
      rollback: "Remove lifecycle policy to stop future transitions (already-transitioned objects stay in new tier)",
      risk: item.riskLevel,
    },
  };
}

// ---- 3. Commitment purchase ----

function assessCommitment(item: ExecutionPlanItem): AssessorResult {
  const risks: RiskEntry[] = [];

  risks.push({
    itemId: item.id,
    actionType: item.actionType,
    severity: "medium",
    message: `Commitment purchase is a 1-year financial obligation (~$${item.estimatedSavings.yearly} estimated savings). Cannot be cancelled once purchased.`,
    mitigation: "Verify workload stability for at least 3 months before committing. Start with no-upfront to minimize lock-in risk.",
  });

  const coverageWarning = COMMITMENT_COVERAGE_WARNING[item.provider];
  if (coverageWarning) {
    risks.push({
      itemId: item.id,
      actionType: item.actionType,
      severity: "low",
      message: coverageWarning,
      mitigation: "Use the provider's commitment recommendation tool to validate coverage before purchasing.",
    });
  }

  return {
    risks,
    affected: {
      resourceIds: item.resourceIds,
      region: item.region,
      provider: item.provider,
      actionType: item.actionType,
      impact: `Financial commitment covering ${item.resourceIds.length} instance(s) — no infrastructure changes`,
    },
    breakdown: {
      itemId: item.id,
      actionType: item.actionType,
      provider: item.provider,
      downtime: "No downtime — billing change only",
      rollback: "Cannot cancel — commitment expires at term end. Do not auto-renew if workload changes.",
      risk: "medium",
    },
  };
}

const COMMITMENT_COVERAGE_WARNING: Record<CloudProvider, string> = {
  aws: "AWS Compute Savings Plans apply automatically but may under-cover if workload scales up.",
  azure: "Azure Reserved Instances are scoped to VM size family — verify target sizes match.",
  gcp: "GCP Committed Use Discounts are region-locked — verify all workloads are in the committed region.",
};

// ---- 4. Decommission ----

function assessDecommission(item: ExecutionPlanItem): AssessorResult {
  const risks: RiskEntry[] = [];

  risks.push({
    itemId: item.id,
    actionType: item.actionType,
    severity: "high",
    message: `Deleting ${item.resourceIds.length} instance(s) is irreversible. Attached volumes and data will be lost unless snapshotted first.`,
    mitigation: "Create snapshots of all attached volumes before deleting. Verify no other services depend on these instances.",
  });

  if (item.resourceIds.length > 3) {
    risks.push({
      itemId: item.id,
      actionType: item.actionType,
      severity: "high",
      message: `Bulk deletion of ${item.resourceIds.length} instances — high blast radius if any are incorrectly identified as unused.`,
      mitigation: "Delete one instance at a time with a 24-hour observation window between deletions.",
    });
  }

  return {
    risks,
    affected: {
      resourceIds: item.resourceIds,
      region: item.region,
      provider: item.provider,
      actionType: item.actionType,
      impact: `${item.resourceIds.length} stopped instance(s) and their volumes will be permanently deleted`,
    },
    breakdown: {
      itemId: item.id,
      actionType: item.actionType,
      provider: item.provider,
      downtime: "No downtime — instances are already stopped/deallocated",
      rollback: "Restore from snapshot → re-create instance (complex, requires manual steps)",
      risk: "high",
    },
  };
}

// ---- 5. Restrict public access ----

function assessRestrictPublicAccess(item: ExecutionPlanItem): AssessorResult {
  const risks: RiskEntry[] = [];

  risks.push({
    itemId: item.id,
    actionType: item.actionType,
    severity: "medium",
    message: `Restricting public access on ${item.resourceIds.length} storage resource(s). If any are intentionally public (e.g., CDN origin), this will break access.`,
    mitigation: "Verify which buckets are intentionally public before applying. Check for CDN origins or public website hosting.",
  });

  return {
    risks,
    affected: {
      resourceIds: item.resourceIds,
      region: item.region,
      provider: item.provider,
      actionType: item.actionType,
      impact: `${item.resourceIds.length} storage resource(s) will have public access removed`,
    },
    breakdown: {
      itemId: item.id,
      actionType: item.actionType,
      provider: item.provider,
      downtime: "No downtime — policy change only",
      rollback: "Re-enable public access on affected buckets if intentionally public",
      risk: item.riskLevel,
    },
  };
}

// ---- 6. Enable backup ----

function assessEnableBackup(item: ExecutionPlanItem): AssessorResult {
  const risks: RiskEntry[] = [];

  risks.push({
    itemId: item.id,
    actionType: item.actionType,
    severity: "low",
    message: `Enabling backup for ${item.resourceIds.length} resource(s). This adds ongoing storage costs (typically 5–15% of protected resource cost).`,
    mitigation: "Review backup retention policy and cross-region replication settings. Adjust retention period to control costs.",
  });

  return {
    risks,
    affected: {
      resourceIds: item.resourceIds,
      region: item.region,
      provider: item.provider,
      actionType: item.actionType,
      impact: `${item.resourceIds.length} resource(s) will have automated backup enabled — daily snapshots with 30-day retention`,
    },
    breakdown: {
      itemId: item.id,
      actionType: item.actionType,
      provider: item.provider,
      downtime: "No downtime — backup runs in the background",
      rollback: "Disable backup schedule and delete snapshot vault if no longer needed",
      risk: "low",
    },
  };
}

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

function aggregateDowntime(items: ExecutionPlanItem[], provider: CloudProvider): string {
  const resizes = items.filter((i) => i.actionType === "resize_compute");
  const decommissions = items.filter((i) => i.actionType === "decommission_compute");
  const storageChanges = items.filter((i) => i.actionType === "apply_storage_policy");
  const commitments = items.filter((i) => i.actionType === "purchase_commitment");

  if (resizes.length === 0 && decommissions.length === 0) {
    return "No downtime expected — all actions are non-disruptive.";
  }

  const parts: string[] = [];

  if (resizes.length > 0) {
    const totalInstances = resizes.reduce((s, r) => s + r.resourceIds.length, 0);
    const perInstance = provider === "azure" ? "5-10" : "2-5";
    const sequential = totalInstances * parseInt(perInstance.split("-")[1]);
    const rolling = parseInt(perInstance.split("-")[1]);

    parts.push(
      `Compute resize: ${totalInstances} instance(s) × ~${perInstance} min each = ~${sequential} min sequential, ~${rolling} min rolling`
    );
  }

  if (decommissions.length > 0) {
    const totalInstances = decommissions.reduce((s, r) => s + r.resourceIds.length, 0);
    parts.push(`Decommission: ${totalInstances} instance(s) — already stopped, no additional downtime`);
  }

  if (storageChanges.length > 0) {
    parts.push("Storage policy: no downtime");
  }

  if (commitments.length > 0) {
    parts.push("Commitment: no downtime (billing only)");
  }

  return parts.join(". ") + ".";
}

function aggregateRollbackComplexity(items: ExecutionPlanItem[]): "trivial" | "moderate" | "complex" {
  const hasDecommission = items.some((i) => i.actionType === "decommission_compute");
  const hasCommitment = items.some((i) => i.actionType === "purchase_commitment");
  const hasHighRisk = items.some((i) => i.riskLevel === "high");
  const totalActions = items.length;

  if (hasDecommission) return "complex";
  if (hasCommitment || hasHighRisk || totalActions > 5) return "moderate";
  return "trivial";
}

function deriveSafety(risks: RiskEntry[], items: ExecutionPlanItem[]): boolean {
  const highRisks = risks.filter((r) => r.severity === "high").length;
  const hasDecommission = items.some((i) => i.actionType === "decommission_compute");

  if (highRisks > 0) return false;
  if (hasDecommission) return false;

  return true;
}
