/**
 * Axiom Drift Detection Engine
 *
 * Detects when cloud infrastructure drifts from:
 *   - Generated Terraform plans (intended state)
 *   - Approved execution plans (sanctioned changes)
 *   - Previous snapshots (unexpected mutations)
 *   - Expected resilience posture (degradation)
 *
 * Design principles:
 *   - Deterministic: same inputs always produce same drift report
 *   - Explainable: every drift includes what changed, why it matters, and how to fix
 *   - Low-noise: severity tiers, suppression, and context-aware filtering
 *   - Provider-agnostic: uniform drift model across AWS, Azure, GCP
 */

import type { CloudSnapshot, CloudResource, ComputeResource, StorageResource } from "../cloudSnapshot";
import type { CloudProvider } from "../cloudSnapshot";
import type { SnapshotDelta, ResourceChange, FieldChange } from "./monitoringAgent";
import { diffSnapshots } from "./monitoringAgent";
import {
  FindingCategory,
  RiskLevel,
  ActionType,
} from "../enums";

// ---------------------------------------------------------------------------
// 1. Drift types
// ---------------------------------------------------------------------------

export type DriftSeverity = "info" | "low" | "medium" | "high" | "critical";

export type DriftCategory =
  | "plan_drift"          // drifted from Terraform / execution plan
  | "config_mutation"     // manual change detected
  | "security_regression" // security posture degraded
  | "resilience_regression" // resilience posture degraded
  | "cost_deviation"      // cost unexpectedly changed
  | "resource_lifecycle"  // resource added/removed outside agent
  | "compliance_violation"; // compliance state changed

export type DriftSource =
  | "terraform_plan"
  | "execution_plan"
  | "previous_snapshot"
  | "resilience_baseline"
  | "compliance_baseline";

export type DriftItem = {
  id: string;
  category: DriftCategory;
  severity: DriftSeverity;
  source: DriftSource;
  provider: CloudProvider;
  region: string;
  resourceId: string;
  resourceType: "compute" | "storage";
  title: string;
  description: string;
  fieldChanges: DriftFieldChange[];
  impact: DriftImpact;
  remediation: DriftRemediation;
  suppressible: boolean;
  firstDetectedAt: string;
  deduplicationKey: string;
};

export type DriftFieldChange = {
  field: string;
  expected: unknown;
  actual: unknown;
  source: DriftSource;
};

export type DriftImpact = {
  category: FindingCategory;
  riskLevel: RiskLevel;
  description: string;
  costImpactMonthly?: number;
  affectedUsers?: string;
  blastRadius: "single_resource" | "service" | "region" | "account";
};

export type DriftRemediation = {
  action: RemediationAction;
  description: string;
  effort: "trivial" | "low" | "medium" | "high";
  automatable: boolean;
  terraformApplicable: boolean;
  suggestedActionType?: ActionType;
};

export type RemediationAction =
  | "revert_to_plan"
  | "update_plan"
  | "apply_policy"
  | "resize_instance"
  | "enable_feature"
  | "restrict_access"
  | "add_replication"
  | "investigate"
  | "acknowledge";

// ---------------------------------------------------------------------------
// 2. Drift report — the output of a detection run
// ---------------------------------------------------------------------------

export type DriftReport = {
  organizationId: string;
  cloudAccountId: string;
  provider: CloudProvider;
  detectedAt: string;
  sources: DriftSource[];
  items: DriftItem[];
  summary: DriftSummary;
  notification: DriftNotification | null;
};

export type DriftSummary = {
  totalDrifts: number;
  bySeverity: Record<DriftSeverity, number>;
  byCategory: Record<DriftCategory, number>;
  bySource: Record<DriftSource, number>;
  affectedResources: number;
  affectedRegions: string[];
  highestSeverity: DriftSeverity;
  requiresAction: number;
  automatable: number;
};

export type DriftNotification = {
  severity: DriftSeverity;
  title: string;
  body: string;
  sections: DriftNotificationSection[];
};

export type DriftNotificationSection = {
  heading: string;
  items: string[];
};

// ---------------------------------------------------------------------------
// 3. Reference state — what we compare against
// ---------------------------------------------------------------------------

export type TerraformPlanState = {
  resources: TerraformResourceState[];
  generatedAt: string;
  runId: string;
};

export type TerraformResourceState = {
  resourceId: string;
  provider: CloudProvider;
  region: string;
  resourceType: "compute" | "storage";
  plannedFields: Record<string, unknown>;
};

export type ExecutionPlanState = {
  approvedItems: ApprovedPlanItem[];
  approvedAt: string;
  runId: string;
};

export type ApprovedPlanItem = {
  planItemId: string;
  resourceId: string;
  actionType: ActionType;
  provider: CloudProvider;
  region: string;
  expectedState: Record<string, unknown>;
  appliedAt?: string;
  verifiedAt?: string;
};

export type ResilienceBaseline = {
  expectedMultiRegion: boolean;
  expectedBackups: boolean;
  expectedReplication: boolean;
  expectedPublicExposure: "none" | "limited" | "any";
  minRegionCount: number;
  maxSingleRegionConcentration: number;
};

export const DEFAULT_RESILIENCE_BASELINE: ResilienceBaseline = {
  expectedMultiRegion: true,
  expectedBackups: true,
  expectedReplication: true,
  expectedPublicExposure: "none",
  minRegionCount: 2,
  maxSingleRegionConcentration: 0.7,
};

// ---------------------------------------------------------------------------
// 4. Drift detection rules
// ---------------------------------------------------------------------------

export type DriftRule = {
  id: string;
  name: string;
  description: string;
  category: DriftCategory;
  defaultSeverity: DriftSeverity;
  source: DriftSource;
  evaluate: (ctx: DriftEvalContext) => DriftItem[];
};

export type DriftEvalContext = {
  organizationId: string;
  cloudAccountId: string;
  currentSnapshot: CloudSnapshot;
  previousSnapshot?: CloudSnapshot;
  snapshotDelta?: SnapshotDelta;
  terraformPlan?: TerraformPlanState;
  executionPlan?: ExecutionPlanState;
  resilienceBaseline: ResilienceBaseline;
  suppressedKeys: Set<string>;
};

let driftCounter = 0;

function driftId(): string {
  return `drift-${++driftCounter}`;
}

function dedup(category: string, resourceId: string, field: string): string {
  return `${category}:${resourceId}:${field}`;
}

// ---------------------------------------------------------------------------
// Rule 1: Terraform plan drift — resource state doesn't match plan
// ---------------------------------------------------------------------------

