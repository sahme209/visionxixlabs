/**
 * Execution Orchestration State Machine.
 *
 * Single source of truth for allowed transitions between
 * `OrchestrationStage` values. No UI may transition an orchestration
 * without consulting `attemptTransition` first — denied transitions
 * return a structured reason + required-stage + missing-requirements
 * payload that the UI + audit log read from.
 *
 * Composes (does not replace) `lib/execution/executionLifecycle.ts`,
 * which models the lower-level plan-state machine (queued/running/etc).
 * This state machine sits *above* lifecycle and gates everything an
 * operator can ask Axiom to do.
 */

import type {
  OrchestrationStage,
  OrchestrationStatus,
} from "@/lib/execution/orchestrationModel";

// ---------------------------------------------------------------------------
// Transition table
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<OrchestrationStage, OrchestrationStage[]> = {
  identified:           ["planned", "cancelled", "execution_blocked"],
  planned:              ["simulated", "cancelled", "execution_blocked"],
  simulated:            ["policy_checked", "execution_blocked", "cancelled"],
  policy_checked:       ["approval_requested", "approved", "rejected", "execution_blocked"],
  approval_requested:   ["approved", "rejected", "cancelled"],
  approved:             ["dry_run_ready", "desktop_review_ready", "execution_blocked", "cancelled"],
  rejected:             ["cancelled"],
  dry_run_ready:        ["dry_run_completed", "execution_blocked", "cancelled"],
  dry_run_completed:    ["desktop_review_ready", "execution_ready", "execution_blocked", "cancelled"],
  desktop_review_ready: ["execution_ready", "execution_blocked", "cancelled"],
  execution_ready:      ["verification_pending", "execution_blocked", "cancelled"],
  execution_blocked:    ["cancelled", "identified"],
  verification_pending: ["verified", "failed", "rollback_required"],
  verified:             ["completed", "rollback_ready"],
  rollback_ready:       ["completed", "cancelled"],
  rollback_required:    ["failed", "cancelled"],
  completed:            [],
  failed:               ["identified"],
  cancelled:            [],
};

// ---------------------------------------------------------------------------
// Requirements per stage
// ---------------------------------------------------------------------------

export interface StageRequirements {
  /** Refs the orchestration must carry by this stage. */
  refs: string[];
  /** Plain-language explanation. */
  explanation: string;
}

const REQUIRES_BY_STAGE: Record<OrchestrationStage, StageRequirements> = {
  identified:           { refs: ["sourceFindingId"], explanation: "A source finding / blocker is required." },
  planned:              { refs: ["remediationCandidateId"], explanation: "A remediation candidate must exist." },
  simulated:            { refs: ["simulationId", "changeSetId"], explanation: "A simulation + ChangeSet must exist." },
  policy_checked:       { refs: ["policyDecisionId"], explanation: "Policy decision must be recorded." },
  approval_requested:   { refs: ["approvalRequestId"], explanation: "An approval request must exist." },
  approved:             { refs: ["approvalRequestId", "policyDecisionId"], explanation: "Approval and policy must be approved." },
  rejected:             { refs: ["approvalRequestId"], explanation: "Approval was rejected." },
  dry_run_ready:        { refs: ["approvalRequestId"], explanation: "Approval and preflight must both pass." },
  dry_run_completed:    { refs: ["approvalRequestId"], explanation: "Dry-run must have run successfully." },
  desktop_review_ready: { refs: ["desktopHandoffId"], explanation: "A signed desktop handoff must exist." },
  execution_ready:      { refs: ["approvalRequestId", "policyDecisionId"], explanation: "Approval, policy, preflight, rollback, verification must all be present." },
  execution_blocked:    { refs: [], explanation: "Execution is blocked. Resolve the listed blockers." },
  verification_pending: { refs: [], explanation: "Verification checks must run after execution." },
  verified:             { refs: [], explanation: "Verification passed." },
  rollback_ready:       { refs: [], explanation: "Rollback plan is available if needed." },
  rollback_required:    { refs: [], explanation: "Rollback is required after the last execution attempt." },
  completed:            { refs: [], explanation: "Orchestration complete." },
  failed:               { refs: [], explanation: "Orchestration failed. Inspect audit trail." },
  cancelled:            { refs: [], explanation: "Orchestration cancelled." },
};

// ---------------------------------------------------------------------------
// Transition attempt
// ---------------------------------------------------------------------------

export interface TransitionAttemptInput {
  from: OrchestrationStage;
  to: OrchestrationStage;
  /** What references the orchestration currently has populated. */
  presentRefs: string[];
  /** Honest source mode — preview/planned/blocked rejects live transitions. */
  sourceMode: "live" | "preview" | "planned" | "blocked";
  /** Whether the operator has the required approver role. */
  operatorIsApprover?: boolean;
  /** Whether preflight has passed. */
  preflightPassed?: boolean;
  /** Whether rollback plan is documented. */
  rollbackPresent?: boolean;
  /** Whether verification plan is present. */
  verificationPresent?: boolean;
  /** Whether audit pipeline is wired. */
  auditWired?: boolean;
  /** Whether desktop handoff is signed + accepted. */
  desktopAccepted?: boolean;
}

