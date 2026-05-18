/**
 * Executive Operational Summary — typed contract.
 *
 * Single canonical shape an executive can read in 30 seconds and
 * understand: top risks, readiness, integration health, what is
 * blocked, what is preview, what requires approval, what is the
 * recommended next action.
 *
 * Every field is a projection over canonical state — no fabricated
 * trends, no fake savings, no hidden chain-of-thought.
 */

export type ExecutiveOverallStatus =
  | "operating_normally"
  | "needs_attention"
  | "blocked"
  | "preview_mode"
  | "expanding";

export interface ExecutiveTopRisk {
  rank: number;
  title: string;
  reasonSummary: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  sourceMode: string;
  confidence: number;
  route: { label: string; href: string };
  evidenceRefs: string[];
}

export interface ExecutiveReadinessSummary {
  /** 0..100 launch readiness — when available. */
  launchScore: number;
  /** 0..1 production readiness composite — from /api/readiness. */
  productionScore: number;
  /** Composite source mode rollup. */
  sourceMode: string;
  /** Top three must-fix items (already prioritized). */
  topBlockers: string[];
}

export interface ExecutiveIntegrationSummary {
  total: number;
  healthy: number;
  preview: number;
  blocked: number;
  /** Lowest-confidence integration name — useful pointer for leadership. */
  weakestIntegration?: string;
}

export interface ExecutiveTrustSummary {
  controlCoveragePct: number;
  evidenceRecords: number;
  verifiedEvidence: number;
  /** Read-only / approval-gated literal flags — always present. */
  readOnlyByDefault: true;
  approvalGated: true;
  desktopLocalExecution: "disabled";
}

export interface ExecutiveSummaryReport {
  generatedAt: string;
  tenantId?: string;

  overallStatus: ExecutiveOverallStatus;
  /** One-sentence executive headline. */
  headline: string;
  /** 2–4 sentence narrative — the "what's the situation" paragraph. */
  narrative: string;

  topRisks: ExecutiveTopRisk[];
  readiness: ExecutiveReadinessSummary;
  integrationHealth: ExecutiveIntegrationSummary;
  trust: ExecutiveTrustSummary;

  /** What requires the operator's decision next. */
  recommendedNextAction: {
    title: string;
    reason: string;
    route: { label: string; href: string };
  };

  /** Honest "what is preview / blocked / not_yet" list — visible to leadership. */
  honestLimitations: string[];
  /** Stable evidence ids for the executive packet. */
  evidenceRefs: string[];

  /** Hard-literal safety summary — always present. */
  safetyContract: "approval_gated_no_destructive_execution";
}

export const OVERALL_STATUS_LABEL: Record<ExecutiveOverallStatus, string> = {
  operating_normally: "Operating normally",
  needs_attention:    "Needs attention",
  blocked:            "Blocked",
  preview_mode:       "Preview mode",
  expanding:          "Expanding",
};

export const OVERALL_STATUS_TONE: Record<ExecutiveOverallStatus, "emerald" | "amber" | "rose" | "cyan" | "zinc"> = {
  operating_normally: "emerald",
  needs_attention:    "amber",
  blocked:            "rose",
  preview_mode:       "amber",
  expanding:          "cyan",
};