const TERRAFORM_PLAN_DRIFT: DriftRule = {
  id: "terraform-plan-drift",
  name: "Terraform Plan Drift",
  description: "Resource state differs from the generated Terraform plan",
  category: "plan_drift",
  defaultSeverity: "medium",
  source: "terraform_plan",
  evaluate(ctx) {
    if (!ctx.terraformPlan) return [];
    const items: DriftItem[] = [];
    const snapshot = ctx.currentSnapshot;

    for (const planned of ctx.terraformPlan.resources) {
      const actual = snapshot.resources.find((r) => r.resourceId === planned.resourceId);
      if (!actual) {
        const key = dedup("plan_drift", planned.resourceId, "missing");
        if (ctx.suppressedKeys.has(key)) continue;

        items.push({
          id: driftId(),
          category: "plan_drift",
          severity: "high",
          source: "terraform_plan",
          provider: planned.provider,
          region: planned.region,
          resourceId: planned.resourceId,
          resourceType: planned.resourceType,
          title: `Resource missing: ${planned.resourceId}`,
          description: `Resource exists in Terraform plan (run ${ctx.terraformPlan.runId}) but not found in live infrastructure. It may have been deleted manually.`,
          fieldChanges: [{
            field: "existence",
            expected: "present",
            actual: "missing",
            source: "terraform_plan",
          }],
          impact: {
            category: FindingCategory.Resilience,
            riskLevel: RiskLevel.High,
            description: "Missing resource may cause service degradation or outage",
            blastRadius: "service",
          },
          remediation: {
            action: "revert_to_plan",
            description: "Re-run Terraform apply to recreate the resource, or update the plan to remove it intentionally",
            effort: "medium",
            automatable: true,
            terraformApplicable: true,
          },
          suppressible: false,
          firstDetectedAt: new Date().toISOString(),
          deduplicationKey: key,
        });
        continue;
      }

      const fieldDrifts = comparePlannedFields(planned.plannedFields, actual, planned.provider);
      for (const fd of fieldDrifts) {
        const key = dedup("plan_drift", planned.resourceId, fd.field);
        if (ctx.suppressedKeys.has(key)) continue;

        const severity = fieldDriftSeverity(fd.field, fd.expected, fd.actual);

        items.push({
          id: driftId(),
          category: "plan_drift",
          severity,
          source: "terraform_plan",
          provider: planned.provider,
          region: planned.region,
          resourceId: planned.resourceId,
          resourceType: planned.resourceType,
          title: `Plan drift: ${planned.resourceId} — ${fd.field}`,
          description: `Field '${fd.field}' expected '${String(fd.expected)}' (from Terraform plan) but found '${String(fd.actual)}' in live state.`,
          fieldChanges: [fd],
          impact: fieldDriftImpact(fd.field, fd.expected, fd.actual),
          remediation: {
            action: "revert_to_plan",
            description: `Run Terraform apply to restore ${fd.field} to planned value, or update plan to match current state`,
            effort: "low",
            automatable: true,
            terraformApplicable: true,
          },
          suppressible: true,
          firstDetectedAt: new Date().toISOString(),
          deduplicationKey: key,
        });
      }
    }

    return items;
  },
};

// ---------------------------------------------------------------------------
// Rule 2: Execution plan drift — approved changes reverted or altered
// ---------------------------------------------------------------------------

const EXECUTION_PLAN_DRIFT: DriftRule = {
  id: "execution-plan-drift",
  name: "Execution Plan Drift",
  description: "Approved and applied changes have been reverted or altered",
  category: "plan_drift",
  defaultSeverity: "high",
  source: "execution_plan",
  evaluate(ctx) {
    if (!ctx.executionPlan) return [];
    const items: DriftItem[] = [];
    const snapshot = ctx.currentSnapshot;

    for (const approved of ctx.executionPlan.approvedItems) {
      if (!approved.appliedAt) continue;

      const actual = snapshot.resources.find((r) => r.resourceId === approved.resourceId);
      if (!actual) continue;

      const fieldDrifts = comparePlannedFields(approved.expectedState, actual, approved.provider);
      for (const fd of fieldDrifts) {
        const key = dedup("exec_plan_drift", approved.resourceId, fd.field);
        if (ctx.suppressedKeys.has(key)) continue;

        items.push({
          id: driftId(),
          category: "plan_drift",
          severity: "high",
          source: "execution_plan",
          provider: approved.provider,
          region: approved.region,
          resourceId: approved.resourceId,
          resourceType: actual.resourceType,
          title: `Approved change reverted: ${approved.resourceId} — ${fd.field}`,
          description: `The approved ${approved.actionType} action set ${fd.field} to '${String(fd.expected)}' but it's now '${String(fd.actual)}'. Someone or something reverted the change after it was approved and applied.`,
          fieldChanges: [{ ...fd, source: "execution_plan" }],
          impact: {
            category: FindingCategory.Cost,
            riskLevel: RiskLevel.High,
            description: "Approved optimization was undone — savings lost and audit trail broken",
            blastRadius: "single_resource",
          },
          remediation: {
            action: "revert_to_plan",
            description: "Re-apply the approved action or investigate who reverted it",
            effort: "low",
            automatable: true,
            terraformApplicable: true,
            suggestedActionType: approved.actionType,
          },
          suppressible: false,
          firstDetectedAt: new Date().toISOString(),
          deduplicationKey: key,
        });
      }
    }

    return items;
  },
};

// ---------------------------------------------------------------------------
// Rule 3: Manual instance resize
// ---------------------------------------------------------------------------

const MANUAL_RESIZE: DriftRule = {
  id: "manual-resize",
  name: "Manual Instance Resize",
  description: "Compute instance resized outside the agent workflow",
  category: "config_mutation",
  defaultSeverity: "medium",
  source: "previous_snapshot",
  evaluate(ctx) {
    if (!ctx.snapshotDelta) return [];
    const items: DriftItem[] = [];

    for (const change of ctx.snapshotDelta.changedResources) {
      if (change.resourceType !== "compute") continue;

      const instanceTypeChange = change.changes.find((c) => c.field === "instanceType");
      if (!instanceTypeChange) continue;

      const wasPlanned = ctx.executionPlan?.approvedItems.some(
        (a) => a.resourceId === change.resourceId && a.actionType === ActionType.ResizeCompute,
      );
      if (wasPlanned) continue;

      const key = dedup("manual_resize", change.resourceId, "instanceType");
      if (ctx.suppressedKeys.has(key)) continue;

      items.push({
        id: driftId(),
        category: "config_mutation",
        severity: "medium",
        source: "previous_snapshot",
        provider: change.provider,
        region: change.region,
        resourceId: change.resourceId,
        resourceType: "compute",
        title: `Manual resize: ${change.resourceId}`,
        description: `Instance type changed from '${String(instanceTypeChange.previousValue)}' to '${String(instanceTypeChange.currentValue)}' outside the Axiom workflow. This may indicate a manual console change or another tool.`,
        fieldChanges: [{
          field: "instanceType",
          expected: instanceTypeChange.previousValue,
          actual: instanceTypeChange.currentValue,
          source: "previous_snapshot",
        }],
        impact: {
          category: FindingCategory.Cost,
          riskLevel: RiskLevel.Medium,
          description: "Untracked resize may affect cost forecasting and optimization recommendations",
          costImpactMonthly: estimateResizeCostDelta(
            instanceTypeChange.previousValue as string,
            instanceTypeChange.currentValue as string,
          ),
          blastRadius: "single_resource",
        },
        remediation: {
          action: "update_plan",
          description: "Run a new scan to incorporate the resize into recommendations, or revert via Terraform",
          effort: "trivial",
          automatable: true,
          terraformApplicable: true,
          suggestedActionType: ActionType.ResizeCompute,
        },
        suppressible: true,
        firstDetectedAt: new Date().toISOString(),
        deduplicationKey: key,
      });
    }

    return items;
  },
};

