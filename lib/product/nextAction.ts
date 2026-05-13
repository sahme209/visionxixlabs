/**
 * Next-action engine — given the user's current operational state,
 * return the single most-useful next CTA. No dead ends.
 *
 * Pure function over typed inputs (lifecycle states, connection counts,
 * pending approvals, ReleaseOps connector state, desktop runtime status).
 * UI surfaces ask: "what should this user do right now?" and get a typed
 * answer that ties into the ctaMap.
 */

import type { Cta } from "@/lib/product/ctaMap";
import { CTA_REGISTRY } from "@/lib/product/ctaMap";
import type { LifecycleState } from "@/lib/cloud/connectorLifecycle";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface UserOperationalState {
  /** Number of connected cloud accounts (any provider). */
  connectedClouds: number;
  /** Current lifecycle state for the primary cloud connection (if any). */
  primaryLifecycle?: LifecycleState;
  /** Pending approvals waiting for the user. */
  pendingApprovals: number;
  /** Number of execution plans ready to review. */
  readyPlans: number;
  /** Whether ReleaseOps GitHub connector is connected. */
  releaseopsConnected: boolean;
  /** Number of services below readiness threshold. */
  releaseopsServicesAtRisk: number;
  /** Desktop runtime detected in current environment. */
  desktopAvailable: boolean;
  /** Whether the user has run at least one scan. */
  hasRunScan: boolean;
  /** Has the user signed up? */
  isAuthenticated: boolean;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface NextActionResult {
  /** Primary suggested CTA. */
  cta: Cta;
  /** One-sentence reason for surfacing this action. */
  reason: string;
  /** Optional secondary action (e.g., "Or read the setup guide"). */
  secondary?: Cta;
  /** Optional severity hint — drives UI emphasis. */
  severity?: "info" | "success" | "warning" | "critical";
}

// ---------------------------------------------------------------------------
// Resolver — priority-ordered rules
// ---------------------------------------------------------------------------

/**
 * Resolve the next-best action for a user. Rules are evaluated in priority
 * order; the first match wins. Order is the policy:
 *
 *   1. Critical state (failure recovery) — high severity
 *   2. Pending approvals — warning
 *   3. Plans ready to review — warning
 *   4. Lifecycle in flight — running
 *   5. Cloud not connected — onboarding
 *   6. ReleaseOps next steps
 *   7. Desktop next steps
 *   8. Default — happy path
 */
export function resolveNextAction(state: UserOperationalState): NextActionResult {
  // 1. Failure recovery
  if (state.primaryLifecycle === "credentials.failed") {
    return {
      cta: { ...CTA_REGISTRY.read_aws_setup, label: "Fix AWS connection" },
      reason: "AWS validation failed. Reopen the setup guide to verify your role + External ID.",
      secondary: CTA_REGISTRY.contact_support,
      severity: "critical",
    };
  }
  if (state.primaryLifecycle === "scan.failed") {
    return {
      cta: { ...CTA_REGISTRY.read_aws_setup, label: "Troubleshoot scan", href: "/docs/troubleshooting#scanning" },
      reason: "Last scan failed. See troubleshooting for likely causes.",
      severity: "critical",
    };
  }

  // 2. Pending approvals
  if (state.pendingApprovals > 0) {
    return {
      cta: { ...CTA_REGISTRY.open_command_center, label: `Review ${state.pendingApprovals} pending approval${state.pendingApprovals !== 1 ? "s" : ""}` },
      reason: `${state.pendingApprovals} execution plan${state.pendingApprovals !== 1 ? "s require" : " requires"} your approval before applying.`,
      severity: "warning",
    };
  }

  // 3. Plans ready to review
  if (state.readyPlans > 0 && state.pendingApprovals === 0) {
    return {
      cta: { ...CTA_REGISTRY.open_command_center, label: `Review ${state.readyPlans} execution plan${state.readyPlans !== 1 ? "s" : ""}` },
      reason: `Scan produced ${state.readyPlans} ready-to-review plan${state.readyPlans !== 1 ? "s" : ""}.`,
      severity: "info",
    };
  }

  // 4. Lifecycle in flight
  if (state.primaryLifecycle === "scan.running" || state.primaryLifecycle === "scan.started") {
    return {
      cta: CTA_REGISTRY.view_topology,
      reason: "A scan is running. Watch progress in the live topology while findings stream in.",
      severity: "info",
    };
  }

  // 5. Cloud not connected
  if (state.connectedClouds === 0) {
    return {
      cta: CTA_REGISTRY.start_with_aws,
      reason: "Connect AWS to start your first scan — read-only IAM role, under 5 minutes.",
      secondary: CTA_REGISTRY.read_aws_setup,
      severity: "info",
    };
  }

  // 6. ReleaseOps onboarding
  if (state.connectedClouds > 0 && !state.releaseopsConnected) {
    return {
      cta: CTA_REGISTRY.open_releaseops_cmd,
      reason: "Add ReleaseOps to surface deployment governance alongside cloud operations.",
      secondary: CTA_REGISTRY.read_releaseops_overview,
      severity: "info",
    };
  }

  // 7. ReleaseOps risk
  if (state.releaseopsServicesAtRisk > 0) {
    return {
      cta: CTA_REGISTRY.open_releaseops_cmd,
      reason: `${state.releaseopsServicesAtRisk} service${state.releaseopsServicesAtRisk !== 1 ? "s are" : " is"} below readiness threshold.`,
      severity: "warning",
    };
  }

  // 8. Desktop nudge
  if (!state.desktopAvailable && state.hasRunScan) {
    return {
      cta: CTA_REGISTRY.download_desktop,
      reason: "Install the desktop agent for local Terraform execution and native notifications.",
      secondary: CTA_REGISTRY.read_docs,
      severity: "info",
    };
  }

  // 9. Authenticated but no scan
  if (state.isAuthenticated && state.connectedClouds > 0 && !state.hasRunScan) {
    return {
      cta: { ...CTA_REGISTRY.start_with_aws, label: "Run first scan" },
      reason: "Account is connected. Trigger your first scan to see findings + recommendations.",
      severity: "info",
    };
  }

  // 10. Anonymous user (not signed up)
  if (!state.isAuthenticated) {
    return {
      cta: CTA_REGISTRY.start_with_aws,
      reason: "Start with a free AWS scan — no credit card required.",
      secondary: CTA_REGISTRY.read_docs,
      severity: "info",
    };
  }

  // Default — everything is operational
  return {
    cta: CTA_REGISTRY.open_command_center,
    reason: "Everything is operational. Open Command Center for live activity.",
    secondary: CTA_REGISTRY.view_topology,
    severity: "success",
  };
}

/**
 * Demo state useful for the marketing site where we don't have a logged-in user.
 * Always resolves to the anonymous start path.
 */
export const ANONYMOUS_STATE: UserOperationalState = {
  connectedClouds: 0,
  pendingApprovals: 0,
  readyPlans: 0,
  releaseopsConnected: false,
  releaseopsServicesAtRisk: 0,
  desktopAvailable: false,
  hasRunScan: false,
  isAuthenticated: false,
};
