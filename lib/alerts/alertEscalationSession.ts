/**
 * Phase 426 — AlertEscalationSession kernel.
 *
 * The second state machine in the "closed-union event vocabulary"
 * family, sibling to ConnectorSetupSession (Phase 413).
 *
 * Models the life of one alert from the moment a signal fires through
 * acknowledgement / snooze / resolution. Drives:
 *
 *   - When the on-call rotation gets paged (escalation_triggered after
 *     N minutes without acknowledged).
 *   - Whether a sticky_error from Phase 418 should escalate now or
 *     suppress (operator already acknowledged → don't re-page).
 *   - The "active alerts" badge on the dashboard sidebar.
 *
 * Pure-function kernel. No I/O, no SDK imports. Persistence + bulk
 * orchestration land in later phases following the Phase 414-419 recipe.
 */

/* ──────────────────────────────────────────────────────────────────
   The 8 statuses an alert escalation can be in.
   ────────────────────────────────────────────────────────────── */

export type AlertEscalationStatus =
  | "quiet"           // no active alert
  | "fired"           // signal just fired, first notification sent
  | "escalated"       // escalation timeout elapsed → on-call paged
  | "acknowledged"    // a human said "I see it" but hasn't resolved
  | "snoozed"         // temporarily silenced by a human
  | "resolved"        // human declared the issue resolved
  | "auto_resolved"   // underlying signal cleared on its own
  | "expired";        // alert timed out without acknowledgement (no human reached)

export const ALL_ALERT_STATUSES: ReadonlyArray<AlertEscalationStatus> = [
  "quiet",
  "fired",
  "escalated",
  "acknowledged",
  "snoozed",
  "resolved",
  "auto_resolved",
  "expired",
];

/* ──────────────────────────────────────────────────────────────────
   The closed-union event vocabulary that drives a transition.
   Each legal lifecycle move corresponds to exactly one event kind.
   ────────────────────────────────────────────────────────────── */

export type AlertEscalationEvent =
  | { kind: "signal_fired"; signalRef: string }          // observer detected something (sticky_error, oscillation, sla_breach…)
  | { kind: "signal_cleared" }                            // observer says the underlying signal is gone
  | { kind: "escalation_triggered" }                      // escalation policy timer fired
  | { kind: "operator_acknowledged"; operatorUserId: string }
  | { kind: "operator_snoozed"; operatorUserId: string; snoozeMinutes: number }
  | { kind: "snooze_expired" }                            // snooze timer expired → re-fire
  | { kind: "operator_resolved"; operatorUserId: string }
  | { kind: "alert_expired" };                            // long timeout without ack

/* ──────────────────────────────────────────────────────────────────
   Transition function — exhaustive over (status × event) with explicit
   illegal returns. Never throws.
   ────────────────────────────────────────────────────────────── */

export type AlertTransitionResult =
  | { ok: true;  next: AlertEscalationStatus }
  | { ok: false; reason: "illegal_transition"; from: AlertEscalationStatus; eventKind: string };

export function transitionAlertEscalation(
  current: AlertEscalationStatus,
  event: AlertEscalationEvent,
): AlertTransitionResult {
  const reject = (): AlertTransitionResult => ({
    ok: false, reason: "illegal_transition", from: current, eventKind: event.kind,
  });

  switch (event.kind) {
    case "signal_fired":
      // A fresh fire from `quiet` (the common case) or a re-fire after
      // an auto_resolved / resolved / expired (the same upstream alert
      // condition coming back). Snoozed → fired is handled via
      // snooze_expired, not signal_fired (the snooze didn't expire on
      // its own — a manual signal_fired would silently bypass the
      // operator's choice to snooze).
      if (current === "quiet" || current === "auto_resolved" || current === "resolved" || current === "expired") {
        return { ok: true, next: "fired" };
      }
      return reject();

    case "signal_cleared":
      // The underlying problem went away on its own. Only meaningful
      // when an alert is actively open. Acknowledged + snoozed also
      // auto-resolve — that's a "you were watching but it fixed
      // itself" outcome, which IS important to distinguish from a
      // human-driven `operator_resolved`.
      if (current === "fired" || current === "escalated" || current === "acknowledged" || current === "snoozed") {
        return { ok: true, next: "auto_resolved" };
      }
      return reject();

    case "escalation_triggered":
      // Only valid from `fired` — the escalation policy is the timer
      // that runs WHILE the alert is fired but unacknowledged. From
      // escalated we don't re-escalate; from acknowledged we already
      // have a human on it.
      if (current === "fired") return { ok: true, next: "escalated" };
      return reject();

    case "operator_acknowledged":
      // A human said "I see it". Valid from fired or escalated.
      if (current === "fired" || current === "escalated") {
        return { ok: true, next: "acknowledged" };
      }
      return reject();

    case "operator_snoozed":
      // Manual silence. Valid from fired / escalated / acknowledged.
      // From acknowledged it expresses "I see it and I'm choosing not
      // to look again for N minutes" — slightly different semantics
      // than fired→snoozed (silence before ack) but the same status.
      if (current === "fired" || current === "escalated" || current === "acknowledged") {
        return { ok: true, next: "snoozed" };
      }
      return reject();

    case "snooze_expired":
      // The snooze timer ran out. Re-fire as if signal_fired.
      if (current === "snoozed") return { ok: true, next: "fired" };
      return reject();

    case "operator_resolved":
      // A human declared the issue resolved. Valid from any "open"
      // status — including snoozed (operator looked again and decided
      // it's done) and even auto_resolved (operator confirms the
      // observer's auto-resolution was correct, important for audit).
      if (current === "fired" || current === "escalated" || current === "acknowledged" || current === "snoozed" || current === "auto_resolved") {
        return { ok: true, next: "resolved" };
      }
      return reject();

    case "alert_expired":
      // The unacknowledged-alert long timeout fired. From fired or
      // escalated — both represent "no one ever ack'd this". From
      // acknowledged it would be the wrong event; that case uses
      // operator_resolved or alert_expired-via-snooze-flow.
      if (current === "fired" || current === "escalated") {
        return { ok: true, next: "expired" };
      }
      return reject();
  }
}

/* ──────────────────────────────────────────────────────────────────
   UI-driving predicates — small, dependency-free.
   ────────────────────────────────────────────────────────────── */

/** Alerts the UI must show in the active list. */
export function isOpen(s: AlertEscalationStatus): boolean {
  return s === "fired" || s === "escalated" || s === "acknowledged" || s === "snoozed";
}

/** Alerts waiting on a human to act — drives "needs your attention" pulse. */
export function isWaitingForHuman(s: AlertEscalationStatus): boolean {
  return s === "fired" || s === "escalated";
}

/** Alerts in a closed state — drives the "in the last X hours, N alerts cleared" tally. */
export function isTerminal(s: AlertEscalationStatus): boolean {
  return s === "resolved" || s === "auto_resolved" || s === "expired";
}

/** Plain-English label for surfaces that need to render the status. */
export function alertStatusLabel(s: AlertEscalationStatus): string {
  switch (s) {
    case "quiet":         return "Quiet";
    case "fired":         return "Firing";
    case "escalated":     return "Escalated — on-call paged";
    case "acknowledged":  return "Acknowledged";
    case "snoozed":       return "Snoozed";
    case "resolved":      return "Resolved";
    case "auto_resolved": return "Auto-resolved";
    case "expired":       return "Expired — never acknowledged";
  }
}
