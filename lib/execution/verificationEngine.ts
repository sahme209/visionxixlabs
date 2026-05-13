/**
 * Verification engine — defines what "success" looks like for an execution plan.
 *
 * Every plan ships with a typed VerificationSpec covering:
 *   - pre-checks  (conditions that must be true before apply)
 *   - post-checks (conditions that prove the intended outcome)
 *   - monitoring  (background watchers for drift / cost shift)
 *   - rollback verification
 *
 * Checks are deterministic + audit-traceable. The verification engine does
 * NOT execute checks — it produces the spec for the execution engine to run.
 */

import type { ReasonedRecommendation } from "@/lib/agent/snapshotReasoner";
import type { ResourceRef } from "@/lib/cloud/snapshotModel";

export type VerificationCheckKind =
  | "pre.permission"
  | "pre.health"
  | "pre.dependency"
  | "pre.snapshot"
  | "post.state"
  | "post.health"
  | "post.cost"
  | "post.security_posture"
  | "post.drift"
  | "monitoring.slo"
  | "monitoring.cost_anomaly"
  | "monitoring.drift_window"
  | "rollback.state"
  | "rollback.health";

export interface VerificationCheck {
  id: string;
  kind: VerificationCheckKind;
  /** What this check verifies. */
  description: string;
  /** Concrete provider command or query, if applicable. */
  command?: string;
  /** Expected result for success. */
  expected: string;
  /** What failure of this check means. */
  failureMeaning: string;
  /** Maximum time allowed for the check to converge. */
  timeoutSec: number;
}

export interface VerificationSpec {
  planId: string;
  /** Conditions that must be true before apply begins. */
  preChecks: VerificationCheck[];
  /** Conditions that must be true after apply for success. */
  postChecks: VerificationCheck[];
  /** Ongoing checks that run after success is confirmed. */
  monitoring: VerificationCheck[];
  /** Checks that run after a rollback completes. */
  rollbackVerification: VerificationCheck[];
  /** What success looks like in one sentence. */
  successDefinition: string;
  /** What failure looks like and what happens next. */
  failureDefinition: string;
}

/**
 * Build a verification spec for a plan.
 */
export function buildVerificationSpec(
  planId: string,
  rec: ReasonedRecommendation,
  affectedResources: ResourceRef[]
): VerificationSpec {
  const action = rec.action.toLowerCase();
  const provider = affectedResources[0]?.provider ?? "aws";
  const region = affectedResources[0]?.region;

  const preChecks: VerificationCheck[] = baseChecks(provider, region, "pre", affectedResources);
  const postChecks: VerificationCheck[] = baseChecks(provider, region, "post", affectedResources);
  const monitoring: VerificationCheck[] = monitoringChecks(provider, rec, affectedResources);
  const rollbackVerification: VerificationCheck[] = rollbackChecks(provider, region, affectedResources);

  // Add action-specific verification
  if (/right-?size/.test(action)) {
    postChecks.push(...rightsizePostChecks(affectedResources));
  } else if (/lifecycle/.test(action)) {
    postChecks.push(...lifecyclePostChecks(affectedResources));
  } else if (/tag/.test(action)) {
    postChecks.push(...tagPostChecks(affectedResources));
  }

  return {
    planId,
    preChecks,
    postChecks,
    monitoring,
    rollbackVerification,
    successDefinition: buildSuccessDefinition(rec),
    failureDefinition: buildFailureDefinition(rec),
  };
}

// ---------------------------------------------------------------------------
// Check builders
// ---------------------------------------------------------------------------

function baseChecks(provider: string, region: string | undefined, phase: "pre" | "post", refs: ResourceRef[]): VerificationCheck[] {
  const out: VerificationCheck[] = [];
  if (phase === "pre") {
    out.push({
      id: `pre_permission_${provider}`,
      kind: "pre.permission",
      description: "Provider role has required permissions for the plan",
      command: provider === "aws" ? `aws sts get-caller-identity` : undefined,
      expected: "200 OK — role assumable",
      failureMeaning: "Role lost permissions or was deleted; plan blocked.",
      timeoutSec: 10,
    });
    out.push({
      id: `pre_snapshot_${refs[0]?.id ?? "_"}`,
      kind: "pre.snapshot",
      description: "Pre-flight snapshot captured for every affected resource",
      expected: "All affected resources have a recorded pre-flight state",
      failureMeaning: "Snapshot missing; rollback path not verified; plan blocked.",
      timeoutSec: 60,
    });
    out.push({
      id: `pre_health_${refs[0]?.id ?? "_"}`,
      kind: "pre.health",
      description: "Affected resources are in a healthy steady state",
      expected: "No active alarms, no health-check failures on dependent resources",
      failureMeaning: "Apply during unhealthy state increases blast radius — plan blocked.",
      timeoutSec: 30,
    });
  } else {
    out.push({
      id: `post_state_${refs[0]?.id ?? "_"}`,
      kind: "post.state",
      description: "Resource state matches the intended target state",
      expected: "Provider describe call returns expected configuration",
      failureMeaning: "Apply did not land as expected; rollback fires.",
      timeoutSec: 120,
    });
    out.push({
      id: `post_health_${refs[0]?.id ?? "_"}`,
      kind: "post.health",
      description: "Affected resources return to healthy state within RTO",
      expected: "ALB / health-check / SLO all healthy within 60s of apply",
      failureMeaning: "Health failure post-apply; rollback fires automatically.",
      timeoutSec: 120,
    });
  }
  void region;
  return out;
}

