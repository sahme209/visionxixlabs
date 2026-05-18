/**
 * Closed Autonomy Loop — typed contract.
 *
 * This is the spine that turns Axiom from "operator clicks an action"
 * into "the platform decides, simulates, gates, executes, verifies,
 * and audits autonomously". Every transition is typed; every step
 * has a literal classification; nothing operates outside the
 * AutomationBoundary detector.
 *
 * The loop is **declared, not free-running**. It runs on a schedule
 * controlled by the operator (or by tenant policy) and refuses to
 * proceed past any safety gate that fails. This means the same
 * code path drives both fully-autonomous tenants (every gate
 * passes) and the most-conservative ones (every gate halts the
 * loop short of execution).
 *
 *   STAGE_DETECT      → identify a candidate signal from canonical state
 *   STAGE_REASON      → derive the proposed intent from the signal
 *   STAGE_SIMULATE    → run the intent against the digital twin
 *   STAGE_POLICY_GATE → ask the policy engine for a binding decision
 *   STAGE_BOUNDARY    → ask the automation boundary detector
 *   STAGE_APPROVE     → bundle into an approval packet (auto-approve
 *                       only when the tenant's autonomy charter says so)
 *   STAGE_EXECUTE     → emit the execution intent to the desktop runtime
 *                       (web never executes locally)
 *   STAGE_VERIFY      → verify after-state with a follow-up scan
 *   STAGE_AUDIT       → emit the typed audit event chain
 *
 * Hard literal `safetyContract: "autonomy_gated_no_unsafe_execution"`
 * — TS prevents any other contract from ever sitting on this report.
 */

import type { ApprovalReadiness } from "@/lib/intelligence/approvalPacketModel";
import type { BoundaryClassification } from "@/lib/safety/automationBoundaryModel";

// ---------------------------------------------------------------------------
// Stages — closed union
// ---------------------------------------------------------------------------

export type AutonomyStage =
  | "detect"
  | "reason"
  | "simulate"
  | "policy_gate"
  | "boundary"
  | "approve"
  | "execute"
  | "verify"
  | "audit";

export type AutonomyStageStatus =
  | "passed"
  | "halted_safe"
  | "halted_policy"
  | "halted_boundary"
  | "halted_missing_evidence"
  | "halted_unsafe"
  | "halted_needs_human"
  | "not_reached"
  | "errored";

