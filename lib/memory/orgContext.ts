/**
 * Organization context profile — typed snapshot of operational maturity
 * derived from memory records. Powers personalized recommendations,
 * onboarding suggestions, executive summaries, and the trust UI.
 *
 * Never stores secrets. Never stores credentials. Only structured patterns.
 */

import type { CloudProvider } from "@/lib/connectors/interface";
import type { MemoryStore, MemoryRecord } from "@/lib/memory/operationalMemory";

// ---------------------------------------------------------------------------
// Maturity model
// ---------------------------------------------------------------------------

export type MaturityLevel = "beginner" | "developing" | "operational" | "mature" | "advanced";

export interface MaturityScore {
  level: MaturityLevel;
  /** Score in [0, 100]. */
  score: number;
  /** What raised the score recently. */
  drivers: string[];
  /** What is holding the score down. */
  gaps: string[];
}

export interface ApprovalBehaviorProfile {
  averageDecisionLatencyMs: number;
  approvalRate: number;          // [0, 1]
  rejectionRate: number;
  deferRate: number;
  expiredRate: number;
  /** Action classes the team consistently approves quickly. */
  fastTrackClasses: string[];
  /** Action classes the team consistently questions. */
  scrutinizedClasses: string[];
}

export interface ExecutionPreferenceProfile {
  /** Does the team prefer Axiom-applied execution or Terraform export? */
  preferredExecutionMode: "axiom_apply" | "terraform_export" | "cli_export" | "mixed";
  /** Confidence in the team's preferred mode in [0, 1]. */
  confidence: number;
}

