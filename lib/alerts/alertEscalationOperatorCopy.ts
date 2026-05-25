/**
 * Phase 429 — operator-facing copy for AlertEscalationSession.
 *
 * Sibling to Phase 417. Pure functions that translate kernel state
 * + recent transitions into customer-visible text:
 *
 *   suggestAlertAction(status, minutesUntilSnoozeExpires?)
 *     → { ctaLabel, tone, description, hint? }
 *
 *   describeAlertTransition(t)
 *     → one-line humanized audit row
 *
 * Customer-facing — no SDK names, no internal kernel jargon.
 */

import { alertStatusLabel, type AlertEscalationStatus } from "./alertEscalationSession";

/* ──────────────────────────────────────────────────────────────────
   suggestAlertAction — what should the operator do right now?
   ────────────────────────────────────────────────────────────── */

export type AlertActionTone = "primary" | "secondary" | "danger" | "none";

export interface SuggestedAlertAction {
  ctaLabel: string;
  tone: AlertActionTone;
  description: string;
  hint?: string;
}

export function suggestAlertAction(
  status: AlertEscalationStatus,
  minutesUntilSnoozeExpires?: number | null,
): SuggestedAlertAction {
  switch (status) {
    case "quiet":
      return {
        ctaLabel: "",
        tone: "none",
        description: "No active alerts on this signal.",
      };

    case "fired":
      return {
        ctaLabel: "Acknowledge",
        tone: "primary",
        description: "Alert is firing and unacknowledged. Acknowledge to silence the page rotation while you investigate.",
      };

    case "escalated":
      return {
        ctaLabel: "Acknowledge",
        tone: "danger",
        description: "Escalation policy fired — on-call has been paged. Acknowledge to confirm a human is on it.",
      };

    case "acknowledged":
      return {
        ctaLabel: "Resolve",
        tone: "primary",
        description: "You acknowledged this alert. Mark resolved once the underlying issue is fixed.",
      };

    case "snoozed": {
      const remaining = typeof minutesUntilSnoozeExpires === "number" && minutesUntilSnoozeExpires > 0
        ? minutesUntilSnoozeExpires
        : null;
      return {
        ctaLabel: "Resolve",
        tone: "secondary",
        description: "Snoozed — alert will re-fire if the underlying signal is still firing when the snooze ends.",
        hint: remaining !== null
          ? `Snooze ends in ${remaining} minute${remaining === 1 ? "" : "s"}.`
          : "Snooze window has elapsed; the next health check will determine whether to re-fire.",
      };
    }

    case "resolved":
      return {
        ctaLabel: "",
        tone: "none",
        description: "Resolved by an operator. No further action needed.",
      };

    case "auto_resolved":
      return {
        ctaLabel: "",
        tone: "none",
        description: "Underlying signal cleared on its own before anyone needed to act.",
      };

    case "expired":
      return {
        ctaLabel: "",
        tone: "none",
        description: "Alert timed out without acknowledgement. Review your escalation policy if this shouldn't have happened.",
        hint: "This alert reached the long-timeout threshold without being acknowledged.",
      };
  }
}

/* ──────────────────────────────────────────────────────────────────
   describeAlertTransition — one-line audit row.
   ────────────────────────────────────────────────────────────── */

export interface AlertTransitionView {
  fromStatus: AlertEscalationStatus;
  toStatus: AlertEscalationStatus;
  eventKind: string;
  isLegal: boolean;
  actorLabel: string | null;
  actorUserId: string | null;
}

export function describeAlertTransition(t: AlertTransitionView): string {
  if (!t.isLegal) {
    return `Ignored ${humanizeEventKind(t.eventKind)} — alert was already ${alertStatusLabel(t.fromStatus).toLowerCase()}.`;
  }
  const actor = describeAlertActor(t);
  const verb = legalAlertVerb(t.eventKind);
  return `${actor} ${verb} — now ${alertStatusLabel(t.toStatus).toLowerCase()}.`;
}

/* ──────────────────────────────────────────────────────────────────
   Internals.
   ────────────────────────────────────────────────────────────── */

function describeAlertActor(t: AlertTransitionView): string {
  if (t.actorUserId) return "Operator";
  if (t.actorLabel) {
    if (t.actorLabel.startsWith("bridge")) return "Sticky-error bridge";
    if (t.actorLabel.startsWith("escalation")) return "Escalation policy";
    if (t.actorLabel.startsWith("snooze")) return "Snooze timer";
    if (t.actorLabel.startsWith("cron")) return "Health check";
    return capitalize(t.actorLabel);
  }
  return "System";
}

function legalAlertVerb(eventKind: string): string {
  switch (eventKind) {
    case "signal_fired":          return "fired the alert";
    case "signal_cleared":        return "saw the signal clear";
    case "escalation_triggered":  return "escalated to on-call";
    case "operator_acknowledged": return "acknowledged";
    case "operator_snoozed":      return "snoozed the alert";
    case "snooze_expired":        return "ended the snooze window";
    case "operator_resolved":     return "marked resolved";
    case "alert_expired":         return "expired without acknowledgement";
    default:                      return humanizeEventKind(eventKind);
  }
}

function humanizeEventKind(eventKind: string): string {
  return eventKind.replace(/_/g, " ");
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s[0].toUpperCase() + s.slice(1);
}
