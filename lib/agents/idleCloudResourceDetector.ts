/**
 * Pure idle cloud-resource detector.
 *
 * Input: a heterogeneous list of cloud resources (EBS / EIP / Lambda
 * / Snapshot / RDS / ELB) with usage telemetry. Output: a typed list
 * of idle-resource findings, each with monthly cost saved + risk +
 * recommendation (delete / snapshot-and-delete / downsize / tag).
 *
 * Pure / no I/O. The kernel only proposes; deletion is staged via
 * the approval engine — never executed by this module.
 *
 * Closed unions on resource kind + verdict so future shapes break
 * the build.
 */

export type IdleResourceKind =
  | "ebs_volume_unattached"
  | "elastic_ip_unattached"
  | "lambda_dormant"
  | "snapshot_old"
  | "rds_idle"
  | "elb_no_targets"
  | "s3_bucket_empty";

export type IdleVerdict =
  | "delete_immediately"
  | "snapshot_then_delete"
  | "downsize"
  | "tag_for_review"
  | "keep";

export type RiskTier = "low" | "medium" | "high";

export interface IdleResourceInput {
  /** Cloud-provider resource id. */
  id: string;
  kind: IdleResourceKind;
  /** AWS region / Azure location / GCP region. */
  region: string;
  /** Days since the resource last did something useful. */
  daysIdle: number;
  /** Estimated monthly USD cost of this resource. */
  monthlyUsd: number;
  /** Has at least one tag indicating production / persistence. */
  hasProductionTag: boolean;
  /** Whether a backup / snapshot exists. */
  hasBackup: boolean;
  /** Optional resource-specific size — e.g. EBS GB. */
  sizeGb?: number;
  /** Optional name. */
  name?: string;
}

export interface IdleResourceFinding {
  id: string;
  resourceId: string;
  kind: IdleResourceKind;
  verdict: IdleVerdict;
  riskTier: RiskTier;
  /** Estimated monthly USD saved if the action lands. */
  monthlySavingsUsd: number;
  /** Closed-union recommendation card. */
  recommendation:
    | { kind: "delete" }
    | { kind: "snapshot_then_delete"; snapshotRetentionDays: number }
    | { kind: "downsize"; suggestedSize: string }
    | { kind: "tag_for_review"; suggestedTag: string };
  /** Operator-readable rationale. */
  rationale: string;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `idle-${counter}`;
}
export function __resetIdleCounter(): void { counter = 0; }

/** Idle-day thresholds per kind. Below these days a resource is not idle. */
const IDLE_THRESHOLD_DAYS: Record<IdleResourceKind, number> = {
  ebs_volume_unattached: 14,
  elastic_ip_unattached: 7,
  lambda_dormant:        90,
  snapshot_old:          180,
  rds_idle:              30,
  elb_no_targets:        14,
  s3_bucket_empty:       30,
};

export function detectIdleResources(
  inputs: readonly IdleResourceInput[],
): readonly IdleResourceFinding[] {
  const out: IdleResourceFinding[] = [];
  for (const r of inputs) {
    out.push(classify(r));
  }
  // Sort: largest savings first.
  return [...out].sort((a, b) => b.monthlySavingsUsd - a.monthlySavingsUsd);
}

