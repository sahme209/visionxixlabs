/**
 * Phase 506 — Autonomous Release Advisor: pure decision engine.
 *
 * Reads a release's full state and produces ranked recommendations.
 * The platform's first AGI-cockpit surface for ReleaseOps. No I/O —
 * caller wires the inputs, the engine returns a deterministic list.
 *
 * Engine versioning: bump ENGINE_VERSION when the decision logic
 * changes so historical AdvisorRecommendation rows stay
 * interpretable. Inputs are persisted alongside the recommendation
 * so a future engine version can replay an old decision and
 * compare.
 *
 * Closed-union kinds, ranked by typical severity (descending):
 *   block_deploy | rollback | needs_evidence | propose_freeze |
 *   proceed_with_caution | propose_manual_fix_log |
 *   propose_branch_protection_strengthen | proceed
 */

export const ENGINE_VERSION = "advisor-v1.0.0";

/* ──────────────────────────────────────────────────────────────────
   Closed-unions.
   ────────────────────────────────────────────────────────────── */

export const RECOMMENDATION_KINDS = [
  "block_deploy",
  "rollback",
  "needs_evidence",
  "propose_freeze",
  "proceed_with_caution",
  "propose_manual_fix_log",
  "propose_branch_protection_strengthen",
  "proceed",
] as const;
export type RecommendationKind = (typeof RECOMMENDATION_KINDS)[number];

export const RECOMMENDATION_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type RecommendationSeverity = (typeof RECOMMENDATION_SEVERITIES)[number];

/* ──────────────────────────────────────────────────────────────────
   Inputs — the engine's full visibility surface.
   ────────────────────────────────────────────────────────────── */

