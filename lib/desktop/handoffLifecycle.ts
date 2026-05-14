/**
 * Rich desktop handoff lifecycle.
 *
 * `executionHandoff.ts` packages a HandoffBundle with a small 4-state
 * `HandoffStatus` enum (`ready/delivered/rejected_by_desktop/expired`).
 * That's enough for the bundle producer, but the UI + audit + reliability
 * surfaces need a finer grained view of where each handoff sits.
 *
 * This module is the canonical lifecycle: 10 states covering eligibility,
 * preparation, delivery, audit sync, and terminal outcomes. It composes
 * with `executionHandoff.ts` — the bundle remains the artifact, this
 * module is the state machine + display layer.
 *
 * Hard rule: a handoff cannot transition to `opened_in_desktop` without
 * an approval grant. The state machine encodes that requirement.
 */

import type { ApprovalId, ExecutionPlanId, OrganizationId, UserId } from "@/lib/domain/ids";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type HandoffLifecycleState =
  | "not_available"        // Desktop unreachable or unpaired
  | "eligible"             // Plan + approval + policy OK; user hasn't requested handoff yet
  | "preparing"            // Bundle being assembled
  | "ready"                // Bundle prepared; awaiting desktop pickup
  | "opened_in_desktop"    // Desktop confirmed receipt + opened
  | "expired"              // Bundle TTL passed before opening
  | "failed"               // Preparation / signature / verification failed
  | "completed"            // Desktop reported completion (review or execution)
  | "audit_sync_pending"   // Desktop ran; awaiting audit upload
  | "audit_synced";        // Audit events from the desktop landed in the web store

export type HandoffLifecycleEvent =
  | "request_handoff"           // User clicks "Open in Desktop"
  | "bundle_ready"
  | "desktop_acked"             // Desktop confirmed receipt
  | "ttl_elapsed"
  | "preparation_failed"
  | "desktop_completed"
  | "audit_uploaded"
  | "audit_sync_failed"
  | "user_cancelled"
  | "approval_revoked";

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<HandoffLifecycleState, Partial<Record<HandoffLifecycleEvent, HandoffLifecycleState>>> = {
  not_available: { /* terminal until desktop pairs again */ },
  eligible: {
    request_handoff: "preparing",
    user_cancelled: "not_available",
    approval_revoked: "not_available",
  },
  preparing: {
    bundle_ready: "ready",
    preparation_failed: "failed",
    user_cancelled: "not_available",
  },
  ready: {
    desktop_acked: "opened_in_desktop",
    ttl_elapsed: "expired",
    user_cancelled: "not_available",
  },
  opened_in_desktop: {
    desktop_completed: "completed",
    ttl_elapsed: "expired",
  },
  completed: {
    audit_uploaded: "audit_synced",
    audit_sync_failed: "audit_sync_pending",
  },
  audit_sync_pending: {
    audit_uploaded: "audit_synced",
  },
  audit_synced: {},   // terminal success
  expired: {},        // terminal
  failed: {},         // terminal
};

export function canTransition(from: HandoffLifecycleState, event: HandoffLifecycleEvent): boolean {
  return Boolean(TRANSITIONS[from]?.[event]);
}

