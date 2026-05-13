/**
 * Execution lifecycle — state machine for the recommendation → audit flow.
 *
 * Mirrors the pattern used by connectorLifecycle.ts. Each plan moves through
 * a typed sequence of states; transitions are explicit and enforced.
 *
 * No execution is automatic. Every transition into "execution.*" states must
 * be preceded by an "execution_plan.approved" state.
 */

export type ExecutionLifecycleState =
  | "recommendation.selected"
  | "execution_plan.drafted"
  | "execution_plan.validated"
  | "execution_plan.requires_approval"
  | "execution_plan.approved"
  | "execution_plan.rejected"
  | "execution_plan.expired"
  | "execution_plan.ready_for_export"
  | "terraform.generated"
  | "cli.generated"
  | "desktop_handoff.ready"
  | "desktop_handoff.delivered"
  | "execution.started"
  | "execution.completed"
  | "execution.failed"
  | "verification.started"
  | "verification.completed"
  | "verification.failed"
  | "rollback.prepared"
  | "rollback.started"
  | "rollback.completed"
  | "rollback.failed"
  | "audit.completed"
  | "lifecycle.idle";

const TRANSITIONS: Record<ExecutionLifecycleState, ExecutionLifecycleState[]> = {
  "recommendation.selected":       ["execution_plan.drafted"],
  "execution_plan.drafted":        ["execution_plan.validated"],
  "execution_plan.validated":      ["execution_plan.requires_approval", "execution_plan.ready_for_export"],
  "execution_plan.requires_approval": ["execution_plan.approved", "execution_plan.rejected", "execution_plan.expired"],
  "execution_plan.approved":       ["execution_plan.ready_for_export"],
  "execution_plan.rejected":       ["lifecycle.idle"],
  "execution_plan.expired":        ["recommendation.selected", "lifecycle.idle"],
  "execution_plan.ready_for_export": ["terraform.generated", "cli.generated", "desktop_handoff.ready"],
  "terraform.generated":           ["desktop_handoff.ready", "execution.started", "lifecycle.idle"],
  "cli.generated":                 ["desktop_handoff.ready", "execution.started", "lifecycle.idle"],
  "desktop_handoff.ready":         ["desktop_handoff.delivered", "lifecycle.idle"],
  "desktop_handoff.delivered":     ["execution.started", "lifecycle.idle"],
  "execution.started":             ["execution.completed", "execution.failed"],
  "execution.completed":           ["verification.started"],
  "execution.failed":              ["rollback.prepared"],
  "verification.started":          ["verification.completed", "verification.failed"],
  "verification.completed":        ["audit.completed"],
  "verification.failed":           ["rollback.prepared"],
  "rollback.prepared":             ["rollback.started"],
  "rollback.started":              ["rollback.completed", "rollback.failed"],
  "rollback.completed":            ["audit.completed"],
  "rollback.failed":               ["audit.completed"], // Audit still completes — failure is logged
  "audit.completed":               ["lifecycle.idle"],
  "lifecycle.idle":                ["recommendation.selected"],
};

export function canTransition(from: ExecutionLifecycleState, to: ExecutionLifecycleState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: ExecutionLifecycleState): ExecutionLifecycleState[] {
  return TRANSITIONS[from] ?? [];
}

/** States that block on human approval. */
export const APPROVAL_GATE_STATES = new Set<ExecutionLifecycleState>([
  "execution_plan.requires_approval",
  "execution_plan.approved",
  "execution_plan.rejected",
]);

/** States that imply the plan is touching live infrastructure. */
export const APPLY_STATES = new Set<ExecutionLifecycleState>([
  "execution.started",
  "execution.completed",
  "execution.failed",
  "rollback.started",
  "rollback.completed",
  "rollback.failed",
]);

/** States that imply the plan is dormant — safe to surface in idle queues. */
export const IDLE_STATES = new Set<ExecutionLifecycleState>([
  "execution_plan.rejected",
  "execution_plan.expired",
  "audit.completed",
  "lifecycle.idle",
]);

export interface ExecutionLifecycleContext {
  planId: string;
  state: ExecutionLifecycleState;
  /** Approval gate context — populated when state is in APPROVAL_GATE_STATES. */
  approval?: {
    requestedAt: string;
    approver?: string;
    approvedAt?: string;
    rejectedAt?: string;
    rejectionReason?: string;
    expiresAt?: string;
  };
  /** Apply context — populated when state is in APPLY_STATES. */
  apply?: {
    startedAt?: string;
    completedAt?: string;
    failedAt?: string;
    error?: string;
  };
  updatedAt: string;
  history: { state: ExecutionLifecycleState; at: string; note?: string }[];
}

