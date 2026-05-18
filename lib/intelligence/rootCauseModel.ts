/**
 * Root Cause grouper — typed contract.
 *
 * Groups related risks / priorities by shared properties (provider,
 * sourceMode, missingConfig pattern, blocker reason). Calls them
 * "suspected" causes — never "proven" — and surfaces a confidence
 * score derived from evidence + group size.
 *
 * Pure projection. No fake long-term history claims.
 */

export type RootCauseConfidence = "low" | "medium" | "high";

export type RootCausePattern =
  | "same_provider_blocked"
  | "same_missing_config"
  | "same_policy_violation"
  | "same_integration_failure"
  | "same_readiness_blocker"
  | "same_severity_cluster"
  | "single_finding"; // not really a group — surfaced individually

export interface RootCauseGroup {
  id: string;
  /** Operator-readable group title. */
  title: string;
  /** Suspected (not proven) cause one-liner. */
  suspectedCause: string;
  pattern: RootCausePattern;
  confidence: RootCauseConfidence;
  /** Number of related signals this group merges. */
  relatedCount: number;
  /** Ids of the underlying signals (risks, priorities). */
  relatedSignalIds: string[];
  /** Affected systems (providers, repos, etc). */
  affectedSystems: string[];
  sourceMode: string;
  /** Why this group matters operationally. */
  whyItMatters: string;
  /** Operator-readable evidence references. */
  evidenceRefs: string[];
  /** Honest limitations on the grouping. */
  limitations: string[];
  /** Safe next action — what the operator should do to investigate. */
  safeNextAction: { label: string; href: string };
}

export interface RootCauseReport {
  generatedAt: string;
  tenantId?: string;
  groups: RootCauseGroup[];
  summary: {
    totalGroups: number;
    totalSignalsCovered: number;
    /** Signals that did not merge into a group. */
    singletons: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
  };
  /** Hard literal — this is grouping, never resolution. */
  safetyContract: "grouping_only_no_resolution";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

export const CONFIDENCE_TONE: Record<RootCauseConfidence, "emerald" | "cyan" | "amber"> = {
  high:   "emerald",
  medium: "cyan",
  low:    "amber",
};

export const CONFIDENCE_LABEL: Record<RootCauseConfidence, string> = {
  high:   "High confidence",
  medium: "Medium confidence",
  low:    "Low confidence",
};

export const PATTERN_LABEL: Record<RootCausePattern, string> = {
  same_provider_blocked:    "Same provider · blocked",
  same_missing_config:      "Same missing config",
  same_policy_violation:    "Same policy violation",
  same_integration_failure: "Same integration failure",
  same_readiness_blocker:   "Same readiness blocker",
  same_severity_cluster:    "Severity cluster",
  single_finding:           "Single finding · no group",
};