export function nextState(from: HandoffLifecycleState, event: HandoffLifecycleEvent): HandoffLifecycleState | null {
  return TRANSITIONS[from]?.[event] ?? null;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface HandoffEligibility {
  approvalGranted: boolean;
  policyAllowed: boolean;
  desktopPaired: boolean;
  desktopTrusted: boolean;
  rollbackPrepared: boolean;
}

export interface HandoffLifecycleContext {
  organizationId: OrganizationId;
  userId: UserId;
  executionPlanId: ExecutionPlanId;
  approvalId?: ApprovalId;
  state: HandoffLifecycleState;
  /** What gates currently allow / block eligibility. */
  eligibility: HandoffEligibility;
  /** TTL — bundle expires at this time when state is `ready`. */
  bundleExpiresAt?: string;
  history: { state: HandoffLifecycleState; at: string; note?: string }[];
  updatedAt: string;
  failureReason?: string;
}

/**
 * Decide whether a plan is eligible for handoff, given current gates.
 * Returns the appropriate starting state and a reason if blocked.
 */
export function decideEligibility(input: {
  organizationId: OrganizationId;
  userId: UserId;
  executionPlanId: ExecutionPlanId;
  eligibility: HandoffEligibility;
}): HandoffLifecycleContext {
  const now = new Date().toISOString();
  const { approvalGranted, policyAllowed, desktopPaired, desktopTrusted, rollbackPrepared } = input.eligibility;
  let state: HandoffLifecycleState = "eligible";
  let failureReason: string | undefined;
  if (!desktopPaired || !desktopTrusted) {
    state = "not_available";
    failureReason = !desktopPaired ? "No paired Axiom desktop." : "Paired desktop is not in a trusted state.";
  } else if (!approvalGranted) {
    state = "not_available";
    failureReason = "Approval has not been granted yet.";
  } else if (!policyAllowed) {
    state = "not_available";
    failureReason = "Tenant policy does not allow desktop handoff for this plan class.";
  } else if (!rollbackPrepared) {
    state = "not_available";
    failureReason = "Rollback plan has not been prepared.";
  }
  return {
    organizationId: input.organizationId,
    userId: input.userId,
    executionPlanId: input.executionPlanId,
    state,
    eligibility: input.eligibility,
    history: [{ state, at: now }],
    updatedAt: now,
    failureReason,
  };
}

/**
 * Advance the lifecycle. Throws on invalid transitions so callers can map
 * the error to an AxiomError. Pure — returns a new context.
 */
export function advance(ctx: HandoffLifecycleContext, event: HandoffLifecycleEvent, note?: string): HandoffLifecycleContext {
  const next = nextState(ctx.state, event);
  if (!next) {
    throw new Error(`Invalid handoff transition: ${ctx.state} →(${event})`);
  }
  const now = new Date().toISOString();
  return {
    ...ctx,
    state: next,
    history: [{ state: next, at: now, note }, ...ctx.history].slice(0, 50),
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export interface HandoffDisplay {
  label: string;
  detail: string;
  pill: string;
  semantic: "neutral" | "running" | "success" | "warning" | "error";
}

const DISPLAY: Record<HandoffLifecycleState, HandoffDisplay> = {
  not_available:      { label: "Not available",        detail: "Desktop handoff isn't available — see the eligibility checklist.",    pill: "Unavailable",   semantic: "neutral" },
  eligible:           { label: "Eligible",             detail: "All gates pass. User can request a desktop handoff.",                  pill: "Eligible",      semantic: "success" },
  preparing:          { label: "Preparing bundle",     detail: "Packaging plan + Terraform + CLI + rollback + verification.",          pill: "Preparing",     semantic: "running" },
  ready:              { label: "Ready for desktop",    detail: "Bundle prepared and signed. Awaiting desktop pickup.",                 pill: "Ready",         semantic: "success" },
  opened_in_desktop:  { label: "Opened in desktop",    detail: "Desktop confirmed receipt and opened the bundle.",                     pill: "In desktop",    semantic: "running" },
  completed:          { label: "Completed",            detail: "Desktop reported completion. Awaiting audit sync.",                    pill: "Completed",     semantic: "success" },
  audit_sync_pending: { label: "Audit sync pending",   detail: "Desktop ran but audit events haven't reached the web store yet.",      pill: "Sync pending",  semantic: "warning" },
  audit_synced:       { label: "Audit synced",         detail: "All desktop audit events landed in the web store. Handoff terminal.",  pill: "Synced",        semantic: "success" },
  expired:            { label: "Expired",              detail: "Bundle TTL elapsed before the desktop opened it.",                     pill: "Expired",       semantic: "warning" },
  failed:             { label: "Failed",               detail: "Handoff preparation or verification failed.",                          pill: "Failed",        semantic: "error"   },
};

export function displayFor(state: HandoffLifecycleState): HandoffDisplay {
  return DISPLAY[state];
}

/**
 * Build a typed checklist describing which gates the user still needs to
 * satisfy before requesting a handoff. The Execution Detail and Reliability
 * UIs render this directly.
 */
export interface EligibilityCheck {
  id: keyof HandoffEligibility;
  label: string;
  ok: boolean;
  detail: string;
  safeNextAction?: { label: string; href: string };
}

export function eligibilityChecklist(e: HandoffEligibility): EligibilityCheck[] {
  return [
    {
      id: "approvalGranted",
      label: "Approval granted",
      ok: e.approvalGranted,
      detail: e.approvalGranted ? "An approver has signed off." : "Plan still needs an approver.",
      safeNextAction: e.approvalGranted ? undefined : { label: "Open approvals", href: "/dashboard/approvals" },
    },
    {
      id: "policyAllowed",
      label: "Policy allows handoff",
      ok: e.policyAllowed,
      detail: e.policyAllowed ? "Tenant policy permits desktop handoff for this plan class." : "Tenant policy blocks desktop handoff for this plan class.",
      safeNextAction: e.policyAllowed ? undefined : { label: "Review governance", href: "/dashboard/governance" },
    },
    {
      id: "desktopPaired",
      label: "Desktop paired",
      ok: e.desktopPaired,
      detail: e.desktopPaired ? "A desktop runtime is paired with this account." : "Pair an Axiom desktop runtime to enable handoff.",
      safeNextAction: e.desktopPaired ? undefined : { label: "Download desktop", href: "/download" },
    },
    {
      id: "desktopTrusted",
      label: "Desktop trusted",
      ok: e.desktopTrusted,
      detail: e.desktopTrusted ? "Paired desktop is within the trust profile." : "Paired desktop is blocked (version / signature / policy).",
      safeNextAction: e.desktopTrusted ? undefined : { label: "Open desktop security", href: "/dashboard/security" },
    },
    {
      id: "rollbackPrepared",
      label: "Rollback prepared",
      ok: e.rollbackPrepared,
      detail: e.rollbackPrepared ? "Rollback plan attached to this handoff." : "No rollback plan — desktop handoff is blocked.",
      safeNextAction: e.rollbackPrepared ? undefined : { label: "Open execution plan", href: "/dashboard/command-center" },
    },
  ];
}