// ---------------------------------------------------------------------------
// Rule 4: Bucket became public
// ---------------------------------------------------------------------------

const PUBLIC_EXPOSURE: DriftRule = {
  id: "public-exposure",
  name: "Public Exposure Detected",
  description: "Storage resource became publicly accessible",
  category: "security_regression",
  defaultSeverity: "critical",
  source: "previous_snapshot",
  evaluate(ctx) {
    if (!ctx.snapshotDelta) return [];
    const items: DriftItem[] = [];

    for (const change of ctx.snapshotDelta.changedResources) {
      if (change.resourceType !== "storage") continue;

      const accessChange = change.changes.find(
        (c) => c.field === "publicAccess" || c.field === "acl" || c.field === "bucketPolicy",
      );
      if (!accessChange) continue;

      const becamePublic =
        accessChange.currentValue === true ||
        accessChange.currentValue === "public" ||
        accessChange.currentValue === "public-read";
      if (!becamePublic) continue;

      const key = dedup("public_exposure", change.resourceId, accessChange.field);
      if (ctx.suppressedKeys.has(key)) continue;

      const allowed = ctx.resilienceBaseline.expectedPublicExposure === "any" ||
        (ctx.resilienceBaseline.expectedPublicExposure === "limited");

      items.push({
        id: driftId(),
        category: "security_regression",
        severity: allowed ? "low" : "critical",
        source: "previous_snapshot",
        provider: change.provider,
        region: change.region,
        resourceId: change.resourceId,
        resourceType: "storage",
        title: `Public exposure: ${change.resourceId}`,
        description: `Storage resource became publicly accessible. Field '${accessChange.field}' changed from '${String(accessChange.previousValue)}' to '${String(accessChange.currentValue)}'.`,
        fieldChanges: [{
          field: accessChange.field,
          expected: accessChange.previousValue,
          actual: accessChange.currentValue,
          source: "previous_snapshot",
        }],
        impact: {
          category: FindingCategory.Security,
          riskLevel: RiskLevel.High,
          description: "Publicly accessible storage may expose sensitive data to the internet",
          blastRadius: "account",
        },
        remediation: {
          action: "restrict_access",
          description: "Remove public access from the storage resource. Apply bucket policy to deny public reads.",
          effort: "low",
          automatable: true,
          terraformApplicable: true,
          suggestedActionType: ActionType.ApplyStoragePolicy,
        },
        suppressible: false,
        firstDetectedAt: new Date().toISOString(),
        deduplicationKey: key,
      });
    }

    return items;
  },
};

// ---------------------------------------------------------------------------
// Rule 5: Lifecycle policy removed
// ---------------------------------------------------------------------------

const LIFECYCLE_POLICY_REMOVED: DriftRule = {
  id: "lifecycle-policy-removed",
  name: "Lifecycle Policy Removed",
  description: "Storage lifecycle/retention policy was removed or disabled",
  category: "config_mutation",
  defaultSeverity: "medium",
  source: "previous_snapshot",
  evaluate(ctx) {
    if (!ctx.snapshotDelta) return [];
    const items: DriftItem[] = [];

    for (const change of ctx.snapshotDelta.changedResources) {
      if (change.resourceType !== "storage") continue;

      const lifecycleChange = change.changes.find(
        (c) => c.field === "lifecyclePolicy" || c.field === "retentionPolicy" || c.field === "storageClass",
      );
      if (!lifecycleChange) continue;

      const wasRemoved = lifecycleChange.currentValue === null ||
        lifecycleChange.currentValue === "disabled" ||
        lifecycleChange.currentValue === "none";
      if (!wasRemoved) continue;

      const key = dedup("lifecycle_removed", change.resourceId, lifecycleChange.field);
      if (ctx.suppressedKeys.has(key)) continue;

      items.push({
        id: driftId(),
        category: "config_mutation",
        severity: "medium",
        source: "previous_snapshot",
        provider: change.provider,
        region: change.region,
        resourceId: change.resourceId,
        resourceType: "storage",
        title: `Lifecycle policy removed: ${change.resourceId}`,
        description: `${lifecycleChange.field} was '${String(lifecycleChange.previousValue)}' but is now '${String(lifecycleChange.currentValue)}'. Data may accumulate without cleanup.`,
        fieldChanges: [{
          field: lifecycleChange.field,
          expected: lifecycleChange.previousValue,
          actual: lifecycleChange.currentValue,
          source: "previous_snapshot",
        }],
        impact: {
          category: FindingCategory.Cost,
          riskLevel: RiskLevel.Medium,
          description: "Without lifecycle policies, storage costs will grow unbounded as data accumulates",
          blastRadius: "single_resource",
        },
        remediation: {
          action: "apply_policy",
          description: "Restore the lifecycle policy to transition old data to cheaper tiers or delete after retention period",
          effort: "low",
          automatable: true,
          terraformApplicable: true,
          suggestedActionType: ActionType.ApplyStoragePolicy,
        },
        suppressible: true,
        firstDetectedAt: new Date().toISOString(),
        deduplicationKey: key,
      });
    }

    return items;
  },
};

// ---------------------------------------------------------------------------
// Rule 6: Replication disabled
// ---------------------------------------------------------------------------

