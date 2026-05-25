/**
 * Phase 416 — Health-check probe → kernel event decider.
 *
 * Sits between the cron loop (which only knows "did the probe succeed,
 * fail with auth error, or just transient-fail?") and the kernel
 * (which only accepts a closed-union event vocabulary).
 *
 * Why this exists: you COULD just always emit `health_check_recovered`
 * after a successful probe and let the kernel reject illegal
 * transitions. But that floods ConnectorSetupTransition with
 * isLegal:false rows for every successful probe of an already-connected
 * connector — noise that breaks the "every audit row matters" contract.
 *
 * The decider produces a meaningful event ONLY when one would actually
 * change state, and returns `{ kind: "noop", reason }` otherwise. The
 * cron loop can short-circuit on noop, keeping the audit table honest.
 *
 * Pure function, no I/O.
 */

import type { ConnectorSetupEvent, ConnectorSetupStatus } from "./connectorSetupSession";

/**
 * What the cloud-side probe found. Granular enough to distinguish
 * "credentials revoked" (terminal, kernel goes to `revoked`) from
 * "auth_failed during health check" (kernel goes to `needs_attention`).
 *
 * - success:            GetCallerIdentity / equivalent returned 200
 * - auth_failed:        AccessDenied / 401 / 403 — likely IAM regression
 * - revoked:            credentials returned 401 "InvalidClientTokenId"
 *                       or equivalent permanent-rejection signal
 * - transient_error:    network blip, rate limit, 5xx — kernel should
 *                       NOT down-grade state on this; cron retries later
 */
export type ProbeOutcome = "success" | "auth_failed" | "revoked" | "transient_error";

export type HealthCheckDecision =
  | { kind: "emit"; event: ConnectorSetupEvent }
  | { kind: "noop"; reason: NoopReason };

export type NoopReason =
  | "no_session_yet"             // status=not_connected — no point regressing or recovering
  | "still_in_flight"            // mid-onboarding — health probe is meaningless until validating completes
  | "already_in_target_state"    // probe matches current status — no transition needed
  | "transient_error_ignored"    // network / rate-limit blip
  | "no_kernel_event_for_combo"; // legitimately nothing to do

/**
 * Decide which kernel event (if any) a probe outcome should produce for
 * a session in `currentStatus`.
 */
export function decideHealthCheckEvent(
  currentStatus: ConnectorSetupStatus,
  probeOutcome: ProbeOutcome,
): HealthCheckDecision {
  // Sessions that never reached an active state are out of scope for
  // health checks. The cron loop should skip these entirely, but if it
  // doesn't, we no-op rather than confuse the kernel.
  if (currentStatus === "not_connected") {
    return { kind: "noop", reason: "no_session_yet" };
  }
  if (currentStatus === "setup_started" || currentStatus === "waiting_for_provider" || currentStatus === "validating") {
    return { kind: "noop", reason: "still_in_flight" };
  }

  // Transient errors are deliberately silent. The cron will retry later.
  if (probeOutcome === "transient_error") {
    return { kind: "noop", reason: "transient_error_ignored" };
  }

  switch (probeOutcome) {
    case "success": {
      // Connected stays connected. Recovering from needs_attention is the
      // only meaningful "success" event. Recovering from failed /
      // disconnected / revoked requires an operator re-run, NOT a health
      // probe — the kernel rejects that path on purpose.
      if (currentStatus === "needs_attention") {
        return { kind: "emit", event: { kind: "health_check_recovered" } };
      }
      return { kind: "noop", reason: "already_in_target_state" };
    }

    case "auth_failed": {
      // Connected → needs_attention. From needs_attention, a sustained
      // auth failure means the regression is REAL — promote to `failed`.
      // From the recoverable buckets (failed/disconnected/revoked) the
      // kernel has nothing useful to do — operator action required.
      if (currentStatus === "connected") {
        return { kind: "emit", event: { kind: "health_check_regressed" } };
      }
      if (currentStatus === "needs_attention") {
        return { kind: "emit", event: { kind: "validation_failed", errorCode: "HealthCheckAuthFailed" } };
      }
      return { kind: "noop", reason: "no_kernel_event_for_combo" };
    }

    case "revoked": {
      // Provider explicitly invalidated us. Only meaningful from active states.
      if (currentStatus === "connected" || currentStatus === "needs_attention") {
        return { kind: "emit", event: { kind: "provider_revoked_credentials" } };
      }
      return { kind: "noop", reason: "no_kernel_event_for_combo" };
    }
  }
}
