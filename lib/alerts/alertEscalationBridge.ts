/**
 * Phase 426 — bridge from sticky-error classification → AlertEscalation event.
 *
 * The Phase 418 classifier already knows whether a connector is in a
 * healthy / transient / sticky / oscillating state. The Phase 426
 * kernel already knows the legal moves for an alert. This module is
 * the thin glue that decides:
 *
 *   "given that the classifier just produced {kind}, and given the
 *    current alert status for this signal, what event (if any) should
 *    fire on the alert escalation?"
 *
 * Without this bridge, a cron tick would either:
 *   - blindly emit signal_fired on every sticky_error (which the kernel
 *     would reject when an alert is already open, creating audit noise), or
 *   - never escalate, defeating the purpose of Phase 418.
 *
 * Pure function, no I/O. Cross-checked against the kernel in tests so
 * no emitted event can be illegal.
 */

import type { AlertEscalationEvent, AlertEscalationStatus } from "./alertEscalationSession";
import { isOpen } from "./alertEscalationSession";
import type { StickyErrorClassification } from "@/lib/connectors/connectorSetupStickyError";

/* ──────────────────────────────────────────────────────────────────
   Decision shape.
   ────────────────────────────────────────────────────────────── */

export type BridgeDecision =
  | { kind: "emit"; event: AlertEscalationEvent }
  | { kind: "noop"; reason: BridgeNoopReason };

export type BridgeNoopReason =
  | "classification_is_healthy"        // nothing to alert on
  | "classification_is_transient"      // below escalation bar
  | "already_open"                     // sticky/oscillation still firing into an open alert
  | "no_signal_to_clear";              // healthy classification but no alert was open anyway

export interface BridgeOptions {
  /**
   * The stable identifier for this signal (e.g. `connector_setup:aws:org_42`).
   * Stamped on the emitted signal_fired event so a re-fire after auto_resolve
   * is correlatable to the original.
   */
  signalRef: string;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export function decideAlertEventFromStickyClassification(
  classification: StickyErrorClassification,
  currentAlertStatus: AlertEscalationStatus,
  opts: BridgeOptions,
): BridgeDecision {
  const isClassificationEscalateWorthy =
    classification.kind === "sticky_error" || classification.kind === "chronic_oscillation";

  if (classification.kind === "healthy") {
    // Healthy + an alert is open → tell the kernel the signal cleared.
    // Healthy + nothing open → noop, common case.
    if (isOpen(currentAlertStatus)) {
      return { kind: "emit", event: { kind: "signal_cleared" } };
    }
    return { kind: "noop", reason: "no_signal_to_clear" };
  }

  if (classification.kind === "transient_failure") {
    // Transient failures don't escalate — that's the whole point of
    // Phase 418's classifier. If an alert is already open we leave it
    // open (operator might still be looking).
    return { kind: "noop", reason: "classification_is_transient" };
  }

  // sticky_error or chronic_oscillation.
  if (isClassificationEscalateWorthy) {
    if (isOpen(currentAlertStatus)) {
      // Don't re-fire — the signal_fired event is rejected from open
      // statuses on purpose. The operator already has a notification.
      return { kind: "noop", reason: "already_open" };
    }
    // quiet / resolved / auto_resolved / expired — fire fresh.
    return { kind: "emit", event: { kind: "signal_fired", signalRef: opts.signalRef } };
  }

  // Defensive fallthrough — shouldn't reach here with current classifier
  // union, but the kernel's `noop` path keeps callers safe.
  return { kind: "noop", reason: "classification_is_healthy" };
}