const REPLICATION_DISABLED: DriftRule = {
  id: "replication-disabled",
  name: "Replication Disabled",
  description: "Cross-region or cross-zone replication was disabled",
  category: "resilience_regression",
  defaultSeverity: "high",
  source: "previous_snapshot",
  evaluate(ctx) {
    if (!ctx.snapshotDelta) return [];
    if (!ctx.resilienceBaseline.expectedReplication) return [];
    const items: DriftItem[] = [];

    for (const change of ctx.snapshotDelta.changedResources) {
      const replChange = change.changes.find(
        (c) => c.field === "replication" || c.field === "crossRegionReplication" || c.field === "multiAz",
      );
      if (!replChange) continue;

      const wasDisabled = replChange.currentValue === false ||
        replChange.currentValue === "disabled" ||
        replChange.currentValue === null;
      const wasPreviouslyEnabled = replChange.previousValue === true ||
        replChange.previousValue === "enabled";
      if (!wasDisabled || !wasPreviouslyEnabled) continue;

      const key = dedup("replication_disabled", change.resourceId, replChange.field);
      if (ctx.suppressedKeys.has(key)) continue;

      items.push({
        id: driftId(),
        category: "resilience_regression",
        severity: "high",
        source: "previous_snapshot",
        provider: change.provider,
        region: change.region,
        resourceId: change.resourceId,
        resourceType: change.resourceType,
        title: `Replication disabled: ${change.resourceId}`,
        description: `${replChange.field} changed from '${String(replChange.previousValue)}' to '${String(replChange.currentValue)}'. Data is no longer replicated across zones/regions.`,
        fieldChanges: [{
          field: replChange.field,
          expected: replChange.previousValue,
          actual: replChange.currentValue,
          source: "previous_snapshot",
        }],
        impact: {
          category: FindingCategory.Resilience,
          riskLevel: RiskLevel.High,
          description: "Single point of failure — data loss risk during regional outage",
          blastRadius: "region",
        },
        remediation: {
          action: "enable_feature",
          description: "Re-enable replication to restore data durability across availability zones or regions",
          effort: "medium",
          automatable: true,
          terraformApplicable: true,
        },
        suppressible: false,
        firstDetectedAt: new Date().toISOString(),
        deduplicationKey: key,
      });
    }

    return items;
  },
};

// ---------------------------------------------------------------------------
// Rule 7: Backup configuration removed
// ---------------------------------------------------------------------------

const BACKUP_REMOVED: DriftRule = {
  id: "backup-removed",
  name: "Backup Configuration Removed",
  description: "Automated backup/snapshot configuration was disabled",
  category: "resilience_regression",
  defaultSeverity: "high",
  source: "previous_snapshot",
  evaluate(ctx) {
    if (!ctx.resilienceBaseline.expectedBackups) return [];

    const currentFlags = ctx.currentSnapshot.flags;
    const previousFlags = ctx.previousSnapshot?.flags;

    if (!previousFlags) return [];
    if (!currentFlags.noBackupsDetected) return [];
    if (previousFlags.noBackupsDetected) return [];

    const key = dedup("backup_removed", ctx.currentSnapshot.accountId, "noBackupsDetected");
    if (ctx.suppressedKeys.has(key)) return [];

    return [{
      id: driftId(),
      category: "resilience_regression",
      severity: "high",
      source: "previous_snapshot",
      provider: ctx.currentSnapshot.provider,
      region: ctx.currentSnapshot.regions[0] ?? "global",
      resourceId: ctx.currentSnapshot.accountId,
      resourceType: "compute" as const,
      title: `Backup configuration removed: ${ctx.currentSnapshot.accountId}`,
      description: "No automated backups detected in current scan, but backups were present in the previous scan. Backup schedules may have been disabled.",
      fieldChanges: [{
        field: "noBackupsDetected",
        expected: false,
        actual: true,
        source: "previous_snapshot" as DriftSource,
      }],
      impact: {
        category: FindingCategory.Resilience,
        riskLevel: RiskLevel.High,
        description: "Without backups, data loss from accidental deletion or corruption is unrecoverable",
        blastRadius: "account",
      },
      remediation: {
        action: "enable_feature",
        description: "Re-enable automated backups. For AWS use AWS Backup, Azure use Recovery Services Vault, GCP use Cloud Backup.",
        effort: "medium",
        automatable: true,
        terraformApplicable: true,
      },
      suppressible: false,
      firstDetectedAt: new Date().toISOString(),
      deduplicationKey: key,
    }];
  },
};

// ---------------------------------------------------------------------------
// Rule 8: Region concentration regression
// ---------------------------------------------------------------------------

const REGION_CONCENTRATION: DriftRule = {
  id: "region-concentration",
  name: "Region Concentration Regression",
  description: "Resources became concentrated in fewer regions than baseline",
  category: "resilience_regression",
  defaultSeverity: "medium",
  source: "resilience_baseline",
  evaluate(ctx) {
    const regions = ctx.currentSnapshot.regions;
    const baseline = ctx.resilienceBaseline;

    if (regions.length >= baseline.minRegionCount) return [];

    const key = dedup("region_concentration", ctx.currentSnapshot.accountId, "regionCount");
    if (ctx.suppressedKeys.has(key)) return [];

    const previousRegionCount = ctx.previousSnapshot?.regions.length ?? regions.length;
    if (previousRegionCount < baseline.minRegionCount) return [];

    return [{
      id: driftId(),
      category: "resilience_regression",
      severity: "medium",
      source: "resilience_baseline",
      provider: ctx.currentSnapshot.provider,
      region: "global",
      resourceId: ctx.currentSnapshot.accountId,
      resourceType: "compute" as const,
      title: `Region count dropped below minimum: ${regions.length} < ${baseline.minRegionCount}`,
      description: `Infrastructure is deployed in ${regions.length} region(s) but baseline requires at least ${baseline.minRegionCount}. Previous scan had ${previousRegionCount} regions.`,
      fieldChanges: [{
        field: "regionCount",
        expected: baseline.minRegionCount,
        actual: regions.length,
        source: "resilience_baseline" as DriftSource,
      }],
      impact: {
        category: FindingCategory.Resilience,
        riskLevel: RiskLevel.Medium,
        description: "Single-region deployment creates blast radius risk during regional outages",
        blastRadius: "account",
      },
      remediation: {
        action: "investigate",
        description: "Evaluate whether resources were intentionally consolidated or accidentally removed from secondary regions",
        effort: "high",
        automatable: false,
        terraformApplicable: true,
      },
      suppressible: true,
      firstDetectedAt: new Date().toISOString(),
      deduplicationKey: key,
    }];
  },
};

// ---------------------------------------------------------------------------
// Rule 9: Unexpected resource addition
// ---------------------------------------------------------------------------