export interface AutonomyStageResult {
  stage: AutonomyStage;
  status: AutonomyStageStatus;
  /** Operator-readable summary of what happened. */
  summary: string;
  /** Why it stopped (when applicable). */
  reason?: string;
  /** Evidence ref / file path / module produced this result. */
  evidenceRef: string;
  /** Wall-clock cost — populated when we have a real measurement. */
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// Autonomy charter — per-tenant policy controlling how far the loop
// can advance on its own.
// ---------------------------------------------------------------------------

export type AutonomyMode =
  | "observer"        // Loop runs, but every execute halts at approve
  | "review"          // Loop auto-approves only safe stages, halts at execute
  | "assisted"        // Loop auto-approves + auto-executes desktop-review
  | "autonomous";     // Loop auto-executes everything that passes policy +
                      // boundary (still gated by the literal safety contract)

export interface AutonomyCharter {
  mode: AutonomyMode;
  /**
   * Boundary classes the loop is allowed to advance past `policy_gate`
   * on its own. Mutation classes are excluded by type — they live in
   * the `unsafe_never_automate` literal.
   */
  allowedClasses: Exclude<BoundaryClassification, "unsafe_never_automate">[];
  /**
   * Maximum number of distinct actions per cycle the loop is allowed
   * to attempt. Hard upper bound on blast radius per run.
   */
  perCycleActionLimit: number;
  /** Honest human-readable description of why this charter was chosen. */
  rationale: string;
}

// ---------------------------------------------------------------------------
// Cycle — one whole pass of the loop, end-to-end.
// ---------------------------------------------------------------------------

export type AutonomyCycleStatus =
  | "completed_no_actions"
  | "completed_with_approvals"
  | "completed_with_executions"
  | "halted_policy"
  | "halted_boundary"
  | "halted_unsafe"
  | "halted_needs_human"
  | "errored";

export interface AutonomyCandidate {
  id: string;
  rank: number;
  title: string;
  /** Operator-readable one-line description of the proposed change. */
  proposedIntent: string;
  /** Source canonical signal (priority id, risk id, etc.) */
  linkedPriorityId?: string;
  linkedRiskId?: string;
  linkedApprovalPacketId?: string;
  /** Mapped automation boundary class. */
  boundaryClass: BoundaryClassification;
  /** ApprovalReadiness from the packet builder. */
  approvalReadiness?: ApprovalReadiness;
  /** Per-stage history. */
  stages: AutonomyStageResult[];
  /** Outcome literal. */
  outcome:
    | "deferred_to_human"
    | "approval_packet_prepared"
    | "execution_handed_off"
    | "verified_complete"
    | "halted_at_gate"
    | "errored";
  /** Evidence refs operator can verify. */
  evidenceRefs: string[];
  /** Honest limitations of this candidate. */
  limitations: string[];
}

export interface AutonomyCycleReport {
  generatedAt: string;
  tenantId?: string;
  charter: AutonomyCharter;
  /** All candidates considered this cycle (regardless of outcome). */
  candidates: AutonomyCandidate[];
  /** End-to-end cycle outcome. */
  cycleStatus: AutonomyCycleStatus;
  summary: {
    candidatesConsidered: number;
    candidatesDeferred: number;
    approvalPacketsPrepared: number;
    executionsHandedOff: number;
    verifiedComplete: number;
    haltedAtGate: number;
    erroredCount: number;
    /** Rollup of stage statuses across all candidates. */
    stageRollup: Record<AutonomyStageStatus, number>;
  };
  /** When the next cycle is allowed to start (operator-driven cooldown). */
  nextCycleEligibleAt: string;
  /** Hard literal — no other contract can sit on this report. */
  safetyContract: "autonomy_gated_no_unsafe_execution";
  /** Honest limitations of the autonomy engine itself. */
  limitations: string[];
  /** Where the operator should go to inspect / override the cycle. */
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Visual helpers (read by the page so labels never drift from the model)
// ---------------------------------------------------------------------------

export const STAGE_LABEL: Record<AutonomyStage, string> = {
  detect:       "Detect",
  reason:       "Reason",
  simulate:     "Simulate",
  policy_gate:  "Policy gate",
  boundary:     "Automation boundary",
  approve:      "Approve",
  execute:      "Execute",
  verify:       "Verify",
  audit:        "Audit",
};

export const STAGE_STATUS_LABEL: Record<AutonomyStageStatus, string> = {
  passed:                  "passed",
  halted_safe:             "halted · safe",
  halted_policy:           "halted · policy",
  halted_boundary:         "halted · boundary",
  halted_missing_evidence: "halted · evidence",
  halted_unsafe:           "halted · unsafe",
  halted_needs_human:      "halted · needs human",
  not_reached:             "not reached",
  errored:                 "errored",
};

export const STAGE_STATUS_TONE: Record<AutonomyStageStatus, "emerald" | "cyan" | "amber" | "rose" | "violet" | "zinc"> = {
  passed:                  "emerald",
  halted_safe:             "cyan",
  halted_policy:           "amber",
  halted_boundary:         "amber",
  halted_missing_evidence: "amber",
  halted_unsafe:           "rose",
  halted_needs_human:      "violet",
  not_reached:             "zinc",
  errored:                 "rose",
};

export const AUTONOMY_MODE_LABEL: Record<AutonomyMode, string> = {
  observer:    "Observer · review-only",
  review:      "Review · safe auto-approve",
  assisted:    "Assisted · auto-approve + desktop handoff",
  autonomous:  "Autonomous · auto-execute gated by policy",
};

export const CYCLE_STATUS_LABEL: Record<AutonomyCycleStatus, string> = {
  completed_no_actions:        "Cycle complete · no actions",
  completed_with_approvals:    "Cycle complete · approvals prepared",
  completed_with_executions:   "Cycle complete · executions handed off",
  halted_policy:               "Halted · policy",
  halted_boundary:             "Halted · boundary",
  halted_unsafe:               "Halted · unsafe",
  halted_needs_human:          "Halted · needs human",
  errored:                     "Errored",
};
