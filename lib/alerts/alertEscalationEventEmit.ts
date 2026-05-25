/**
 * Phase 433 — UI-driven event emission for AlertEscalation.
 *
 * The dashboard CTAs (Acknowledge / Snooze / Resolve) post here.
 * Mirrors Phase 424 for connectors:
 *
 *   1. Closed union of UI-allowed event kinds. The kernel accepts more
 *      events than operators are allowed to forge (signal_fired,
 *      signal_cleared, escalation_triggered, snooze_expired,
 *      alert_expired are all server/cron-driven, NOT operator clicks).
 *   2. Best-effort wrapper that swallows the missing-table error so
 *      the dashboard works pre-migration.
 */

import { applyAlertEscalationEvent, type ApplyAlertEventResult, type AlertEscalationRepo } from "./alertEscalationRepo";
import type { AlertEscalationEvent } from "./alertEscalationSession";
import { isMissingTable } from "@/lib/connectors/setupDigestResponder";

/* ──────────────────────────────────────────────────────────────────
   Closed union of operator-driven event kinds.
   ────────────────────────────────────────────────────────────── */

export const OPERATOR_ALLOWED_ALERT_EVENT_KINDS = [
  "operator_acknowledged",
  "operator_snoozed",
  "operator_resolved",
] as const;

export type OperatorAllowedAlertEventKind =
  (typeof OPERATOR_ALLOWED_ALERT_EVENT_KINDS)[number];

export function isOperatorAllowedAlertEventKind(s: string): s is OperatorAllowedAlertEventKind {
  return (OPERATOR_ALLOWED_ALERT_EVENT_KINDS as readonly string[]).includes(s);
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export type RecordAlertEventOutcome =
  | { kind: "applied"; result: ApplyAlertEventResult }
  | { kind: "migration_pending" }
  | { kind: "validation_failed"; reason: AlertValidationReason };

export type AlertValidationReason =
  | "unknown_event_kind"
  | "event_kind_not_operator_allowed"
  | "missing_signal_ref"
  | "snooze_minutes_out_of_range";

export interface RecordAlertEventInput {
  organizationId: string;
  signalRef: string;
  eventKind: string;
  actorUserId: string;
  /** Required when eventKind = operator_snoozed. Validated [1, 1440]. */
  snoozeMinutes?: number;
}

export async function recordAlertEscalationEvent(
  repo: AlertEscalationRepo,
  input: RecordAlertEventInput,
): Promise<RecordAlertEventOutcome> {
  if (!input.signalRef) {
    return { kind: "validation_failed", reason: "missing_signal_ref" };
  }
  if (!isOperatorAllowedAlertEventKind(input.eventKind)) {
    return {
      kind: "validation_failed",
      reason: looksLikeKernelEvent(input.eventKind)
        ? "event_kind_not_operator_allowed"
        : "unknown_event_kind",
    };
  }
  if (input.eventKind === "operator_snoozed") {
    const minutes = input.snoozeMinutes;
    if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
      return { kind: "validation_failed", reason: "snooze_minutes_out_of_range" };
    }
  }

  const event = toKernelEvent(input);
  try {
    const result = await applyAlertEscalationEvent(repo, {
      organizationId: input.organizationId,
      signalRef: input.signalRef,
      event,
      actor: { userId: input.actorUserId },
    });
    return { kind: "applied", result };
  } catch (err) {
    if (isMissingTable(err)) return { kind: "migration_pending" };
    throw err;
  }
}

/* ──────────────────────────────────────────────────────────────────
   Internals.
   ────────────────────────────────────────────────────────────── */

const KERNEL_EVENT_KINDS = [
  "signal_fired", "signal_cleared", "escalation_triggered",
  "operator_acknowledged", "operator_snoozed", "snooze_expired",
  "operator_resolved", "alert_expired",
];

function looksLikeKernelEvent(s: string): boolean {
  return KERNEL_EVENT_KINDS.includes(s);
}

function toKernelEvent(input: RecordAlertEventInput): AlertEscalationEvent {
  switch (input.eventKind as OperatorAllowedAlertEventKind) {
    case "operator_acknowledged":
      return { kind: "operator_acknowledged", operatorUserId: input.actorUserId };
    case "operator_snoozed":
      return { kind: "operator_snoozed", operatorUserId: input.actorUserId, snoozeMinutes: input.snoozeMinutes! };
    case "operator_resolved":
      return { kind: "operator_resolved", operatorUserId: input.actorUserId };
  }
}