export interface OrganizationContext {
  organizationId: string;
  connectedProviders: CloudProvider[];
  /** Most-common resource kinds observed. */
  topResourceKinds: { kind: string; count: number }[];
  /** Most-used regions across providers. */
  topRegions: { region: string; count: number }[];
  /** Cloud operational maturity. */
  cloudMaturity: MaturityScore;
  /** ReleaseOps maturity. */
  releaseOpsMaturity: MaturityScore;
  /** Governance maturity (approval, audit, rollback discipline). */
  governanceMaturity: MaturityScore;
  /** Approval behavior. */
  approval: ApprovalBehaviorProfile;
  /** Execution preference. */
  execution: ExecutionPreferenceProfile;
  /** Resources that recur as problematic. */
  recurringProblemResources: string[];
  /** Common cost optimization patterns observed. */
  costPatterns: string[];
  /** Last computed timestamp. */
  computedAt: string;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export async function buildOrgContext(organizationId: string, store: MemoryStore): Promise<OrganizationContext> {
  const all = await store.query({ organizationId, limit: 2000 });
  const recent = all.filter((r) => Date.parse(r.occurredAt) > Date.now() - 90 * 86_400_000);

  return {
    organizationId,
    connectedProviders: deriveProviders(all),
    topResourceKinds: topByField(all, (r) => r.resources.map((res) => res.id.split(".")[0])).slice(0, 5).map(([kind, count]) => ({ kind, count })),
    topRegions: topByField(all, (r) => r.resources.map((res) => res.region ?? "_")).filter(([region]) => region !== "_").slice(0, 5).map(([region, count]) => ({ region, count })),
    cloudMaturity: computeCloudMaturity(recent),
    releaseOpsMaturity: computeReleaseOpsMaturity(recent),
    governanceMaturity: computeGovernanceMaturity(recent),
    approval: computeApprovalBehavior(recent),
    execution: computeExecutionPreference(recent),
    recurringProblemResources: computeRecurringProblemResources(recent),
    costPatterns: computeCostPatterns(recent),
    computedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Sub-computations
// ---------------------------------------------------------------------------

function deriveProviders(records: MemoryRecord[]): CloudProvider[] {
  const set = new Set<CloudProvider>();
  for (const r of records) if (r.provider) set.add(r.provider);
  return Array.from(set);
}

function topByField<T>(records: T[], extract: (r: T) => string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const r of records) {
    for (const v of extract(r)) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function computeCloudMaturity(records: MemoryRecord[]): MaturityScore {
  const scans = records.filter((r) => r.kind === "scan.completed").length;
  const applies = records.filter((r) => r.kind === "execution.applied").length;
  const verifyPass = records.filter((r) => r.kind === "verification.passed").length;
  const rollbacks = records.filter((r) => r.kind === "rollback.executed").length;

  let score = 0;
  const drivers: string[] = [];
  const gaps: string[] = [];

  if (scans >= 10) { score += 25; drivers.push("Regular scanning cadence"); } else { gaps.push("Increase scan frequency"); }
  if (applies >= 5) { score += 25; drivers.push("Active execution"); } else { gaps.push("Execute approved plans"); }
  if (verifyPass / Math.max(1, applies) > 0.9) { score += 25; drivers.push("High verification pass rate"); } else { gaps.push("Improve verification reliability"); }
  if (rollbacks / Math.max(1, applies) < 0.1) { score += 25; drivers.push("Low rollback rate"); } else { gaps.push("Rollback rate above target"); }

  return { level: levelFromScore(score), score, drivers, gaps };
}

function computeReleaseOpsMaturity(records: MemoryRecord[]): MaturityScore {
  const deploys = records.filter((r) => r.kind === "release.deployed").length;
  const blocks = records.filter((r) => r.kind === "release.blocked").length;
  const readinessChanges = records.filter((r) => r.kind === "release.readiness_changed").length;

  let score = 0;
  const drivers: string[] = [];
  const gaps: string[] = [];

  if (deploys >= 5) { score += 30; drivers.push("Active deployment activity"); } else { gaps.push("Connect ReleaseOps to surface deploys"); }
  if (blocks / Math.max(1, deploys) < 0.1) { score += 30; drivers.push("Low block rate"); } else { gaps.push("Address frequent release blockers"); }
  if (readinessChanges >= 1) { score += 20; drivers.push("Readiness scoring active"); } else { gaps.push("Activate readiness scoring"); }

  return { level: levelFromScore(score), score, drivers, gaps };
}

function computeGovernanceMaturity(records: MemoryRecord[]): MaturityScore {
  const approvals = records.filter((r) => r.kind === "approval.granted" || r.kind === "approval.denied").length;
  const rollbackExec = records.filter((r) => r.kind === "rollback.executed").length;
  const rollbackVerified = records.filter((r) => r.kind === "rollback.executed" && r.outcome === "positive").length;

  let score = 0;
  const drivers: string[] = [];
  const gaps: string[] = [];

  if (approvals >= 5) { score += 40; drivers.push("Active approval discipline"); } else { gaps.push("Establish approval workflow"); }
  if (rollbackVerified / Math.max(1, rollbackExec) > 0.9) { score += 40; drivers.push("Reliable rollback"); } else { gaps.push("Verify rollback strategies"); }
  if (records.some((r) => r.evidence.length > 0)) { score += 20; drivers.push("Audit evidence captured"); } else { gaps.push("Improve evidence capture"); }

  return { level: levelFromScore(score), score, drivers, gaps };
}

function computeApprovalBehavior(records: MemoryRecord[]): ApprovalBehaviorProfile {
  const decisions = records.filter((r) => r.kind === "approval.granted" || r.kind === "approval.denied" || r.kind === "approval.expired");
  const approvals = decisions.filter((r) => r.kind === "approval.granted").length;
  const rejections = decisions.filter((r) => r.kind === "approval.denied").length;
  const expired = decisions.filter((r) => r.kind === "approval.expired").length;
  const deferred = records.filter((r) => r.kind === "recommendation.deferred").length;
  const total = decisions.length || 1;

  return {
    averageDecisionLatencyMs: 0, // Wire from real timestamps later
    approvalRate: approvals / total,
    rejectionRate: rejections / total,
    deferRate: deferred / total,
    expiredRate: expired / total,
    fastTrackClasses: [],
    scrutinizedClasses: [],
  };
}

function computeExecutionPreference(records: MemoryRecord[]): ExecutionPreferenceProfile {
  const applies = records.filter((r) => r.kind === "execution.applied").length;
  const exports_ = records.filter((r) => r.kind === "user.decision" && r.summary.toLowerCase().includes("export")).length;
  if (applies > exports_ * 2) return { preferredExecutionMode: "axiom_apply", confidence: Math.min(0.95, 0.6 + applies * 0.02) };
  if (exports_ > applies * 2) return { preferredExecutionMode: "terraform_export", confidence: Math.min(0.95, 0.6 + exports_ * 0.02) };
  if (applies === 0 && exports_ === 0) return { preferredExecutionMode: "mixed", confidence: 0 };
  return { preferredExecutionMode: "mixed", confidence: 0.5 };
}

function computeRecurringProblemResources(records: MemoryRecord[]): string[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    if (r.kind !== "finding.recurring" && r.kind !== "drift.detected" && r.kind !== "execution.failed") continue;
    for (const res of r.resources) counts.set(res.id, (counts.get(res.id) ?? 0) + 1);
  }
  return Array.from(counts.entries()).filter(([, count]) => count >= 3).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
}

function computeCostPatterns(records: MemoryRecord[]): string[] {
  const patterns = new Set<string>();
  for (const r of records) {
    if (r.kind === "recommendation.accepted" && (r.impact.costDeltaUsd ?? 0) > 0) {
      const action = r.summary.split(" ").slice(0, 2).join(" ").toLowerCase();
      patterns.add(action);
    }
  }
  return Array.from(patterns).slice(0, 5);
}

function levelFromScore(score: number): MaturityLevel {
  if (score >= 85) return "advanced";
  if (score >= 70) return "mature";
  if (score >= 50) return "operational";
  if (score >= 25) return "developing";
  return "beginner";
}