const UNEXPECTED_RESOURCE: DriftRule = {
  id: "unexpected-resource",
  name: "Unexpected Resource Added",
  description: "New resource appeared outside the agent workflow",
  category: "resource_lifecycle",
  defaultSeverity: "low",
  source: "previous_snapshot",
  evaluate(ctx) {
    if (!ctx.snapshotDelta) return [];
    const items: DriftItem[] = [];

    for (const added of ctx.snapshotDelta.addedResources) {
      const wasPlanned = ctx.executionPlan?.approvedItems.some(
        (a) => a.resourceId === added.resourceId,
      );
      if (wasPlanned) continue;

      const key = dedup("unexpected_add", added.resourceId, "new");
      if (ctx.suppressedKeys.has(key)) continue;

      items.push({
        id: driftId(),
        category: "resource_lifecycle",
        severity: "low",
        source: "previous_snapshot",
        provider: added.provider,
        region: added.region,
        resourceId: added.resourceId,
        resourceType: added.resourceType,
        title: `New resource: ${added.resourceId}`,
        description: `Resource appeared in ${added.region} since the last scan and was not part of any Axiom execution plan. It may have been created via console, CLI, or another tool.`,
        fieldChanges: [{
          field: "existence",
          expected: "absent",
          actual: "present",
          source: "previous_snapshot",
        }],
        impact: {
          category: FindingCategory.Cost,
          riskLevel: RiskLevel.Low,
          description: "Untracked resource may not be optimized or governed by Axiom policies",
          costImpactMonthly: added.resourceType === "compute"
            ? (added as ComputeResource).monthlyCostEstimate
            : (added as StorageResource).monthlyCostEstimate,
          blastRadius: "single_resource",
        },
        remediation: {
          action: "acknowledge",
          description: "Run a new scan to include this resource in optimization recommendations",
          effort: "trivial",
          automatable: false,
          terraformApplicable: false,
        },
        suppressible: true,
        firstDetectedAt: new Date().toISOString(),
        deduplicationKey: key,
      });
    }

    return items;
  },
};

// ---------------------------------------------------------------------------
// Rule 10: Unexpected resource removal
// ---------------------------------------------------------------------------

const UNEXPECTED_REMOVAL: DriftRule = {
  id: "unexpected-removal",
  name: "Unexpected Resource Removed",
  description: "Resource disappeared outside the agent workflow",
  category: "resource_lifecycle",
  defaultSeverity: "high",
  source: "previous_snapshot",
  evaluate(ctx) {
    if (!ctx.snapshotDelta) return [];
    const items: DriftItem[] = [];

    for (const removed of ctx.snapshotDelta.removedResources) {
      const wasPlanned = ctx.executionPlan?.approvedItems.some(
        (a) => a.resourceId === removed.resourceId &&
          a.actionType === ActionType.DecommissionCompute,
      );
      if (wasPlanned) continue;

      const key = dedup("unexpected_remove", removed.resourceId, "removed");
      if (ctx.suppressedKeys.has(key)) continue;

      items.push({
        id: driftId(),
        category: "resource_lifecycle",
        severity: "high",
        source: "previous_snapshot",
        provider: removed.provider,
        region: removed.region,
        resourceId: removed.resourceId,
        resourceType: removed.resourceType,
        title: `Resource removed: ${removed.resourceId}`,
        description: `Resource in ${removed.region} disappeared since the last scan and was not part of any Axiom decommission plan. It may have been manually deleted.`,
        fieldChanges: [{
          field: "existence",
          expected: "present",
          actual: "missing",
          source: "previous_snapshot",
        }],
        impact: {
          category: FindingCategory.Resilience,
          riskLevel: RiskLevel.High,
          description: "Unexpected resource deletion may cause service disruption",
          costImpactMonthly: removed.resourceType === "compute"
            ? (removed as ComputeResource).monthlyCostEstimate
            : (removed as StorageResource).monthlyCostEstimate,
          blastRadius: "service",
        },
        remediation: {
          action: "investigate",
          description: "Check CloudTrail/Activity Log/Audit Log to determine who deleted the resource and whether it was intentional",
          effort: "medium",
          automatable: false,
          terraformApplicable: true,
        },
        suppressible: false,
        firstDetectedAt: new Date().toISOString(),
        deduplicationKey: key,
      });
    }

    return items;
  },
};

// ---------------------------------------------------------------------------
// All rules
// ---------------------------------------------------------------------------

export const ALL_DRIFT_RULES: DriftRule[] = [
  TERRAFORM_PLAN_DRIFT,
  EXECUTION_PLAN_DRIFT,
  MANUAL_RESIZE,
  PUBLIC_EXPOSURE,
  LIFECYCLE_POLICY_REMOVED,
  REPLICATION_DISABLED,
  BACKUP_REMOVED,
  REGION_CONCENTRATION,
  UNEXPECTED_RESOURCE,
  UNEXPECTED_REMOVAL,
];

// ---------------------------------------------------------------------------
// 5. Drift detection engine
// ---------------------------------------------------------------------------

export type DetectDriftInput = {
  organizationId: string;
  cloudAccountId: string;
  currentSnapshot: CloudSnapshot;
  previousSnapshot?: CloudSnapshot;
  terraformPlan?: TerraformPlanState;
  executionPlan?: ExecutionPlanState;
  resilienceBaseline?: ResilienceBaseline;
  suppressedKeys?: string[];
  rules?: DriftRule[];
};

export function detectDrift(input: DetectDriftInput): DriftReport {
  const {
    organizationId,
    cloudAccountId,
    currentSnapshot,
    previousSnapshot,
    terraformPlan,
    executionPlan,
    resilienceBaseline = DEFAULT_RESILIENCE_BASELINE,
    suppressedKeys = [],
    rules = ALL_DRIFT_RULES,
  } = input;

  const snapshotDelta = previousSnapshot
    ? diffSnapshots(previousSnapshot, currentSnapshot)
    : undefined;

  const ctx: DriftEvalContext = {
    organizationId,
    cloudAccountId,
    currentSnapshot,
    previousSnapshot,
    snapshotDelta,
    terraformPlan,
    executionPlan,
    resilienceBaseline,
    suppressedKeys: new Set(suppressedKeys),
  };

  const allItems: DriftItem[] = [];
  for (const rule of rules) {
    const ruleItems = rule.evaluate(ctx);
    allItems.push(...ruleItems);
  }

  // Sort by severity (critical first)
  const severityOrder: Record<DriftSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };
  allItems.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const summary = buildSummary(allItems);
  const notification = summary.totalDrifts > 0 ? buildDriftNotification(summary, allItems) : null;

  const sources: DriftSource[] = [];
  if (terraformPlan) sources.push("terraform_plan");
  if (executionPlan) sources.push("execution_plan");
  if (previousSnapshot) sources.push("previous_snapshot");
  sources.push("resilience_baseline");

  return {
    organizationId,
    cloudAccountId,
    provider: currentSnapshot.provider,
    detectedAt: new Date().toISOString(),
    sources,
    items: allItems,
    summary,
    notification,
  };
}

// ---------------------------------------------------------------------------
// 6. Summary builder
// ---------------------------------------------------------------------------

