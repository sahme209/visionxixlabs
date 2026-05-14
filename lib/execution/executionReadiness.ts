/**
 * Execution Readiness Evaluator.
 *
 * Before any plan can move from "candidate" to "approved → apply", the
 * brain runs this evaluator. It composes the typed readiness signals from
 * across the platform (connection, freshness, confidence, policy, approval,
 * rollback, verification, desktop, audit, permission, feature mode) and
 * produces a single decision the rest of the system reads from.
 *
 * No hidden chain-of-thought. Every "blocked" decision exposes its evidence
 * + safe next action so the UI + copilot can explain it.
 */

import type { CloudProvider } from "@/lib/domain/provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReadinessDecision =
  | "ready"
  | "requires_approval"
  | "requires_validation"
  | "preview_only"
  | "blocked"
  | "unsafe";

export type ReadinessFactorStatus = "pass" | "warn" | "fail" | "skip";

export interface ReadinessFactor {
  /** Stable id used by validation loop + UI. */
  id: string;
  label: string;
  status: ReadinessFactorStatus;
  detail: string;
  /** Optional evidence pointer so the UI can deep-link. */
  evidence?: { label: string; value: string };
}

export interface ExecutionReadinessInput {
  planId: string;
  provider: CloudProvider | "github" | "multi";
  /** Has the provider/account been validated end-to-end? */
  providerConnected: boolean;
  /** Are the underlying resource snapshots fresh enough to plan against? */
  snapshotFresh: boolean;
  /** 0..1 — confidence in the source findings. */
  findingConfidence: number;
  /** 0..1 — confidence in the resulting recommendation. */
  recommendationConfidence: number;
  /** Policy verdict from governance/policy engine. */
  policyAllows: boolean;
  policyReason?: string;
  /** Has approval already been granted? */
  approvalGranted: boolean;
  /** Does the plan include an explicit rollback path? */
  rollbackPresent: boolean;
  /** Does the plan include a typed verification checklist? */
  verificationPresent: boolean;
  /** Is the destination workstation (desktop) ready, if local-apply requested? */
  desktopHandoffEligible: boolean;
  /** Will the apply emit audit records? */
  auditWired: boolean;
  /** Does the current user have permission to apply? */
  userHasPermission: boolean;
  /** Feature mode for this provider — preview, expanding, live. */
  featureMode: "preview" | "expanding" | "live" | "blocked";
}

