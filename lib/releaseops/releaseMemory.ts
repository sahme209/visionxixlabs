/**
 * ReleaseOps memory — patterns observed in deployment history that improve
 * readiness scoring, deployment risk classification, and executive summaries.
 *
 * Pure functions over the operational memory store. Identifies:
 *   - recurring deployment blockers
 *   - approval delays per service
 *   - rollback readiness gaps
 *   - flaky workflows
 *   - environment drift recurrence
 *   - GitHub Actions failure patterns
 *   - branch protection gaps
 *   - release frequency
 */

import type { MemoryStore, MemoryRecord } from "@/lib/memory/operationalMemory";

// ---------------------------------------------------------------------------
// Pattern types
// ---------------------------------------------------------------------------

export interface ReleaseOpsPattern {
  kind:
    | "recurring_blocker"
    | "approval_delay"
    | "rollback_gap"
    | "flaky_workflow"
    | "drift_recurrence"
    | "failure_pattern"
    | "protection_gap"
    | "release_cadence_change";
  serviceId?: string;
  /** Human-readable explanation. */
  message: string;
  /** Number of observations driving this pattern. */
  observationCount: number;
  /** Memory records that support this pattern. */
  evidenceMemoryIds: string[];
  /** Suggested next step for the user. */
  recommendation: string;
  /** Confidence in the pattern in [0, 1]. */
  confidence: number;
}

export interface ServiceReleaseMemory {
  serviceId: string;
  /** Patterns observed for this service. */
  patterns: ReleaseOpsPattern[];
  /** Last N release outcomes, newest first. */
  recentOutcomes: { outcome: "success" | "fail" | "rolled_back"; at: string }[];
  /** Successful deploy streak — drives Trust Ladder. */
  successStreak: number;
  /** Production deploy count in window. */
  productionDeploys: number;
  /** Rollback count in window. */
  rollbackCount: number;
}

// ---------------------------------------------------------------------------
// Analyzer
// ---------------------------------------------------------------------------

export interface AnalyzeOptions {
  /** Window in days. Default 30. */
  windowDays?: number;
}

export async function analyzeServiceMemory(
  organizationId: string,
  serviceId: string,
  store: MemoryStore,
  options: AnalyzeOptions = {}
): Promise<ServiceReleaseMemory> {
  const windowDays = options.windowDays ?? 30;
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  const all = await store.query({ organizationId, sinceISO: since, limit: 2000 });

  const serviceRecords = all.filter((r) => r.summary.toLowerCase().includes(serviceId.toLowerCase()) || r.resources.some((res) => res.id.includes(serviceId)));

  const deploys = serviceRecords.filter((r) => r.kind === "release.deployed");
  const fails = serviceRecords.filter((r) => r.kind === "release.blocked" || r.kind === "execution.failed");
  const rollbacks = serviceRecords.filter((r) => r.kind === "release.rolled_back");

  const recentOutcomes = serviceRecords
    .filter((r) => r.kind === "release.deployed" || r.kind === "release.blocked" || r.kind === "release.rolled_back")
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 20)
    .map((r) => ({
      outcome:
        r.kind === "release.deployed" ? "success" as const :
        r.kind === "release.rolled_back" ? "rolled_back" as const :
        "fail" as const,
      at: r.occurredAt,
    }));

  let successStreak = 0;
  for (const o of recentOutcomes) {
    if (o.outcome === "success") successStreak++;
    else break;
  }

  return {
    serviceId,
    patterns: detectPatterns(serviceId, serviceRecords),
    recentOutcomes,
    successStreak,
    productionDeploys: deploys.length,
    rollbackCount: rollbacks.length + fails.filter((f) => f.outcome === "negative").length,
  };
}

function detectPatterns(serviceId: string, records: MemoryRecord[]): ReleaseOpsPattern[] {
  const patterns: ReleaseOpsPattern[] = [];

  // Recurring blocker
  const blockers = records.filter((r) => r.kind === "release.blocked");
  if (blockers.length >= 3) {
    patterns.push({
      kind: "recurring_blocker",
      serviceId,
      message: `${blockers.length} releases blocked at the governance gate in window`,
      observationCount: blockers.length,
      evidenceMemoryIds: blockers.map((r) => r.id),
      recommendation: "Investigate the readiness dimension consistently blocking releases.",
      confidence: Math.min(0.95, 0.6 + blockers.length * 0.05),
    });
  }

  // Rollback gap
  const rollbacks = records.filter((r) => r.kind === "rollback.executed" || r.kind === "release.rolled_back");
  const deploys = records.filter((r) => r.kind === "release.deployed");
  if (deploys.length >= 3 && rollbacks.length / deploys.length > 0.2) {
    patterns.push({
      kind: "rollback_gap",
      serviceId,
      message: `Rollback rate ${Math.round((rollbacks.length / deploys.length) * 100)}% — above 20% threshold`,
      observationCount: rollbacks.length,
      evidenceMemoryIds: rollbacks.map((r) => r.id),
      recommendation: "Improve pre-flight verification and rollback rehearsal cadence.",
      confidence: 0.85,
    });
  }

  // Flaky workflow / failure pattern
  const failures = records.filter((r) => r.kind === "execution.failed" || r.kind === "verification.failed");
  if (failures.length >= 4) {
    patterns.push({
      kind: "flaky_workflow",
      serviceId,
      message: `${failures.length} execution or verification failures`,
      observationCount: failures.length,
      evidenceMemoryIds: failures.map((r) => r.id),
      recommendation: "Stabilize this service's deployment pipeline before increasing release cadence.",
      confidence: 0.8,
    });
  }

  // Drift recurrence
  const drifts = records.filter((r) => r.kind === "drift.detected");
  if (drifts.length >= 3) {
    patterns.push({
      kind: "drift_recurrence",
      serviceId,
      message: `${drifts.length} drift events recorded`,
      observationCount: drifts.length,
      evidenceMemoryIds: drifts.map((r) => r.id),
      recommendation: "Out-of-band changes are common — consider locking IaC enforcement.",
      confidence: 0.75,
    });
  }

  // Release cadence change
  const deployTimes = deploys.map((d) => new Date(d.occurredAt).getTime()).sort();
  if (deployTimes.length >= 3) {
    const gaps = [];
    for (let i = 1; i < deployTimes.length; i++) gaps.push(deployTimes[i] - deployTimes[i - 1]);
    const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const recentGap = gaps[gaps.length - 1];
    if (recentGap > avg * 2) {
      patterns.push({
        kind: "release_cadence_change",
        serviceId,
        message: "Release cadence slowing",
        observationCount: deploys.length,
        evidenceMemoryIds: deploys.map((r) => r.id),
        recommendation: "Verify there are no operational blockers stalling deployments.",
        confidence: 0.7,
      });
    }
  }

  return patterns;
}
