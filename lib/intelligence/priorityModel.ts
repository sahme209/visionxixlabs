/**
 * Operational Priority Engine — typed contract.
 *
 * The priority engine ranks operational work by:
 *   severity × evidence quality × confidence × blocker penalty
 *
 * Every PriorityItem carries:
 *   - the scoring breakdown (operators can audit how the rank came out)
 *   - canonical evidenceRefs back to AxiomOSState / Operating Graph
 *   - the literal safeNextAction (never a mutation)
 *
 * No fabricated certainty. No hidden chain-of-thought. The score
 * formula is transparent and pure-function over canonical state.
 */

export type PrioritySeverity = "critical" | "high" | "medium" | "low" | "info";
export type PriorityUrgency  = "now" | "this_week" | "this_month" | "scheduled";

export type PrioritySourceMode =
  | "live"
  | "partial_live"
  | "preview"
  | "foundation"
  | "planned"
  | "blocked"
  | "disabled"
  | "unknown";

export type PriorityCategory =
  | "security_finding"
  | "release_blocker"
  | "integration_blocker"
  | "policy_violation"
  | "readiness_blocker"
  | "approval_pending"
  | "desktop_blocker"
  | "evidence_gap"
  | "operational_drift"
  | "recurring";

export interface PriorityScoreBreakdown {
  /** Raw severity weight (1..100). */
  severityWeight: number;
  /** Evidence quality multiplier (0..1). Preview data lowers this. */
  evidenceMultiplier: number;
  /** Confidence multiplier (0..1). Unknown sources lower this. */
  confidenceMultiplier: number;
  /** Penalty applied when the item is blocked by external config. */
  blockerPenalty: number;
  /** Final composite score (0..100). */
  composite: number;
}

export interface PriorityItem {
  id: string;
  rank: number;
  title: string;
  reasonSummary: string;
  category: PriorityCategory;
  severity: PrioritySeverity;
  urgency: PriorityUrgency;
  confidence: number; // 0..1
  score: PriorityScoreBreakdown;

  sourceSystem: string;
  sourceMode: PrioritySourceMode;

  affectedSystem?: string;
  blockedBy?: string;

  /** Operator-readable explanation of why this ranks here. */
  whyItMatters: string;
  /** Honest description of business / customer impact (if known). */
  businessImpactSummary?: string;
  /** Honest description of technical impact (if known). */
  technicalImpactSummary?: string;

  safeNextAction: { label: string; href: string };
  limitations: string[];
  evidenceRefs: string[];

  /** Backlinks to graph nodes the item originates from. */
  linkedGraphNodeIds: string[];
}

export interface PriorityReport {
  generatedAt: string;
  tenantId?: string;
  /** Sorted top-down by composite score, descending. */
  items: PriorityItem[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    blockedByConfig: number;
    blockedByPolicy: number;
  };
  /** Average confidence — drops when the platform is in preview. */
  averageConfidence: number;
  /** Honest source mode rollup. */
  overallSourceMode: PrioritySourceMode;
  /** Limitations of the engine itself + underlying state. */
  limitations: string[];
  /** Where to go from the aggregator view. */
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const SEVERITY_BASE_WEIGHT: Record<PrioritySeverity, number> = {
  critical: 90,
  high:     65,
  medium:   40,
  low:      20,
  info:     8,
};

export const CATEGORY_LABEL: Record<PriorityCategory, string> = {
  security_finding:    "Security finding",
  release_blocker:     "Release blocker",
  integration_blocker: "Integration blocker",
  policy_violation:    "Policy violation",
  readiness_blocker:   "Readiness blocker",
  approval_pending:    "Approval pending",
  desktop_blocker:     "Desktop blocker",
  evidence_gap:        "Evidence gap",
  operational_drift:   "Operational drift",
  recurring:           "Recurring issue",
};

/** Pure scoring function — exported so callers + tests can audit it. */
export function computePriorityScore(input: {
  severity: PrioritySeverity;
  sourceMode: PrioritySourceMode;
  evidenceCount: number;
  blockedByConfig: boolean;
  blockedByPolicy: boolean;
}): PriorityScoreBreakdown {
  const severityWeight = SEVERITY_BASE_WEIGHT[input.severity];

  // Evidence multiplier: more canonical references → higher trust.
  // 0 refs → 0.5 (we still report the item but with reduced confidence)
  // 1 ref  → 0.7
  // 2 refs → 0.85
  // 3+     → 1.0
  const evidenceMultiplier =
    input.evidenceCount >= 3 ? 1.0  :
    input.evidenceCount === 2 ? 0.85 :
    input.evidenceCount === 1 ? 0.7  :
                                0.5;

  // Confidence multiplier: live > partial > preview > unknown.
  const confidenceMultiplier =
    input.sourceMode === "live"          ? 1.0  :
    input.sourceMode === "partial_live"  ? 0.85 :
    input.sourceMode === "preview"       ? 0.6  :
    input.sourceMode === "foundation"    ? 0.45 :
    input.sourceMode === "planned"       ? 0.35 :
    input.sourceMode === "blocked"       ? 0.5  :
    input.sourceMode === "disabled"      ? 0.3  :
                                            0.4;

  // Blocker penalty — when the operator can't act yet, the item still
  // surfaces but ranks slightly lower so unblocked work wins by default.
  // Policy blockers penalize harder than config blockers.
  const blockerPenalty =
    input.blockedByPolicy ? 0.7 :
    input.blockedByConfig ? 0.85 :
                            1.0;

  const composite = Math.round(severityWeight * evidenceMultiplier * confidenceMultiplier * blockerPenalty);
  return { severityWeight, evidenceMultiplier, confidenceMultiplier, blockerPenalty, composite };
}

/** Composite confidence is the geometric mean of evidence + sourceMode multipliers. */
export function confidenceFromScore(s: PriorityScoreBreakdown): number {
  return Math.round(Math.sqrt(s.evidenceMultiplier * s.confidenceMultiplier) * 100) / 100;
}