function rightsizePostChecks(refs: ResourceRef[]): VerificationCheck[] {
  return refs.flatMap((ref) => ([
    {
      id: `post_rightsize_type_${ref.id}`,
      kind: "post.state" as VerificationCheckKind,
      description: `Instance ${ref.id} has the target instance type`,
      command: `aws ec2 describe-instances --instance-ids ${ref.id} --query 'Reservations[].Instances[].InstanceType'`,
      expected: "Target instance class returned",
      failureMeaning: "Modify failed; rollback fires.",
      timeoutSec: 30,
    },
    {
      id: `post_rightsize_cost_${ref.id}`,
      kind: "post.cost" as VerificationCheckKind,
      description: `Cost shift for ${ref.id} matches predicted savings within ±10%`,
      command: "aws ce get-cost-and-usage --granularity DAILY --time-period <last-3d>",
      expected: "Predicted monthly savings observed in Cost Explorer within 24 hours",
      failureMeaning: "Cost behaviour didn't shift as expected — investigate.",
      timeoutSec: 24 * 3600,
    },
  ]));
}

function lifecyclePostChecks(refs: ResourceRef[]): VerificationCheck[] {
  return refs.map((ref) => ({
    id: `post_lifecycle_${ref.id}`,
    kind: "post.state" as VerificationCheckKind,
    description: `Lifecycle configuration on ${ref.id} matches the intended policy`,
    command: `aws s3api get-bucket-lifecycle-configuration --bucket ${ref.id}`,
    expected: "Lifecycle config equals plan-specified policy",
    failureMeaning: "Policy not applied as intended; rollback or re-apply.",
    timeoutSec: 30,
  }));
}

function tagPostChecks(refs: ResourceRef[]): VerificationCheck[] {
  return refs.map((ref) => ({
    id: `post_tag_${ref.id}`,
    kind: "post.state" as VerificationCheckKind,
    description: `Tags present on ${ref.id}`,
    command: `aws ec2 describe-tags --filters Name=resource-id,Values=${ref.id}`,
    expected: "Managed_By and Plan_Id tags present",
    failureMeaning: "Tag apply failed; retry.",
    timeoutSec: 10,
  }));
}

function monitoringChecks(provider: string, rec: ReasonedRecommendation, refs: ResourceRef[]): VerificationCheck[] {
  void provider;
  return [
    {
      id: `mon_slo_${rec.id}`,
      kind: "monitoring.slo",
      description: "SLO for affected service remains within bounds for 30 minutes post-apply",
      expected: "No SLO violations during 30-minute observation window",
      failureMeaning: "Performance regressed post-apply; rollback eligible.",
      timeoutSec: 30 * 60,
    },
    {
      id: `mon_drift_${rec.id}`,
      kind: "monitoring.drift_window",
      description: "No new drift events on affected resources for 12 hours post-apply",
      expected: "No out-of-band changes detected",
      failureMeaning: "Apply may have triggered external automation; investigate.",
      timeoutSec: 12 * 3600,
    },
    {
      id: `mon_cost_${rec.id}`,
      kind: "monitoring.cost_anomaly",
      description: "No cost anomaly detected for the affected scope in next 48 hours",
      expected: "Daily cost stays within ±10% of predicted post-apply trajectory",
      failureMeaning: "Cost moved unexpectedly; could indicate broader impact.",
      timeoutSec: 48 * 3600,
    },
  ];
  void refs;
}

function rollbackChecks(provider: string, region: string | undefined, refs: ResourceRef[]): VerificationCheck[] {
  void provider; void region;
  return [
    {
      id: `rb_state_${refs[0]?.id ?? "_"}`,
      kind: "rollback.state",
      description: "Post-rollback state matches pre-flight snapshot for every affected resource",
      expected: "Resource state equal to captured pre-flight state",
      failureMeaning: "Rollback didn't fully restore; manual review required.",
      timeoutSec: 120,
    },
    {
      id: `rb_health_${refs[0]?.id ?? "_"}`,
      kind: "rollback.health",
      description: "Health checks return to pre-apply baseline",
      expected: "ALB / SLO / alarms back to pre-apply state",
      failureMeaning: "Health failure persisting after rollback; on-call escalation triggered.",
      timeoutSec: 120,
    },
  ];
}

function buildSuccessDefinition(rec: ReasonedRecommendation): string {
  if (rec.monthlySavingsUsd && rec.monthlySavingsUsd > 0) {
    return `Resource state matches the plan target, health stays healthy, and cost shift of ~$${Math.round(rec.monthlySavingsUsd)}/mo lands in Cost Explorer within 24 hours.`;
  }
  return `Resource state matches the plan target and health stays healthy for the post-apply observation window.`;
}

function buildFailureDefinition(rec: ReasonedRecommendation): string {
  return `Any health failure post-apply triggers automatic rollback. Rollback executes the plan's prepared strategy${rec.rollback ? ` (${rec.rollback.split("(")[0].trim()})` : ""} and the audit log records both events.`;
}
