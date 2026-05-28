/**
 * Phase 507 — Autonomous Policy Proposal engine.
 *
 * Pure pattern matcher: reads org-level aggregates and proposes new
 * PolicyRule rows the operator can adopt. Each proposal carries
 * confidence, rationale citing the observed evidence, and a
 * suggested rule body the operator can edit before accepting.
 *
 * The engine NEVER auto-creates policy rules. It produces proposals;
 * the operator decides. Accepted proposals upsert into PolicyRule
 * via the responder.
 */

export const POLICY_PROPOSAL_ENGINE_VERSION = "policy-proposal-v1.0.0";

/* ──────────────────────────────────────────────────────────────────
   Closed-unions.
   ────────────────────────────────────────────────────────────── */

export const PROPOSAL_KINDS = [
  "require_strong_branch_protection",
  "require_rollback_rehearsal",
  "require_evidence_pack_signed",
  "require_manual_fix_reconciliation",
  "require_release_notes_published",
  "limit_force_push",
  "require_change_ticket",
] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

export const PROPOSAL_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type ProposalSeverity = (typeof PROPOSAL_SEVERITIES)[number];

/* ──────────────────────────────────────────────────────────────────
   Inputs.
   ────────────────────────────────────────────────────────────── */

export interface PolicyProposalInputs {
  releasesAnalyzed: number;
  /** Releases in the window with at least one open critical incident. */
  releasesWithOpenCriticalIncident: number;
  /** Releases in the window where readiness rollbackReadiness < 60. */
  releasesWithWeakRollbackReadiness: number;
  /** Releases in the window with no evidence pack at all. */
  releasesWithoutEvidencePack: number;
  /** Releases in the window where ManualFix has unreconciled rows. */
  releasesWithUnreconciledManualFix: number;
  /** Releases in the window that lack any ReleaseNotesDraft. */
  releasesWithoutReleaseNotes: number;
  /** Repos with weak/none branch protection on main. */
  weakProtectionMainRepos: number;
  /** Repos with force-push allowed on main. */
  forcePushAllowedMainRepos: number;
  /** Releases lacking a linked ChangeTicket. */
  releasesWithoutChangeTicket: number;
  /** Existing policy rule keys (advisory) — engine avoids re-proposing them. */
  existingActiveRuleKeys: string[];
  /** Currently-pending proposal keys — engine avoids stacking duplicates. */
  pendingProposalKeys: string[];
  now: Date;
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface ProposalEvidence {
  metric: string;
  value: number;
  threshold: number;
  windowReleases: number;
}

export interface SuggestedRuleBody {
  description: string;
  severity: ProposalSeverity;
  defaultBlocking: boolean;
  scope: "all" | "production_only";
  triggerWhen: Record<string, unknown>;
}

export interface PolicyProposal {
  kind: ProposalKind;
  suggestedRuleKey: string;
  title: string;
  rationale: string;
  confidence: number;
  severity: ProposalSeverity;
  evidence: ProposalEvidence[];
  suggestedRuleBody: SuggestedRuleBody;
}

export interface PolicyProposalOutput {
  engineVersion: string;
  generatedAtIso: string;
  proposals: PolicyProposal[];
  summary: { total: number; suppressedExisting: number; suppressedPending: number };
}

/* ──────────────────────────────────────────────────────────────────
   Pure engine.
   ────────────────────────────────────────────────────────────── */

interface RuleEval {
  kind: ProposalKind;
  ruleKey: string;
  triggered: boolean;
  proposal: PolicyProposal | null;
}

export function generatePolicyProposals(input: PolicyProposalInputs): PolicyProposalOutput {
  const existing = new Set(input.existingActiveRuleKeys);
  const pending = new Set(input.pendingProposalKeys);

  const evals: RuleEval[] = [
    evalForcePush(input),
    evalStrongProtection(input),
    evalRollbackRehearsal(input),
    evalEvidencePackSigned(input),
    evalManualFixReconciliation(input),
    evalReleaseNotesPublished(input),
    evalChangeTicket(input),
  ];

  let suppressedExisting = 0;
  let suppressedPending = 0;
  const proposals: PolicyProposal[] = [];

  for (const e of evals) {
    if (!e.triggered || !e.proposal) continue;
    if (existing.has(e.ruleKey)) { suppressedExisting += 1; continue; }
    if (pending.has(e.ruleKey)) { suppressedPending += 1; continue; }
    proposals.push(e.proposal);
  }

  // Rank by severity then confidence desc.
  const SEV_RANK: Record<ProposalSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  proposals.sort((a, b) => (SEV_RANK[b.severity] - SEV_RANK[a.severity]) || (b.confidence - a.confidence));

  return {
    engineVersion: POLICY_PROPOSAL_ENGINE_VERSION,
    generatedAtIso: input.now.toISOString(),
    proposals,
    summary: { total: proposals.length, suppressedExisting, suppressedPending },
  };
}

/* ──────────────────────────────────────────────────────────────────
   Individual rule evaluations — each is small + pure + auditable.
   ────────────────────────────────────────────────────────────── */

function evalForcePush(input: PolicyProposalInputs): RuleEval {
  const kind: ProposalKind = "limit_force_push";
  const ruleKey = "limit_force_push_on_main";
  const v = input.forcePushAllowedMainRepos;
  if (v < 1) return { kind, ruleKey, triggered: false, proposal: null };
  // Even a single repo with force-push on main is a critical security gap.
  return {
    kind, ruleKey, triggered: true,
    proposal: {
      kind, suggestedRuleKey: ruleKey,
      title: "Forbid force-push on main",
      rationale: `${v} repository${v === 1 ? "" : "ies"} currently allow force-push on main. This silently rewrites history and breaks every consumer of the branch — including release-tag provenance.`,
      confidence: Math.min(95, 75 + v * 5),
      severity: "critical",
      evidence: [
        { metric: "repos_with_force_push_on_main", value: v, threshold: 0, windowReleases: input.releasesAnalyzed },
      ],
      suggestedRuleBody: {
        description: "Block release-tag creation if any repo backing the application allows force-push on main.",
        severity: "critical",
        defaultBlocking: true,
        scope: "all",
        triggerWhen: { branchProtection: { allowsForcePushes: true, branchName: "main" } },
      },
    },
  };
}

function evalStrongProtection(input: PolicyProposalInputs): RuleEval {
  const kind: ProposalKind = "require_strong_branch_protection";
  const ruleKey = "require_strong_branch_protection_main";
  const v = input.weakProtectionMainRepos;
  if (v < 2) return { kind, ruleKey, triggered: false, proposal: null };
  return {
    kind, ruleKey, triggered: true,
    proposal: {
      kind, suggestedRuleKey: ruleKey,
      title: "Require strong branch protection on main",
      rationale: `${v} repos currently have weak/none protection on main. Strong protection (PR review + status checks + signed commits + enforce_admins) materially reduces the policy-violation surface across every release.`,
      confidence: Math.min(90, 60 + v * 3),
      severity: "high",
      evidence: [
        { metric: "repos_with_weak_protection_on_main", value: v, threshold: 2, windowReleases: input.releasesAnalyzed },
      ],
      suggestedRuleBody: {
        description: "Block release-tag promotion when the repo's main branch protection is weaker than 'strong'.",
        severity: "high",
        defaultBlocking: true,
        scope: "production_only",
        triggerWhen: { branchProtection: { strength: { not: "strong" }, branchName: "main" } },
      },
    },
  };
}

function evalRollbackRehearsal(input: PolicyProposalInputs): RuleEval {
  const kind: ProposalKind = "require_rollback_rehearsal";
  const ruleKey = "require_rollback_readiness_60";
  // Trigger when ≥30% of releases analyzed have weak rollback readiness AND
  // there's at least one incident in the window — pattern: "regressions cluster
  // around releases without rehearsed rollback."
  const total = Math.max(1, input.releasesAnalyzed);
  const ratio = input.releasesWithWeakRollbackReadiness / total;
  const triggered = ratio >= 0.3 && input.releasesWithOpenCriticalIncident >= 1;
  if (!triggered) return { kind, ruleKey, triggered: false, proposal: null };
  return {
    kind, ruleKey, triggered: true,
    proposal: {
      kind, suggestedRuleKey: ruleKey,
      title: "Require rollback rehearsal before deploy",
      rationale: `${input.releasesWithWeakRollbackReadiness}/${input.releasesAnalyzed} recent releases shipped with rollbackReadiness < 60, and ${input.releasesWithOpenCriticalIncident} of them produced an open critical incident. A pre-deploy rollback rehearsal would catch this before it ships.`,
      confidence: Math.round(60 + ratio * 30),
      severity: "high",
      evidence: [
        { metric: "weak_rollback_readiness_ratio", value: Math.round(ratio * 100), threshold: 30, windowReleases: input.releasesAnalyzed },
        { metric: "releases_with_open_critical_incident", value: input.releasesWithOpenCriticalIncident, threshold: 1, windowReleases: input.releasesAnalyzed },
      ],
      suggestedRuleBody: {
        description: "Block release transition to 'ready' if rollbackReadiness < 60.",
        severity: "high",
        defaultBlocking: true,
        scope: "production_only",
        triggerWhen: { readiness: { rollbackReadiness: { lt: 60 } } },
      },
    },
  };
}

function evalEvidencePackSigned(input: PolicyProposalInputs): RuleEval {
  const kind: ProposalKind = "require_evidence_pack_signed";
  const ruleKey = "require_signed_evidence_pack";
  const total = Math.max(1, input.releasesAnalyzed);
  const ratio = input.releasesWithoutEvidencePack / total;
  // Trigger when more than half of recent releases lack an evidence pack.
  if (ratio < 0.5 || input.releasesAnalyzed < 3) return { kind, ruleKey, triggered: false, proposal: null };
  return {
    kind, ruleKey, triggered: true,
    proposal: {
      kind, suggestedRuleKey: ruleKey,
      title: "Require signed evidence pack before deploy",
      rationale: `${input.releasesWithoutEvidencePack}/${input.releasesAnalyzed} recent releases shipped without an evidence pack. Signed evidence is the auditor's primary artifact — making it a hard requirement before deploy closes that gap.`,
      confidence: Math.round(55 + ratio * 35),
      severity: "high",
      evidence: [
        { metric: "releases_without_evidence_pack", value: input.releasesWithoutEvidencePack, threshold: Math.floor(input.releasesAnalyzed * 0.5), windowReleases: input.releasesAnalyzed },
      ],
      suggestedRuleBody: {
        description: "Block release transition to 'deploying' without a signed ReleaseEvidencePack.",
        severity: "high",
        defaultBlocking: true,
        scope: "production_only",
        triggerWhen: { evidencePack: { signed: false } },
      },
    },
  };
}

function evalManualFixReconciliation(input: PolicyProposalInputs): RuleEval {
  const kind: ProposalKind = "require_manual_fix_reconciliation";
  const ruleKey = "require_manual_fix_reconciliation_before_release";
  const total = Math.max(1, input.releasesAnalyzed);
  const ratio = input.releasesWithUnreconciledManualFix / total;
  if (ratio < 0.25 || input.releasesAnalyzed < 4) return { kind, ruleKey, triggered: false, proposal: null };
  return {
    kind, ruleKey, triggered: true,
    proposal: {
      kind, suggestedRuleKey: ruleKey,
      title: "Require reconciliation of pending manual fixes",
      rationale: `${input.releasesWithUnreconciledManualFix}/${input.releasesAnalyzed} recent releases shipped while unreconciled prod manual fixes were on the books. Reconciling first closes the source-of-truth gap.`,
      confidence: Math.round(55 + ratio * 30),
      severity: "medium",
      evidence: [
        { metric: "releases_with_unreconciled_manual_fix", value: input.releasesWithUnreconciledManualFix, threshold: Math.floor(input.releasesAnalyzed * 0.25), windowReleases: input.releasesAnalyzed },
      ],
      suggestedRuleBody: {
        description: "Warn (advisory) on release transition to 'ready' when any prod manual fix is pending.",
        severity: "medium",
        defaultBlocking: false,
        scope: "production_only",
        triggerWhen: { manualFix: { status: "pending", environmentTier: "prod" } },
      },
    },
  };
}

function evalReleaseNotesPublished(input: PolicyProposalInputs): RuleEval {
  const kind: ProposalKind = "require_release_notes_published";
  const ruleKey = "require_release_notes_published";
  const total = Math.max(1, input.releasesAnalyzed);
  const ratio = input.releasesWithoutReleaseNotes / total;
  if (ratio < 0.5 || input.releasesAnalyzed < 4) return { kind, ruleKey, triggered: false, proposal: null };
  return {
    kind, ruleKey, triggered: true,
    proposal: {
      kind, suggestedRuleKey: ruleKey,
      title: "Require published release notes",
      rationale: `${input.releasesWithoutReleaseNotes}/${input.releasesAnalyzed} recent releases were deployed without published notes. Customer-facing notes close the comms loop and are cheap to enforce.`,
      confidence: Math.round(50 + ratio * 25),
      severity: "low",
      evidence: [
        { metric: "releases_without_release_notes", value: input.releasesWithoutReleaseNotes, threshold: Math.floor(input.releasesAnalyzed * 0.5), windowReleases: input.releasesAnalyzed },
      ],
      suggestedRuleBody: {
        description: "Advisory: nudge to publish release notes before transitioning to 'deployed'.",
        severity: "low",
        defaultBlocking: false,
        scope: "all",
        triggerWhen: { releaseNotesDraft: { status: { not: "published" } } },
      },
    },
  };
}

function evalChangeTicket(input: PolicyProposalInputs): RuleEval {
  const kind: ProposalKind = "require_change_ticket";
  const ruleKey = "require_linked_change_ticket";
  const total = Math.max(1, input.releasesAnalyzed);
  const ratio = input.releasesWithoutChangeTicket / total;
  if (ratio < 0.5 || input.releasesAnalyzed < 4) return { kind, ruleKey, triggered: false, proposal: null };
  return {
    kind, ruleKey, triggered: true,
    proposal: {
      kind, suggestedRuleKey: ruleKey,
      title: "Require a linked change ticket",
      rationale: `${input.releasesWithoutChangeTicket}/${input.releasesAnalyzed} recent releases shipped without a linked change ticket. Change-management auditors flag this.`,
      confidence: Math.round(55 + ratio * 25),
      severity: "medium",
      evidence: [
        { metric: "releases_without_change_ticket", value: input.releasesWithoutChangeTicket, threshold: Math.floor(input.releasesAnalyzed * 0.5), windowReleases: input.releasesAnalyzed },
      ],
      suggestedRuleBody: {
        description: "Block release transition to 'ready' without at least one linked ChangeTicket.",
        severity: "medium",
        defaultBlocking: true,
        scope: "production_only",
        triggerWhen: { changeTicket: { linked: false } },
      },
    },
  };
}