export function advance(
  ctx: ExecutionLifecycleContext,
  to: ExecutionLifecycleState,
  note?: string
): ExecutionLifecycleContext {
  if (!canTransition(ctx.state, to)) {
    throw new Error(`Invalid execution lifecycle transition: ${ctx.state} → ${to}`);
  }
  const at = new Date().toISOString();
  return {
    ...ctx,
    state: to,
    updatedAt: at,
    history: [{ state: to, at, note }, ...ctx.history].slice(0, 100),
  };
}

export function createContext(planId: string): ExecutionLifecycleContext {
  return {
    planId,
    state: "recommendation.selected",
    updatedAt: new Date().toISOString(),
    history: [{ state: "recommendation.selected", at: new Date().toISOString() }],
  };
}

export interface ExecutionLifecycleDisplay {
  label: string;
  detail: string;
  pill: string;
  semantic: "neutral" | "running" | "success" | "warning" | "error";
}

const DISPLAY: Record<ExecutionLifecycleState, ExecutionLifecycleDisplay> = {
  "recommendation.selected":          { label: "Recommendation selected",   detail: "User picked a recommendation; plan not yet drafted.",      pill: "Selected",       semantic: "neutral" },
  "execution_plan.drafted":           { label: "Plan drafted",              detail: "Initial plan generated; validating safety.",                pill: "Draft",          semantic: "running" },
  "execution_plan.validated":         { label: "Plan validated",            detail: "Safety checks passed; awaiting policy decision.",           pill: "Validated",      semantic: "running" },
  "execution_plan.requires_approval": { label: "Approval required",         detail: "Human review required before apply.",                       pill: "Approval",       semantic: "warning" },
  "execution_plan.approved":          { label: "Approved",                  detail: "Plan approved; awaiting export or apply.",                  pill: "Approved",       semantic: "success" },
  "execution_plan.rejected":          { label: "Rejected",                  detail: "Plan rejected by approver.",                                pill: "Rejected",       semantic: "error" },
  "execution_plan.expired":           { label: "Expired",                   detail: "Plan not approved within the approval window.",             pill: "Expired",        semantic: "neutral" },
  "execution_plan.ready_for_export":  { label: "Ready for export",          detail: "Terraform / CLI artifacts can be generated.",              pill: "Export ready",   semantic: "success" },
  "terraform.generated":              { label: "Terraform generated",       detail: "Phase-by-phase Terraform available for download.",          pill: "Terraform",      semantic: "success" },
  "cli.generated":                    { label: "CLI generated",             detail: "Provider CLI command sequence available.",                  pill: "CLI",            semantic: "success" },
  "desktop_handoff.ready":            { label: "Desktop handoff ready",     detail: "Plan packaged for the desktop app.",                        pill: "Handoff",        semantic: "success" },
  "desktop_handoff.delivered":        { label: "Desktop handoff delivered", detail: "Plan opened in the desktop app.",                           pill: "Delivered",      semantic: "success" },
  "execution.started":                { label: "Execution started",         detail: "Cloud apply in progress.",                                  pill: "Executing",      semantic: "running" },
  "execution.completed":              { label: "Execution completed",       detail: "Apply finished; verification queued.",                      pill: "Applied",        semantic: "success" },
  "execution.failed":                 { label: "Execution failed",          detail: "Apply errored; rollback prepared.",                         pill: "Failed",         semantic: "error" },
  "verification.started":             { label: "Verifying outcome",         detail: "Health checks + cost shift + drift verification running.", pill: "Verifying",      semantic: "running" },
  "verification.completed":           { label: "Verification passed",       detail: "Intended outcome confirmed.",                               pill: "Verified",       semantic: "success" },
  "verification.failed":              { label: "Verification failed",       detail: "Post-apply checks failed; rollback prepared.",              pill: "Verify failed",  semantic: "error" },
  "rollback.prepared":                { label: "Rollback prepared",         detail: "Pre-flight state recovered; ready to restore.",             pill: "Rollback ready", semantic: "warning" },
  "rollback.started":                 { label: "Rolling back",              detail: "Restoring pre-flight state.",                               pill: "Rollback",       semantic: "running" },
  "rollback.completed":               { label: "Rollback completed",        detail: "Pre-flight state restored.",                                pill: "Rolled back",    semantic: "neutral" },
  "rollback.failed":                  { label: "Rollback failed",           detail: "Rollback encountered an error; manual review required.",   pill: "Rollback failed",semantic: "error" },
  "audit.completed":                  { label: "Audit completed",           detail: "Outcome recorded immutably.",                               pill: "Audited",        semantic: "success" },
  "lifecycle.idle":                   { label: "Idle",                      detail: "Plan terminal; safe to archive.",                           pill: "Idle",           semantic: "neutral" },
};

export function displayFor(state: ExecutionLifecycleState): ExecutionLifecycleDisplay {
  return DISPLAY[state];
}