export interface AdvisorInputs {
  release: {
    id: string;
    status: string; // closed-union from Phase 491
    releaseTag: string | null;
    commitSha: string | null;
    plannedWindowStart: Date | null;
    plannedWindowEnd: Date | null;
  };
  readiness: {
    overallScore: number;            // 0-100
    riskLevel: string;               // low | medium | high | critical
    blockerCount: number;
    branchGovernance: number;
    changeCompliance: number;
    secretTraceability: number;
    rollbackReadiness: number;
    manualReconciliation: number;
  } | null;
  policyViolations: {
    blocking: number;
    warning: number;
    advisory: number;
  };
  pendingManualFixes: {
    total: number;
    inProd: number;
  };
  recentIncidents: {
    open: number;
    openCritical: number;
    mitigated: number;
  };
  branchProtection: {
    snapshotsTotal: number;
    weakOrNone: number;
    forcePushAllowedOnMain: boolean;
  };
  previousReleaseStatus: string | null; // for rollback consideration
  hasEvidencePack: boolean;
  isInPlannedFreeze: boolean;
  /** ISO timestamp for deterministic "deadline" math. */
  now: Date;
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface SuggestedAction { label: string; href: string }

export interface Recommendation {
  kind: RecommendationKind;
  confidence: number;            // 0-100
  title: string;
  rationale: string;
  severity: RecommendationSeverity;
  suggestedActions: SuggestedAction[];
  /** Deadline by which the operator should act (rough heuristic). */
  deadlineIso: string | null;
}

export interface AdvisorOutput {
  engineVersion: string;
  generatedAtIso: string;
  recommendations: Recommendation[];
  /** Highest-severity recommendation, or null when only proceed-ish. */
  primary: Recommendation | null;
}

/* ──────────────────────────────────────────────────────────────────
   Pure engine.
   ────────────────────────────────────────────────────────────── */

const SEVERITY_RANK: Record<RecommendationSeverity, number> = {
  critical: 4, high: 3, medium: 2, low: 1,
};

const KIND_RANK: Record<RecommendationKind, number> = {
  block_deploy: 100,
  rollback: 90,
  needs_evidence: 80,
  propose_freeze: 70,
  proceed_with_caution: 50,
  propose_manual_fix_log: 40,
  propose_branch_protection_strengthen: 30,
  proceed: 10,
};

function deadlinePlus(now: Date, hours: number): string {
  return new Date(now.getTime() + hours * 3_600_000).toISOString();
}

/**
 * Produce a ranked list of recommendations for the given release
 * state. Always returns at least one recommendation — when nothing
 * is wrong, returns a single "proceed" with high confidence.
 */
export function generateRecommendations(input: AdvisorInputs): AdvisorOutput {
  const recs: Recommendation[] = [];
  const releaseHref = `/dashboard/releases#${input.release.id}`;

  // ── Rule 1: hard block on blocking policy violations or critical readiness ──
  if (input.policyViolations.blocking > 0) {
    recs.push({
      kind: "block_deploy",
      confidence: Math.min(95, 70 + input.policyViolations.blocking * 5),
      severity: "critical",
      title: `Block deploy: ${input.policyViolations.blocking} blocking policy violation${input.policyViolations.blocking === 1 ? "" : "s"}`,
      rationale: `Policy engine reports ${input.policyViolations.blocking} blocking violation${input.policyViolations.blocking === 1 ? "" : "s"} on this release. Blocking violations override readiness — deploy must not proceed until the violations are waived (with exception) or resolved.`,
      suggestedActions: [
        { label: "Open policy violations", href: "/dashboard/policy-violations" },
        { label: "Open release", href: releaseHref },
      ],
      deadlineIso: deadlinePlus(input.now, 4),
    });
  }

  if (input.readiness && input.readiness.riskLevel === "critical") {
    recs.push({
      kind: "block_deploy",
      confidence: 88,
      severity: "critical",
      title: `Block deploy: readiness is critical (score ${input.readiness.overallScore})`,
      rationale: `Latest readiness snapshot reports risk level "critical" with overall score ${input.readiness.overallScore}/100 and ${input.readiness.blockerCount} blocker${input.readiness.blockerCount === 1 ? "" : "s"}. Deploying at critical risk is not recommended without an explicit exception.`,
      suggestedActions: [
        { label: "Open release readiness", href: "/dashboard/release-readiness" },
        { label: "Open release", href: releaseHref },
      ],
      deadlineIso: deadlinePlus(input.now, 6),
    });
  }

  // ── Rule 2: rollback consideration if previous release rolled_back/failed ──
  if (input.previousReleaseStatus === "rolled_back" || input.previousReleaseStatus === "failed") {
    recs.push({
      kind: "rollback",
      confidence: 65,
      severity: "high",
      title: `Consider holding deploy: previous release ${input.previousReleaseStatus}`,
      rationale: `The most recent release for this application ended in "${input.previousReleaseStatus}". Confirm the root-cause fix is included in this release before proceeding — otherwise you risk re-deploying the failure mode.`,
      suggestedActions: [
        { label: "Open release-tag diff", href: "/dashboard/release-tag-diff" },
        { label: "Open release", href: releaseHref },
      ],
      deadlineIso: deadlinePlus(input.now, 12),
    });
  }

  // ── Rule 3: needs_evidence when pending prod manual fixes exist ──
  if (input.pendingManualFixes.inProd > 0) {
    recs.push({
      kind: "needs_evidence",
      confidence: 80,
      severity: "high",
      title: `Evidence required: ${input.pendingManualFixes.inProd} pending prod manual fix${input.pendingManualFixes.inProd === 1 ? "" : "es"}`,
      rationale: `Unreconciled prod manual fixes mean the source-of-truth lags reality. Reconcile (or attach evidence to) these fixes before signing off the release — auditors will flag the gap during the evidence-pack review.`,
      suggestedActions: [
        { label: "Open manual fixes", href: "/dashboard/manual-fixes" },
        { label: "Generate evidence pack", href: releaseHref },
      ],
      deadlineIso: deadlinePlus(input.now, 24),
    });
  }

  // ── Rule 4: propose_freeze when open critical incidents on recent releases ──
  if (input.recentIncidents.openCritical > 0 && !input.isInPlannedFreeze) {
    recs.push({
      kind: "propose_freeze",
      confidence: 75,
      severity: "high",
      title: `Propose freeze: ${input.recentIncidents.openCritical} open critical incident${input.recentIncidents.openCritical === 1 ? "" : "s"}`,
      rationale: `Open critical incidents in the recent deploy window suggest a hot system. A short freeze gives on-call breathing room and avoids stacking new variance on top of an active fire.`,
      suggestedActions: [
        { label: "Open deployment incidents", href: "/dashboard/deployment-incidents" },
        { label: "Open release freeze", href: "/dashboard/release-freeze" },
      ],
      deadlineIso: deadlinePlus(input.now, 2),
    });
  }

  // ── Rule 5: proceed_with_caution for medium readiness or open non-critical incidents ──
  const cautionTriggers = [];
  if (input.readiness && input.readiness.riskLevel === "high") cautionTriggers.push(`risk: high`);
  if (input.readiness && input.readiness.overallScore < 70) cautionTriggers.push(`readiness ${input.readiness.overallScore}/100`);
  if (input.recentIncidents.open > 0 && input.recentIncidents.openCritical === 0) cautionTriggers.push(`${input.recentIncidents.open} open incident${input.recentIncidents.open === 1 ? "" : "s"}`);
  if (input.policyViolations.warning >= 3) cautionTriggers.push(`${input.policyViolations.warning} warning violations`);
  if (cautionTriggers.length > 0 && !recs.some((r) => r.kind === "block_deploy" || r.kind === "rollback")) {
    recs.push({
      kind: "proceed_with_caution",
      confidence: 70,
      severity: "medium",
      title: "Proceed with caution",
      rationale: `Multiple amber signals: ${cautionTriggers.join("; ")}. Not enough to block, but consider extra observability + rollback rehearsal before deploying.`,
      suggestedActions: [
        { label: "Open release", href: releaseHref },
        { label: "Open release readiness", href: "/dashboard/release-readiness" },
      ],
      deadlineIso: null,
    });
  }

  // ── Rule 6: propose_manual_fix_log when deploy succeeded but readiness shows manual-reconciliation gap ──
  if (
    input.release.status === "deployed" &&
    input.readiness &&
    input.readiness.manualReconciliation < 60 &&
    input.pendingManualFixes.total === 0
  ) {
    recs.push({
      kind: "propose_manual_fix_log",
      confidence: 60,
      severity: "medium",
      title: "Log any out-of-band fixes you applied during deploy",
      rationale: `Readiness reports a manualReconciliation score of ${input.readiness.manualReconciliation}/100 — suggesting prior hand-edits are unaccounted for. If you patched anything by hand during this deploy window, log it now so the audit trail stays clean.`,
      suggestedActions: [
        { label: "Open manual fixes", href: "/dashboard/manual-fixes" },
      ],
      deadlineIso: deadlinePlus(input.now, 48),
    });
  }

  // ── Rule 7: branch protection hardening proposal ──
  if (input.branchProtection.snapshotsTotal > 0 && (input.branchProtection.weakOrNone > 0 || input.branchProtection.forcePushAllowedOnMain)) {
    const severity: RecommendationSeverity = input.branchProtection.forcePushAllowedOnMain ? "high" : "medium";
    const trigger = input.branchProtection.forcePushAllowedOnMain
      ? "force-push is allowed on main"
      : `${input.branchProtection.weakOrNone} branch${input.branchProtection.weakOrNone === 1 ? "" : "es"} have weak/no protection`;
    recs.push({
      kind: "propose_branch_protection_strengthen",
      confidence: 72,
      severity,
      title: "Strengthen branch protection",
      rationale: `Latest snapshots show ${trigger}. Strong protection (PR review + status checks + signed commits + enforce_admins) reduces the policy-violation surface across every release for free.`,
      suggestedActions: [
        { label: "Open branch protection", href: "/dashboard/branch-protection" },
        { label: "Open repositories", href: "/dashboard/repositories" },
      ],
      deadlineIso: null,
    });
  }

  // ── Rule 8: nothing wrong — explicit "proceed" with high confidence ──
  // Suppresses when ANY recommendation above proceed has already fired —
  // proceed should never compete with a more-specific caution/freeze/etc.
  const hasOtherRec = recs.some((r) => r.kind !== "propose_branch_protection_strengthen" && r.kind !== "propose_manual_fix_log");
  if (!hasOtherRec && input.release.status !== "deployed" && input.release.status !== "rolled_back" && input.release.status !== "failed") {
    const score = input.readiness?.overallScore ?? 0;
    const confidence = input.readiness ? Math.min(95, 60 + Math.round(score / 4)) : 50;
    recs.push({
      kind: "proceed",
      confidence,
      severity: "low",
      title: "Proceed — clear to deploy",
      rationale: input.readiness
        ? `No blocking signals. Readiness score ${score}/100, risk ${input.readiness.riskLevel}. Standard deploy hygiene applies (announce, monitor, rollback rehearsal).`
        : "No blocking signals, but no readiness snapshot exists yet either — consider evaluating readiness before deploying for the audit trail.",
      suggestedActions: [
        { label: "Open release", href: releaseHref },
      ],
      deadlineIso: null,
    });
  }

  // Rank: kind-priority descending, then severity descending, then confidence descending.
  recs.sort((a, b) => {
    const k = KIND_RANK[b.kind] - KIND_RANK[a.kind];
    if (k !== 0) return k;
    const s = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (s !== 0) return s;
    return b.confidence - a.confidence;
  });

  const primary = recs.find((r) => r.kind !== "proceed") ?? null;

  return {
    engineVersion: ENGINE_VERSION,
    generatedAtIso: input.now.toISOString(),
    recommendations: recs,
    primary,
  };
}
