/**
 * ReleaseOps Simulation.
 *
 * Predicts how readiness would change if a given set of blockers were
 * resolved (or new ones introduced). Uses the same scoring rules as
 * `releaseReadiness.ts` so the simulation result is comparable.
 *
 * No real GitHub mutation. Pure prediction.
 */

import type { ReleaseReadiness, ReadinessBlocker, ReadinessGrade } from "@/lib/releaseops/releaseReadiness";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReleaseSimulationInput {
  current: ReleaseReadiness;
  /** Blocker ids that the simulation should treat as resolved. */
  resolveBlockerIds?: string[];
  /** New blockers the simulation should introduce. */
  newBlockers?: ReadinessBlocker[];
}

export interface ReleaseSimulationResult {
  before: { score: number; grade: ReadinessGrade; blockerCount: number };
  after:  { score: number; grade: ReadinessGrade; blockerCount: number };
  blockersRemoved: ReadinessBlocker[];
  blockersRemaining: ReadinessBlocker[];
  newRisks: ReadinessBlocker[];
  approvalRequirements: ("none" | "single_approver" | "two_approvers")[];
  verificationSteps: string[];
  auditEvidenceNeeded: string[];
  /** Honest source — release readiness is preview today. */
  sourceMode: "live" | "preview";
  notes: string[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Scoring (kept in sync with releaseReadiness.ts via SEV_WEIGHT)
// ---------------------------------------------------------------------------

const SEV_WEIGHT: Record<ReadinessBlocker["severity"], number> = {
  critical: 25,
  high:     15,
  medium:   8,
  low:      3,
  info:     1,
};

function scoreFromBlockers(blockers: ReadinessBlocker[]): { score: number; grade: ReadinessGrade } {
  let score = 100;
  for (const b of blockers) score -= SEV_WEIGHT[b.severity];
  if (score < 0) score = 0;
  const grade: ReadinessGrade =
    score >= 90 ? "A"
    : score >= 75 ? "B"
    : score >= 60 ? "C"
    : score >= 40 ? "D"
    : "F";
  return { score, grade };
}

function approvalForBlocker(b: ReadinessBlocker): "none" | "single_approver" | "two_approvers" {
  if (b.severity === "critical" || b.severity === "high") return "two_approvers";
  if (b.severity === "medium")                              return "single_approver";
  return "none";
}

// ---------------------------------------------------------------------------
// Simulator
// ---------------------------------------------------------------------------

export function simulateRelease(input: ReleaseSimulationInput): ReleaseSimulationResult {
  const current = input.current;
  const toResolve = new Set(input.resolveBlockerIds ?? []);

  const blockersRemoved = current.blockers.filter((b) => toResolve.has(b.id));
  const blockersRemaining = current.blockers.filter((b) => !toResolve.has(b.id));
  const newRisks = input.newBlockers ?? [];

  const after = [...blockersRemaining, ...newRisks];

  const before = { score: current.score, grade: current.grade, blockerCount: current.blockers.length };
  const afterScore = scoreFromBlockers(after);
  const afterOut = { score: afterScore.score, grade: afterScore.grade, blockerCount: after.length };

  const approvalRequirements = blockersRemoved.map(approvalForBlocker);
  const verificationSteps = blockersRemoved.map((b) => `Re-validate ${b.kind} on ${b.repoId}${b.branch ? `#${b.branch}` : ""}.`);
  const auditEvidenceNeeded = blockersRemoved.map((b) => `Audit record for ${b.id} resolution.`);

  const notes: string[] = [
    "Simulation uses the same severity weights as production readiness scoring.",
    "Predicted scores assume the listed blockers are fully resolved with no regression.",
  ];
  if (input.newBlockers && input.newBlockers.length > 0) {
    notes.push("New risks were introduced for simulation — predicted score penalises accordingly.");
  }

  return {
    before,
    after: afterOut,
    blockersRemoved,
    blockersRemaining,
    newRisks,
    approvalRequirements,
    verificationSteps,
    auditEvidenceNeeded,
    sourceMode: "preview",
    notes,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Convenience: simulate resolving every current blocker. Useful for
 * "what does best-case readiness look like?" surfaces.
 */
export function simulateBestCase(current: ReleaseReadiness): ReleaseSimulationResult {
  return simulateRelease({ current, resolveBlockerIds: current.blockers.map((b) => b.id) });
}