function classify(r: IdleResourceInput): IdleResourceFinding {
  const threshold = IDLE_THRESHOLD_DAYS[r.kind];

  // Not idle long enough — keep.
  if (r.daysIdle < threshold) {
    return {
      id: nextId(),
      resourceId: r.id,
      kind: r.kind,
      verdict: "keep",
      riskTier: "low",
      monthlySavingsUsd: 0,
      recommendation: { kind: "tag_for_review", suggestedTag: "idle:watch" },
      rationale: `Idle ${r.daysIdle}d; threshold for ${r.kind} is ${threshold}d. Keep + watch.`,
    };
  }

  const savings = r.monthlyUsd;

  // Production-tagged resources never auto-delete.
  if (r.hasProductionTag) {
    return {
      id: nextId(),
      resourceId: r.id,
      kind: r.kind,
      verdict: "tag_for_review",
      riskTier: "medium",
      monthlySavingsUsd: 0,
      recommendation: { kind: "tag_for_review", suggestedTag: "idle:production_review" },
      rationale: `Resource has production tag — refuse to propose delete. Surface for human review (potential $${savings.toFixed(0)}/mo saving).`,
    };
  }

  switch (r.kind) {
    case "elastic_ip_unattached":
      return {
        id: nextId(),
        resourceId: r.id,
        kind: r.kind,
        verdict: "delete_immediately",
        riskTier: "low",
        monthlySavingsUsd: savings,
        recommendation: { kind: "delete" },
        rationale: `EIP idle ${r.daysIdle}d, no production tag. Safe to release.`,
      };

    case "ebs_volume_unattached":
      return {
        id: nextId(),
        resourceId: r.id,
        kind: r.kind,
        verdict: r.hasBackup ? "delete_immediately" : "snapshot_then_delete",
        riskTier: r.hasBackup ? "low" : "medium",
        monthlySavingsUsd: savings,
        recommendation: r.hasBackup
          ? { kind: "delete" }
          : { kind: "snapshot_then_delete", snapshotRetentionDays: 30 },
        rationale: r.hasBackup
          ? `Unattached EBS with existing backup → delete safely.`
          : `Unattached EBS without backup → snapshot first, retain 30d, then delete.`,
      };

    case "snapshot_old":
      return {
        id: nextId(),
        resourceId: r.id,
        kind: r.kind,
        verdict: "delete_immediately",
        riskTier: "low",
        monthlySavingsUsd: savings,
        recommendation: { kind: "delete" },
        rationale: `Snapshot ${r.daysIdle}d old, no production tag. Delete to free $${savings.toFixed(2)}/mo.`,
      };

    case "lambda_dormant":
      return {
        id: nextId(),
        resourceId: r.id,
        kind: r.kind,
        verdict: "tag_for_review",
        riskTier: "medium",
        monthlySavingsUsd: savings,
        recommendation: { kind: "tag_for_review", suggestedTag: "idle:lambda_review" },
        rationale: `Lambda dormant ${r.daysIdle}d. May be a planned cold path — tag, don't auto-delete.`,
      };

    case "rds_idle":
      return {
        id: nextId(),
        resourceId: r.id,
        kind: r.kind,
        verdict: "downsize",
        riskTier: "medium",
        monthlySavingsUsd: Math.round(savings * 0.5),
        recommendation: { kind: "downsize", suggestedSize: "one tier smaller" },
        rationale: `RDS instance idle ${r.daysIdle}d. Downsize for ~50% saving instead of full delete.`,
      };

    case "elb_no_targets":
      return {
        id: nextId(),
        resourceId: r.id,
        kind: r.kind,
        verdict: "delete_immediately",
        riskTier: "low",
        monthlySavingsUsd: savings,
        recommendation: { kind: "delete" },
        rationale: `ELB with no registered targets for ${r.daysIdle}d. Safe to delete.`,
      };

    case "s3_bucket_empty":
      return {
        id: nextId(),
        resourceId: r.id,
        kind: r.kind,
        verdict: "tag_for_review",
        riskTier: "low",
        monthlySavingsUsd: 0, // empty buckets cost ~nothing
        recommendation: { kind: "tag_for_review", suggestedTag: "idle:empty_bucket" },
        rationale: `Bucket empty for ${r.daysIdle}d. Tag for cleanup — but empty buckets carry name-squatting risk so review before delete.`,
      };
  }
}

export interface IdleSummary {
  totalFindings: number;
  totalMonthlySavingsUsd: number;
  byVerdict: Readonly<Record<IdleVerdict, number>>;
}

export function summarizeIdle(findings: readonly IdleResourceFinding[]): IdleSummary {
  const byVerdict: Record<IdleVerdict, number> = {
    delete_immediately: 0, snapshot_then_delete: 0, downsize: 0, tag_for_review: 0, keep: 0,
  };
  let savings = 0;
  for (const f of findings) {
    byVerdict[f.verdict] += 1;
    savings += f.monthlySavingsUsd;
  }
  return {
    totalFindings: findings.length,
    totalMonthlySavingsUsd: Math.round(savings * 100) / 100,
    byVerdict,
  };
}