export interface ExecutionReadinessOutcome {
  planId: string;
  decision: ReadinessDecision;
  /** Plain-language one-liner. */
  reason: string;
  /** Concrete next action the operator can take. */
  safeNextAction: { label: string; href?: string; kind: "approve" | "validate" | "configure" | "review" | "wait" };
  factors: ReadinessFactor[];
  evaluatedAt: string;
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

function pass(id: string, label: string, detail: string): ReadinessFactor {
  return { id, label, status: "pass", detail };
}
function warn(id: string, label: string, detail: string): ReadinessFactor {
  return { id, label, status: "warn", detail };
}
function fail(id: string, label: string, detail: string): ReadinessFactor {
  return { id, label, status: "fail", detail };
}

export function evaluateExecutionReadiness(input: ExecutionReadinessInput): ExecutionReadinessOutcome {
  const factors: ReadinessFactor[] = [];

  factors.push(input.providerConnected
    ? pass("connection",  "Provider connection",  "Connection validated end-to-end.")
    : fail("connection",  "Provider connection",  "Provider is not connected. Validate credentials first."));

  factors.push(input.snapshotFresh
    ? pass("freshness",   "Snapshot freshness",   "Snapshot is fresh enough to plan against.")
    : warn("freshness",   "Snapshot freshness",   "Snapshot is stale. A new scan is recommended before apply."));

  factors.push(input.findingConfidence >= 0.65
    ? pass("finding_confidence", "Finding confidence", `Underlying finding confidence ${(input.findingConfidence * 100).toFixed(0)}%.`)
    : warn("finding_confidence", "Finding confidence", `Finding confidence ${(input.findingConfidence * 100).toFixed(0)}% — consider re-running scan with broader regions.`));

  factors.push(input.recommendationConfidence >= 0.7
    ? pass("recommendation_confidence", "Recommendation confidence", `Recommendation confidence ${(input.recommendationConfidence * 100).toFixed(0)}%.`)
    : warn("recommendation_confidence", "Recommendation confidence", `Recommendation confidence ${(input.recommendationConfidence * 100).toFixed(0)}% — additional review suggested.`));

  factors.push(input.policyAllows
    ? pass("policy",      "Policy verdict",       "Policy engine allows this action.")
    : fail("policy",      "Policy verdict",       input.policyReason ?? "Policy engine blocks this action."));

  factors.push(input.approvalGranted
    ? pass("approval",    "Approval",             "Approval has been granted.")
    : warn("approval",    "Approval",             "Approval is required before apply."));

  factors.push(input.rollbackPresent
    ? pass("rollback",    "Rollback plan",        "Rollback path is documented and reversible.")
    : fail("rollback",    "Rollback plan",        "Plan has no documented rollback path."));

  factors.push(input.verificationPresent
    ? pass("verification","Verification checks",  "Post-apply verification checklist is present.")
    : warn("verification","Verification checks",  "Plan lacks a verification checklist."));

  factors.push(input.auditWired
    ? pass("audit",       "Audit wiring",         "Apply emits audit events to the secure store.")
    : fail("audit",       "Audit wiring",         "Audit pipeline is not wired — apply must wait."));

  factors.push(input.userHasPermission
    ? pass("permission",  "User permission",      "Operator has permission to apply.")
    : fail("permission",  "User permission",      "Operator lacks the role required to apply."));

  factors.push({
    id: "feature_mode",
    label: "Feature mode",
    status: input.featureMode === "live" ? "pass" : input.featureMode === "blocked" ? "fail" : "warn",
    detail: input.featureMode === "live"
      ? "Live execution is enabled for this provider."
      : input.featureMode === "blocked"
        ? "Execution is blocked by feature flag."
        : `Provider currently in ${input.featureMode} mode — apply is dry-run only.`,
  });

  // ── decision ─────────────────────────────────────────────────────────
  const hasFail = factors.some((f) => f.status === "fail");
  const hasWarn = factors.some((f) => f.status === "warn");

  let decision: ReadinessDecision;
  let reason: string;
  let safeNextAction: ExecutionReadinessOutcome["safeNextAction"];

  if (!input.providerConnected) {
    decision = "blocked";
    reason = "Provider is not connected.";
    safeNextAction = { label: "Connect provider", href: "/operator/onboarding", kind: "configure" };
  } else if (input.featureMode === "blocked") {
    decision = "blocked";
    reason = "Execution is blocked by feature configuration.";
    safeNextAction = { label: "Review feature settings", href: "/dashboard/trust", kind: "review" };
  } else if (!input.policyAllows) {
    decision = "unsafe";
    reason = input.policyReason ?? "Policy engine blocks this action.";
    safeNextAction = { label: "Review policy decision", href: "/dashboard/trust", kind: "review" };
  } else if (!input.userHasPermission) {
    decision = "blocked";
    reason = "Operator lacks the role required to apply.";
    safeNextAction = { label: "Request elevated approval", kind: "approve" };
  } else if (!input.auditWired || !input.rollbackPresent) {
    decision = "blocked";
    reason = !input.auditWired ? "Audit pipeline is not wired." : "Plan is missing a rollback path.";
    safeNextAction = { label: "Regenerate plan with rollback", kind: "validate" };
  } else if (input.featureMode === "preview" || input.featureMode === "expanding") {
    decision = "preview_only";
    reason = `Provider is in ${input.featureMode} mode — apply renders artefacts but does not mutate cloud state.`;
    safeNextAction = { label: "Export to desktop for review", kind: "review" };
  } else if (!input.approvalGranted) {
    decision = "requires_approval";
    reason = "Approval is required before apply.";
    safeNextAction = { label: "Request approval", kind: "approve" };
  } else if (hasFail) {
    decision = "blocked";
    reason = factors.find((f) => f.status === "fail")?.detail ?? "Blocked.";
    safeNextAction = { label: "Resolve blockers", kind: "validate" };
  } else if (hasWarn) {
    decision = "requires_validation";
    reason = "Plan can proceed once warnings are acknowledged.";
    safeNextAction = { label: "Re-validate plan", kind: "validate" };
  } else {
    decision = "ready";
    reason = "All readiness checks pass.";
    safeNextAction = { label: "Apply plan", kind: "approve" };
  }

  return {
    planId: input.planId,
    decision,
    reason,
    safeNextAction,
    factors,
    evaluatedAt: new Date().toISOString(),
  };
}

export const READINESS_DECISION_LABEL: Record<ReadinessDecision, string> = {
  ready: "Ready",
  requires_approval: "Requires approval",
  requires_validation: "Requires validation",
  preview_only: "Preview only",
  blocked: "Blocked",
  unsafe: "Unsafe",
};

export const READINESS_DECISION_SEMANTIC: Record<ReadinessDecision, "pass" | "warn" | "fail"> = {
  ready: "pass",
  requires_approval: "warn",
  requires_validation: "warn",
  preview_only: "warn",
  blocked: "fail",
  unsafe: "fail",
};
