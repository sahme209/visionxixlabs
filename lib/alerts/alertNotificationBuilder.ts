/**
 * Phase 435 — alert notification payload builder.
 *
 * Pure function: given an AlertEscalation transition + the resulting
 * session status, decide what notification (if any) to send, with
 * what severity, to which channels.
 *
 * Severity ladder:
 *   critical  — on-call must be paged (escalation_triggered, alert_expired)
 *   high      — humans should see this within minutes (signal_fired)
 *   info      — confirms human action (operator_acknowledged, operator_resolved)
 *   low       — quiet update (auto_resolved, snoozed, snooze_expired)
 *
 * Channel routing:
 *   critical → on-call pager + team channel + audit log
 *   high     → team channel + audit log
 *   info     → audit log (no push)
 *   low      → audit log (no push)
 *
 * Idempotency: each notification carries a stable key derived from
 * sessionId + transition.id + eventKind, so a retry of the same
 * transition can never page the on-call twice.
 *
 * No I/O. Tests pin every (eventKind, isLegal, resulting status) combo.
 */

import type { AlertEscalationStatus } from "./alertEscalationSession";

/* ──────────────────────────────────────────────────────────────────
   Output shape.
   ────────────────────────────────────────────────────────────── */

export type NotificationSeverity = "critical" | "high" | "info" | "low";

export type NotificationChannel =
  | "oncall_pager"
  | "team_chat"
  | "audit_log";

export interface AlertNotification {
  severity: NotificationSeverity;
  subject: string;
  body: string;
  channels: NotificationChannel[];
  idempotencyKey: string;
}

/* ──────────────────────────────────────────────────────────────────
   Input shape — minimal projection of what the builder needs.
   ────────────────────────────────────────────────────────────── */

export interface NotificationInput {
  /** The persisted transition the alert just made. */
  transition: {
    id: string;
    sessionId: string;
    fromStatus: AlertEscalationStatus;
    toStatus: AlertEscalationStatus;
    eventKind: string;
    isLegal: boolean;
    actorUserId: string | null;
    actorLabel: string | null;
  };
  /** Application-level identifier the alert was opened on. */
  signalRef: string;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

/**
 * Compute the notification (if any) for a single transition. Returns
 * null when the transition shouldn't notify at all — illegal
 * transitions, sub-info events that already cover the audit log.
 */
export function buildAlertNotification(input: NotificationInput): AlertNotification | null {
  if (!input.transition.isLegal) {
    // Illegal transitions are debugging signal only; they shouldn't page anyone.
    return null;
  }

  const sev = severityForEvent(input.transition.eventKind);
  if (sev === null) return null;

  const channels = channelsForSeverity(sev);
  const subject = subjectFor(input);
  const body = bodyFor(input, sev);
  const idempotencyKey = computeIdempotencyKey(input);

  return { severity: sev, subject, body, channels, idempotencyKey };
}

/* ──────────────────────────────────────────────────────────────────
   Pure helpers — exported for direct testing.
   ────────────────────────────────────────────────────────────── */

export function severityForEvent(eventKind: string): NotificationSeverity | null {
  switch (eventKind) {
    case "signal_fired":          return "high";
    case "escalation_triggered":  return "critical";
    case "alert_expired":         return "critical";
    case "operator_acknowledged": return "info";
    case "operator_resolved":     return "info";
    case "signal_cleared":        return "low";
    case "operator_snoozed":      return "low";
    case "snooze_expired":        return "high"; // re-firing
    default:                      return null;   // unknown event kind — be conservative
  }
}

export function channelsForSeverity(sev: NotificationSeverity): NotificationChannel[] {
  switch (sev) {
    case "critical": return ["oncall_pager", "team_chat", "audit_log"];
    case "high":     return ["team_chat", "audit_log"];
    case "info":     return ["audit_log"];
    case "low":      return ["audit_log"];
  }
}

/* ──────────────────────────────────────────────────────────────────
   Internals.
   ────────────────────────────────────────────────────────────── */

function subjectFor(input: NotificationInput): string {
  const verb = verbFor(input.transition.eventKind);
  // Keep subject short — these become pager titles and Slack message
  // headers. Operator-facing copy, no SDK names.
  return `${input.signalRef}: ${verb}`;
}

function bodyFor(input: NotificationInput, sev: NotificationSeverity): string {
  const actor = describeActor(input.transition);
  const verb = verbFor(input.transition.eventKind);
  const sevTag = sev.toUpperCase();
  return `[${sevTag}] ${input.signalRef} — ${actor} ${verb}. (transition ${input.transition.id})`;
}

function verbFor(eventKind: string): string {
  switch (eventKind) {
    case "signal_fired":          return "alert fired";
    case "signal_cleared":        return "signal cleared on its own";
    case "escalation_triggered":  return "escalated to on-call";
    case "operator_acknowledged": return "acknowledged the alert";
    case "operator_snoozed":      return "snoozed the alert";
    case "snooze_expired":        return "alert re-fired after snooze";
    case "operator_resolved":     return "marked the alert resolved";
    case "alert_expired":         return "alert expired without acknowledgement";
    default:                      return eventKind.replace(/_/g, " ");
  }
}

function describeActor(t: NotificationInput["transition"]): string {
  if (t.actorUserId) return "Operator";
  if (t.actorLabel) {
    if (t.actorLabel.startsWith("bridge")) return "Sticky-error bridge";
    if (t.actorLabel.startsWith("escalation")) return "Escalation policy";
    if (t.actorLabel.startsWith("snooze")) return "Snooze timer";
    if (t.actorLabel.startsWith("cron")) return "Cron";
    return t.actorLabel;
  }
  return "System";
}

/**
 * Stable idempotency key. Same input → same key → dispatcher dedupes
 * across retries. Derived ONLY from immutable fields of the transition.
 */
function computeIdempotencyKey(input: NotificationInput): string {
  return `alert-notification:${input.transition.sessionId}:${input.transition.id}:${input.transition.eventKind}`;
}