function buildSummary(items: DriftItem[]): DriftSummary {
  const bySeverity: Record<DriftSeverity, number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
  const byCategory: Record<DriftCategory, number> = {
    plan_drift: 0, config_mutation: 0, security_regression: 0,
    resilience_regression: 0, cost_deviation: 0, resource_lifecycle: 0,
    compliance_violation: 0,
  };
  const bySource: Record<DriftSource, number> = {
    terraform_plan: 0, execution_plan: 0, previous_snapshot: 0,
    resilience_baseline: 0, compliance_baseline: 0,
  };
  const regions = new Set<string>();
  const resources = new Set<string>();
  let requiresAction = 0;
  let automatable = 0;

  for (const item of items) {
    bySeverity[item.severity]++;
    byCategory[item.category]++;
    bySource[item.source]++;
    regions.add(item.region);
    resources.add(item.resourceId);
    if (!item.suppressible) requiresAction++;
    if (item.remediation.automatable) automatable++;
  }

  const highestSeverity: DriftSeverity = items.length > 0 ? items[0].severity : "info";

  return {
    totalDrifts: items.length,
    bySeverity,
    byCategory,
    bySource,
    affectedResources: resources.size,
    affectedRegions: [...regions],
    highestSeverity,
    requiresAction,
    automatable,
  };
}

// ---------------------------------------------------------------------------
// 7. Notification payload builder
// ---------------------------------------------------------------------------

function buildDriftNotification(summary: DriftSummary, items: DriftItem[]): DriftNotification {
  const severity = summary.highestSeverity;
  const title = `Drift detected: ${summary.totalDrifts} change${summary.totalDrifts !== 1 ? "s" : ""} across ${summary.affectedResources} resource${summary.affectedResources !== 1 ? "s" : ""}`;

  const sections: DriftNotificationSection[] = [];

  // Critical items
  const critical = items.filter((i) => i.severity === "critical");
  if (critical.length > 0) {
    sections.push({
      heading: `🔴 Critical (${critical.length})`,
      items: critical.slice(0, 5).map((i) => `${i.title} — ${i.impact.description}`),
    });
  }

  // High items
  const high = items.filter((i) => i.severity === "high");
  if (high.length > 0) {
    sections.push({
      heading: `🟠 High (${high.length})`,
      items: high.slice(0, 5).map((i) => `${i.title} — ${i.remediation.description.slice(0, 100)}`),
    });
  }

  // Medium items
  const medium = items.filter((i) => i.severity === "medium");
  if (medium.length > 0) {
    sections.push({
      heading: `🟡 Medium (${medium.length})`,
      items: medium.slice(0, 3).map((i) => i.title),
    });
  }

  // Low/info count
  const lowInfo = items.filter((i) => i.severity === "low" || i.severity === "info");
  if (lowInfo.length > 0) {
    sections.push({
      heading: `ℹ Info (${lowInfo.length})`,
      items: [`${lowInfo.length} informational drift${lowInfo.length !== 1 ? "s" : ""} detected`],
    });
  }

  // Action summary
  if (summary.automatable > 0) {
    sections.push({
      heading: "Remediation",
      items: [
        `${summary.automatable} of ${summary.totalDrifts} drifts can be automatically remediated`,
        `${summary.requiresAction} require immediate attention`,
      ],
    });
  }

  const bodyLines = sections.flatMap((s) => [
    `**${s.heading}**`,
    ...s.items.map((i) => `• ${i}`),
    "",
  ]);

  return {
    severity,
    title,
    body: bodyLines.join("\n"),
    sections,
  };
}

// ---------------------------------------------------------------------------
// 8. Helpers
// ---------------------------------------------------------------------------

function comparePlannedFields(
  planned: Record<string, unknown>,
  actual: CloudResource,
  _provider: CloudProvider,
): DriftFieldChange[] {
  const drifts: DriftFieldChange[] = [];
  const actualRecord = actual as unknown as Record<string, unknown>;

  for (const [field, expectedValue] of Object.entries(planned)) {
    const actualValue = actualRecord[field];
    if (actualValue === undefined) continue;
    if (JSON.stringify(expectedValue) === JSON.stringify(actualValue)) continue;

    drifts.push({
      field,
      expected: expectedValue,
      actual: actualValue,
      source: "terraform_plan",
    });
  }

  return drifts;
}

function fieldDriftSeverity(field: string, _expected: unknown, _actual: unknown): DriftSeverity {
  const criticalFields = ["publicAccess", "acl", "bucketPolicy", "encryption", "iamPolicy"];
  const highFields = ["instanceType", "replication", "multiAz", "state", "backupEnabled"];
  const mediumFields = ["storageClass", "lifecyclePolicy", "tags", "vcpus", "memoryGb"];

  if (criticalFields.includes(field)) return "critical";
  if (highFields.includes(field)) return "high";
  if (mediumFields.includes(field)) return "medium";
  return "low";
}

function fieldDriftImpact(field: string, _expected: unknown, _actual: unknown): DriftImpact {
  const securityFields = ["publicAccess", "acl", "bucketPolicy", "encryption", "iamPolicy"];
  const resilienceFields = ["replication", "multiAz", "backupEnabled", "state"];
  const costFields = ["instanceType", "storageClass", "vcpus", "memoryGb"];

  if (securityFields.includes(field)) {
    return {
      category: FindingCategory.Security,
      riskLevel: RiskLevel.High,
      description: `Security-sensitive field '${field}' drifted from planned state`,
      blastRadius: "account",
    };
  }
  if (resilienceFields.includes(field)) {
    return {
      category: FindingCategory.Resilience,
      riskLevel: RiskLevel.High,
      description: `Resilience-critical field '${field}' drifted — may affect availability`,
      blastRadius: "region",
    };
  }
  if (costFields.includes(field)) {
    return {
      category: FindingCategory.Cost,
      riskLevel: RiskLevel.Medium,
      description: `Cost-relevant field '${field}' changed — may affect billing`,
      blastRadius: "single_resource",
    };
  }
  return {
    category: FindingCategory.Performance,
    riskLevel: RiskLevel.Low,
    description: `Field '${field}' drifted from planned value`,
    blastRadius: "single_resource",
  };
}

function estimateResizeCostDelta(from: string, to: string): number | undefined {
  // Rough heuristic: larger instance suffix = higher cost
  const sizeOrder = ["nano", "micro", "small", "medium", "large", "xlarge", "2xlarge", "4xlarge", "8xlarge"];
  const fromIdx = sizeOrder.findIndex((s) => from.includes(s));
  const toIdx = sizeOrder.findIndex((s) => to.includes(s));
  if (fromIdx < 0 || toIdx < 0) return undefined;
  const delta = (toIdx - fromIdx) * 50;
  return delta !== 0 ? delta : undefined;
}

export function _resetDriftCounter(): void {
  driftCounter = 0;
}

// ---------------------------------------------------------------------------
// 9. Invariant tests
// ---------------------------------------------------------------------------

export type DriftTestResult = { name: string; passed: boolean; detail: string };