export interface TransitionAttemptResult {
  allowed: boolean;
  denied?: boolean;
  reason: string;
  /** Stage the orchestration must reach first when the requested transition is denied. */
  requiredStage?: OrchestrationStage;
  /** What's missing — references + flags. */
  missingRequirements: string[];
  /** Should an audit event be emitted on this attempt? */
  auditEventRequired: boolean;
  /** Policy reference to surface in the UI. */
  policyReference?: string;
  /** Concrete next action the UI should expose. */
  safeNextAction: { label: string; href?: string };
  /** Status the orchestration should display after this attempt. */
  newStatus?: OrchestrationStatus;
}

const HARD_BLOCKED: { from: OrchestrationStage; to: OrchestrationStage; reason: string }[] = [
  { from: "rejected",          to: "execution_ready",        reason: "Rejected orchestrations cannot move directly to execution." },
  { from: "execution_blocked", to: "execution_ready",        reason: "Execution is blocked — resolve blockers and restart from `identified`." },
  { from: "execution_blocked", to: "verification_pending",   reason: "Cannot start verification while execution is blocked." },
];

function isHardBlocked(from: OrchestrationStage, to: OrchestrationStage): string | null {
  const match = HARD_BLOCKED.find((b) => b.from === from && b.to === to);
  return match ? match.reason : null;
}

function transitionAllowed(from: OrchestrationStage, to: OrchestrationStage): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// ---------------------------------------------------------------------------
// Public attemptTransition
// ---------------------------------------------------------------------------

export function attemptTransition(input: TransitionAttemptInput): TransitionAttemptResult {
  const missing: string[] = [];

  // Hard structural transition.
  const hard = isHardBlocked(input.from, input.to);
  if (hard) {
    return {
      allowed: false,
      denied: true,
      reason: hard,
      requiredStage: "identified",
      missingRequirements: [],
      auditEventRequired: true,
      safeNextAction: { label: "Restart from `identified`", href: "/dashboard/orchestration" },
      newStatus: "blocked",
    };
  }

  if (!transitionAllowed(input.from, input.to)) {
    return {
      allowed: false,
      denied: true,
      reason: `Transition ${input.from} → ${input.to} is not in the allowed table.`,
      requiredStage: TRANSITIONS[input.from][0],
      missingRequirements: [],
      auditEventRequired: false,
      safeNextAction: { label: "Continue with the next valid stage", href: "/dashboard/orchestration" },
      newStatus: "blocked",
    };
  }

  // Source-mode gate — preview/planned/blocked cannot move into execution stages.
  const EXECUTION_STAGES: OrchestrationStage[] = ["execution_ready", "verification_pending", "verified", "completed"];
  if (EXECUTION_STAGES.includes(input.to) && input.sourceMode !== "live") {
    return {
      allowed: false,
      denied: true,
      reason: `Source mode is ${input.sourceMode}; live execution stages are not reachable.`,
      requiredStage: "execution_blocked",
      missingRequirements: [`source mode must be 'live' (currently '${input.sourceMode}')`],
      auditEventRequired: true,
      policyReference: "policy.execution.preview_blocked",
      safeNextAction: { label: "Connect provider live", href: "/operator/onboarding" },
      newStatus: "preview_only",
    };
  }

  // Reference + flag gates per destination stage.
  const required = REQUIRES_BY_STAGE[input.to].refs;
  for (const r of required) {
    if (!input.presentRefs.includes(r)) missing.push(`reference: ${r}`);
  }

  if (input.to === "approved" && !input.operatorIsApprover) {
    missing.push("operator must hold the `approver` role");
  }
  if (input.to === "dry_run_ready" && input.preflightPassed === false) {
    missing.push("preflight must pass");
  }
  if (input.to === "execution_ready") {
    if (!input.rollbackPresent)     missing.push("rollback plan must be present");
    if (!input.verificationPresent) missing.push("verification plan must be present");
    if (!input.auditWired)           missing.push("audit pipeline must be wired");
    if (!input.operatorIsApprover)   missing.push("an approver must have approved");
  }
  if (input.to === "desktop_review_ready" && !input.desktopAccepted) {
    missing.push("desktop handoff must be accepted by a paired workstation");
  }

  if (missing.length > 0) {
    return {
      allowed: false,
      denied: true,
      reason: `Cannot move to ${input.to}: ${missing.length} requirement(s) missing.`,
      requiredStage: input.from,
      missingRequirements: missing,
      auditEventRequired: false,
      safeNextAction: { label: "Resolve missing requirements", href: "/dashboard/orchestration" },
      newStatus: "blocked",
    };
  }

  // Allowed.
  return {
    allowed: true,
    reason: `Transition ${input.from} → ${input.to} allowed.`,
    missingRequirements: [],
    auditEventRequired: true,
    safeNextAction: { label: `Mark as ${input.to.replace(/_/g, " ")}` },
    newStatus: undefined,
  };
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export function nextStages(stage: OrchestrationStage): OrchestrationStage[] {
  return TRANSITIONS[stage] ?? [];
}

export function requirementsFor(stage: OrchestrationStage): StageRequirements {
  return REQUIRES_BY_STAGE[stage];
}
