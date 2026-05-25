/**
 * Phase 413 — ConnectorSetupSession state machine (kernel).
 *
 * Pure-function module that defines the 9 legal statuses a connector
 * setup can be in, the closed-union event vocabulary that drives
 * transitions, and a single transition function that's exhaustive
 * over the cross product. Phase 414+ wires this kernel to a real
 * Prisma row + persisted audit trail.
 *
 * Why a state machine: the connector onboarding chased "the broker
 * needs sts:AssumeRole" through ten different surface texts because
 * nothing tracked which step had actually happened. With a closed
 * status + audited transition log, every customer-facing card can
 * read the same canonical state and ask the right next question.
 *
 * No I/O, no SDK imports. Tests in
 * lib/connectors/__tests__/connectorSetupSession.test.ts pin every
 * legal + illegal transition.
 */

/* ──────────────────────────────────────────────────────────────────
   The 9 statuses the spec called out.
   ────────────────────────────────────────────────────────────── */
export type ConnectorSetupStatus =
  | "not_connected"        // nothing started yet
  | "setup_started"        // operator clicked Connect on the hub
  | "waiting_for_provider" // CFN deployed / Cloud Shell opened — awaiting customer
  | "validating"           // bounce-back received, real provider call in flight
  | "connected"            // validation succeeded; connector live
  | "failed"               // validation rejected the credentials
  | "disconnected"         // operator pressed Disconnect
  | "revoked"              // provider-side credentials were invalidated
  | "needs_attention";     // periodic health check found access regressed

export const ALL_STATUSES: ReadonlyArray<ConnectorSetupStatus> = [
  "not_connected",
  "setup_started",
  "waiting_for_provider",
  "validating",
  "connected",
  "failed",
  "disconnected",
  "revoked",
  "needs_attention",
];

/* ──────────────────────────────────────────────────────────────────
   The closed-union event vocabulary that drives a transition.
   Every legal lifecycle move corresponds to exactly one event kind.
   ────────────────────────────────────────────────────────────── */
export type ConnectorSetupEvent =
  | { kind: "operator_started" }
  | { kind: "provider_link_opened" }   // customer clicked Open AWS Console / Open Cloud Shell
  | { kind: "bounce_back_received" }   // customer returned with role ARN / SP creds
  | { kind: "validation_succeeded" }
  | { kind: "validation_failed"; errorCode: string }
  | { kind: "operator_disconnected" }
  | { kind: "provider_revoked_credentials" }
  | { kind: "health_check_regressed" }
  | { kind: "health_check_recovered" };

/* ──────────────────────────────────────────────────────────────────
   Transition function — exhaustive over (status × event) with
   explicit illegal returns. Never throws; callers can render the
   "illegal transition" path in audit logs.
   ────────────────────────────────────────────────────────────── */

export type TransitionResult =
  | { ok: true;  next: ConnectorSetupStatus }
  | { ok: false; reason: "illegal_transition"; from: ConnectorSetupStatus; eventKind: string };

export function transitionConnectorSetup(
  current: ConnectorSetupStatus,
  event: ConnectorSetupEvent,
): TransitionResult {
  const reject = (): TransitionResult => ({
    ok: false, reason: "illegal_transition", from: current, eventKind: event.kind,
  });

  switch (event.kind) {
    case "operator_started":
      // Can start fresh from not_connected, or restart after a failure /
      // explicit disconnect / revoke.
      if (current === "not_connected" || current === "failed" || current === "disconnected" || current === "revoked") {
        return { ok: true, next: "setup_started" };
      }
      return reject();

    case "provider_link_opened":
      // Customer clicked through to the cloud provider — only valid right
      // after setup_started.
      if (current === "setup_started") return { ok: true, next: "waiting_for_provider" };
      return reject();

    case "bounce_back_received":
      // Customer returned from the provider with credentials/role.
      if (current === "waiting_for_provider") return { ok: true, next: "validating" };
      return reject();

    case "validation_succeeded":
      if (current === "validating") return { ok: true, next: "connected" };
      return reject();

    case "validation_failed":
      // Validation can fail from `validating` (bounce-back rejected) or
      // during a `health_check_regressed` re-validation that confirms
      // the regression is real.
      if (current === "validating" || current === "needs_attention") {
        return { ok: true, next: "failed" };
      }
      return reject();

    case "operator_disconnected":
      // Operator-driven disconnect can fire from any "active" state.
      if (current === "connected" || current === "needs_attention" || current === "failed") {
        return { ok: true, next: "disconnected" };
      }
      return reject();

    case "provider_revoked_credentials":
      // The cloud provider tore down our access (key rotated, SP deleted,
      // CFN stack removed, etc.). Only meaningful from active states.
      if (current === "connected" || current === "needs_attention") {
        return { ok: true, next: "revoked" };
      }
      return reject();

    case "health_check_regressed":
      // Daily cron found AssumeRole / GetCallerIdentity no longer works.
      if (current === "connected") return { ok: true, next: "needs_attention" };
      return reject();

    case "health_check_recovered":
      // Cron sees it working again — e.g. the operator fixed their IAM.
      if (current === "needs_attention") return { ok: true, next: "connected" };
      return reject();
  }
}

/* ──────────────────────────────────────────────────────────────────
   Helpers — small, dependency-free, useful in route handlers + UI.
   ────────────────────────────────────────────────────────────── */

/**
 * Statuses that mean "the connector is doing useful work right now."
 * Used by the dashboard sidebar dot, the cron health-check loop, etc.
 */
export function isActive(s: ConnectorSetupStatus): boolean {
  return s === "connected" || s === "needs_attention";
}

/**
 * Statuses that mean "the customer should be steered back to retry."
 * Drives the 'Start a fresh deployment' button visibility.
 */
export function isRecoverable(s: ConnectorSetupStatus): boolean {
  return s === "failed" || s === "disconnected" || s === "revoked";
}

/**
 * Statuses that mean "the customer is mid-flow — show a calm progress
 * indicator, not an error card."
 */
export function isInFlight(s: ConnectorSetupStatus): boolean {
  return s === "setup_started" || s === "waiting_for_provider" || s === "validating";
}

/**
 * Plain-English label for surfaces that need to render the status.
 * Customer-facing, no internal jargon.
 */
export function statusLabel(s: ConnectorSetupStatus): string {
  switch (s) {
    case "not_connected":        return "Not connected";
    case "setup_started":        return "Setup started";
    case "waiting_for_provider": return "Waiting on AWS / Azure / GCP";
    case "validating":           return "Validating credentials";
    case "connected":            return "Connected";
    case "failed":               return "Couldn't connect";
    case "disconnected":         return "Disconnected";
    case "revoked":              return "Access revoked";
    case "needs_attention":      return "Needs attention";
  }
}