export function runDriftTests(): DriftTestResult[] {
  const results: DriftTestResult[] = [];
  _resetDriftCounter();

  const baseProvider = "aws" as CloudProvider;

  const makeSnapshot = (overrides?: Partial<CloudSnapshot>): CloudSnapshot => ({
    provider: baseProvider,
    accountId: "123456789",
    scannedAt: new Date().toISOString(),
    regions: ["us-east-1", "us-west-2"],
    resources: [],
    flags: { singleRegion: false, noBackupsDetected: false },
    ...overrides,
  });

  const makeCompute = (overrides?: Partial<ComputeResource>): ComputeResource => ({
    resourceType: "compute",
    provider: baseProvider,
    resourceId: "i-abc123",
    region: "us-east-1",
    instanceType: "m5.large",
    tier: "general" as const,
    vcpus: 2,
    memoryGb: 8,
    state: "running",
    monthlyCostEstimate: 100,
    ...overrides,
  });

  const makeStorage = (overrides?: Partial<StorageResource>): StorageResource => ({
    resourceType: "storage",
    provider: baseProvider,
    resourceId: "bucket-xyz",
    region: "us-east-1",
    storageClass: "standard" as const,
    sizeGb: 100,
    monthlyCostEstimate: 5,
    ...overrides,
  });

  // Test 1: No drift when snapshots are identical
  {
    const snap = makeSnapshot({ resources: [makeCompute()] });
    const report = detectDrift({
      organizationId: "org1",
      cloudAccountId: "acc1",
      currentSnapshot: snap,
      previousSnapshot: snap,
    });
    results.push({
      name: "No drift when snapshots are identical",
      passed: report.items.length === 0 && report.summary.totalDrifts === 0,
      detail: `Drifts: ${report.items.length}`,
    });
  }

  // Test 2: Terraform plan drift detects missing resource
  {
    const snap = makeSnapshot({ resources: [] });
    const report = detectDrift({
      organizationId: "org1",
      cloudAccountId: "acc1",
      currentSnapshot: snap,
      terraformPlan: {
        runId: "run-1",
        generatedAt: new Date().toISOString(),
        resources: [{
          resourceId: "i-planned",
          provider: baseProvider,
          region: "us-east-1",
          resourceType: "compute",
          plannedFields: { instanceType: "m5.large" },
        }],
      },
    });
    const planDrift = report.items.find((i) => i.resourceId === "i-planned" && i.source === "terraform_plan");
    results.push({
      name: "Terraform plan drift detects missing resource",
      passed: planDrift !== undefined && planDrift.severity === "high",
      detail: `Found: ${planDrift?.title ?? "none"}, severity: ${planDrift?.severity}`,
    });
  }

  // Test 3: Terraform plan drift detects field mismatch
  {
    const snap = makeSnapshot({
      resources: [makeCompute({ resourceId: "i-tf", instanceType: "m5.xlarge" })],
    });
    const report = detectDrift({
      organizationId: "org1",
      cloudAccountId: "acc1",
      currentSnapshot: snap,
      terraformPlan: {
        runId: "run-2",
        generatedAt: new Date().toISOString(),
        resources: [{
          resourceId: "i-tf",
          provider: baseProvider,
          region: "us-east-1",
          resourceType: "compute",
          plannedFields: { instanceType: "m5.large" },
        }],
      },
    });
    const drift = report.items.find((i) => i.resourceId === "i-tf" && i.fieldChanges[0]?.field === "instanceType");
    results.push({
      name: "Terraform plan drift detects field mismatch",
      passed: drift !== undefined && drift.fieldChanges[0]?.expected === "m5.large" && drift.fieldChanges[0]?.actual === "m5.xlarge",
      detail: `Expected: ${String(drift?.fieldChanges[0]?.expected)}, Actual: ${String(drift?.fieldChanges[0]?.actual)}`,
    });
  }

  // Test 4: Manual resize detected
  {
    const prev = makeSnapshot({ resources: [makeCompute({ instanceType: "t3.micro" })] });
    const curr = makeSnapshot({ resources: [makeCompute({ instanceType: "t3.xlarge" })] });
    const report = detectDrift({
      organizationId: "org1",
      cloudAccountId: "acc1",
      currentSnapshot: curr,
      previousSnapshot: prev,
    });
    const resize = report.items.find((i) => i.category === "config_mutation");
    results.push({
      name: "Manual resize detected as config_mutation",
      passed: resize !== undefined && resize.remediation.automatable,
      detail: `Found: ${resize?.title ?? "none"}`,
    });
  }

  // Test 5: Planned resize is NOT flagged as drift
  {
    const prev = makeSnapshot({ resources: [makeCompute({ instanceType: "t3.micro" })] });
    const curr = makeSnapshot({ resources: [makeCompute({ instanceType: "t3.large" })] });
    const report = detectDrift({
      organizationId: "org1",
      cloudAccountId: "acc1",
      currentSnapshot: curr,
      previousSnapshot: prev,
      executionPlan: {
        runId: "run-3",
        approvedAt: new Date().toISOString(),
        approvedItems: [{
          planItemId: "pi-1",
          resourceId: "i-abc123",
          actionType: ActionType.ResizeCompute,
          provider: baseProvider,
          region: "us-east-1",
          expectedState: { instanceType: "t3.large" },
          appliedAt: new Date().toISOString(),
        }],
      },
    });
    const resize = report.items.find((i) => i.category === "config_mutation" && i.resourceId === "i-abc123");
    results.push({
      name: "Planned resize is not flagged as manual drift",
      passed: resize === undefined,
      detail: `Manual resize items for i-abc123: ${resize ? "found" : "none"}`,
    });
  }

  // Test 6: Backup removal detected
  {
    const prev = makeSnapshot({ flags: { singleRegion: false, noBackupsDetected: false } });
    const curr = makeSnapshot({ flags: { singleRegion: false, noBackupsDetected: true } });
    const report = detectDrift({
      organizationId: "org1",
      cloudAccountId: "acc1",
      currentSnapshot: curr,
      previousSnapshot: prev,
    });
    const backup = report.items.find((i) => i.category === "resilience_regression" && i.title.includes("Backup"));
    results.push({
      name: "Backup removal detected as resilience_regression",
      passed: backup !== undefined && backup.severity === "high",
      detail: `Found: ${backup?.title ?? "none"}`,
    });
  }

  // Test 7: Region concentration regression
  {
    const prev = makeSnapshot({ regions: ["us-east-1", "us-west-2"] });
    const curr = makeSnapshot({ regions: ["us-east-1"] });
    const report = detectDrift({
      organizationId: "org1",
      cloudAccountId: "acc1",
      currentSnapshot: curr,
      previousSnapshot: prev,
      resilienceBaseline: { ...DEFAULT_RESILIENCE_BASELINE, minRegionCount: 2 },
    });
    const region = report.items.find((i) => i.title.includes("Region count"));
    results.push({
      name: "Region concentration regression detected",
      passed: region !== undefined && region.category === "resilience_regression",
      detail: `Found: ${region?.title ?? "none"}`,
    });
  }

  // Test 8: Unexpected resource addition
  {
    const prev = makeSnapshot({ resources: [makeCompute()] });
    const curr = makeSnapshot({
      resources: [
        makeCompute(),
        makeCompute({ resourceId: "i-new-surprise" }),
      ],
    });
    const report = detectDrift({
      organizationId: "org1",
      cloudAccountId: "acc1",
      currentSnapshot: curr,
      previousSnapshot: prev,
    });
    const added = report.items.find((i) => i.resourceId === "i-new-surprise");
    results.push({
      name: "Unexpected resource addition detected",
      passed: added !== undefined && added.category === "resource_lifecycle" && added.severity === "low",
      detail: `Found: ${added?.title ?? "none"}`,
    });
  }

  // Test 9: Unexpected resource removal
  {
    const prev = makeSnapshot({
      resources: [makeCompute(), makeCompute({ resourceId: "i-vanished" })],
    });
    const curr = makeSnapshot({ resources: [makeCompute()] });
    const report = detectDrift({
      organizationId: "org1",
      cloudAccountId: "acc1",
      currentSnapshot: curr,
      previousSnapshot: prev,
    });
    const removed = report.items.find((i) => i.resourceId === "i-vanished");
    results.push({
      name: "Unexpected resource removal detected as high severity",
      passed: removed !== undefined && removed.severity === "high" && !removed.suppressible,
      detail: `Found: ${removed?.title ?? "none"}, severity: ${removed?.severity}`,
    });
  }

  // Test 10: Suppression prevents drift from appearing
  {
    const prev = makeSnapshot({ resources: [makeCompute({ instanceType: "t3.micro" })] });
    const curr = makeSnapshot({ resources: [makeCompute({ instanceType: "t3.xlarge" })] });
    const report = detectDrift({
      organizationId: "org1",
      cloudAccountId: "acc1",
      currentSnapshot: curr,
      previousSnapshot: prev,
      suppressedKeys: ["config_mutation:i-abc123:instanceType"],
    });
    const resize = report.items.find((i) => i.category === "config_mutation" && i.resourceId === "i-abc123");
    results.push({
      name: "Suppressed drift key prevents drift from appearing",
      passed: resize === undefined,
      detail: `Suppressed resize: ${resize ? "found (BAD)" : "not found (GOOD)"}`,
    });
  }

  // Test 11: Notification includes severity sections
  {
    const prev = makeSnapshot({
      resources: [makeCompute({ instanceType: "t3.micro" })],
      flags: { singleRegion: false, noBackupsDetected: false },
    });
    const curr = makeSnapshot({
      resources: [makeCompute({ instanceType: "t3.xlarge" })],
      flags: { singleRegion: false, noBackupsDetected: true },
    });
    const report = detectDrift({
      organizationId: "org1",
      cloudAccountId: "acc1",
      currentSnapshot: curr,
      previousSnapshot: prev,
    });
    results.push({
      name: "Drift notification includes severity sections",
      passed: report.notification !== null && report.notification.sections.length > 0,
      detail: `Notification: ${report.notification?.title ?? "none"}, sections: ${report.notification?.sections.length ?? 0}`,
    });
  }

  // Test 12: Summary counts are correct
  {
    const prev = makeSnapshot({
      resources: [
        makeCompute({ instanceType: "t3.micro" }),
        makeStorage(),
      ],
      flags: { singleRegion: false, noBackupsDetected: false },
    });
    const curr = makeSnapshot({
      resources: [
        makeCompute({ instanceType: "t3.xlarge" }),
        makeStorage(),
        makeCompute({ resourceId: "i-new" }),
      ],
      flags: { singleRegion: false, noBackupsDetected: true },
    });
    const report = detectDrift({
      organizationId: "org1",
      cloudAccountId: "acc1",
      currentSnapshot: curr,
      previousSnapshot: prev,
    });
    const s = report.summary;
    results.push({
      name: "Summary counts match item totals",
      passed:
        s.totalDrifts === report.items.length &&
        s.totalDrifts > 0 &&
        Object.values(s.bySeverity).reduce((a, b) => a + b, 0) === s.totalDrifts,
      detail: `Total: ${s.totalDrifts}, severity sum: ${Object.values(s.bySeverity).reduce((a, b) => a + b, 0)}`,
    });
  }

  // Test 13: Execution plan drift detects reverted change
  {
    const compute = makeCompute({ resourceId: "i-reverted", instanceType: "t3.micro" });
    const curr = makeSnapshot({ resources: [compute] });
    const report = detectDrift({
      organizationId: "org1",
      cloudAccountId: "acc1",
      currentSnapshot: curr,
      executionPlan: {
        runId: "run-4",
        approvedAt: new Date().toISOString(),
        approvedItems: [{
          planItemId: "pi-2",
          resourceId: "i-reverted",
          actionType: ActionType.ResizeCompute,
          provider: baseProvider,
          region: "us-east-1",
          expectedState: { instanceType: "t3.large" },
          appliedAt: new Date().toISOString(),
          verifiedAt: new Date().toISOString(),
        }],
      },
    });
    const reverted = report.items.find(
      (i) => i.source === "execution_plan" && i.resourceId === "i-reverted",
    );
    results.push({
      name: "Execution plan drift detects reverted approved change",
      passed: reverted !== undefined && reverted.severity === "high" && !reverted.suppressible,
      detail: `Found: ${reverted?.title ?? "none"}`,
    });
  }

  // Test 14: Drifts are sorted by severity (critical first)
  {
    const prev = makeSnapshot({
      resources: [
        makeCompute({ instanceType: "t3.micro" }),
      ],
      flags: { singleRegion: false, noBackupsDetected: false },
    });
    const curr = makeSnapshot({
      resources: [
        makeCompute({ instanceType: "t3.xlarge" }),
        makeCompute({ resourceId: "i-new" }),
      ],
      flags: { singleRegion: false, noBackupsDetected: true },
    });
    const report = detectDrift({
      organizationId: "org1",
      cloudAccountId: "acc1",
      currentSnapshot: curr,
      previousSnapshot: prev,
    });
    const severities = report.items.map((i) => i.severity);
    const order: Record<DriftSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    let sorted = true;
    for (let i = 1; i < severities.length; i++) {
      if (order[severities[i]] < order[severities[i - 1]]) {
        sorted = false;
        break;
      }
    }
    results.push({
      name: "Drift items are sorted by severity (critical first)",
      passed: sorted && report.items.length > 1,
      detail: `Severities: [${severities.join(", ")}]`,
    });
  }

  // Test 15: All 10 rules are registered
  {
    results.push({
      name: "All 10 drift rules are registered",
      passed: ALL_DRIFT_RULES.length === 10,
      detail: `Rules: ${ALL_DRIFT_RULES.length} — [${ALL_DRIFT_RULES.map((r) => r.id).join(", ")}]`,
    });
  }

  _resetDriftCounter();
  return results;
}
