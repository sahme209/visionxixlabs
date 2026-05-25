/**
 * Phase 424 — UI-driven event emission.
 *
 * The dashboard CTAs (Connect / Re-validate / Disconnect / Reconnect)
 * post here. This module owns:
 *
 *   1. The closed union of event kinds an operator-driven UI is allowed
 *      to emit. The kernel accepts a broader set (validation_succeeded,
 *      health_check_*, provider_revoked_credentials) but those come
 *      from server-side actors, NOT operator clicks — letting a button
 *      forge "validation_succeeded" would let the UI lie to the kernel.
 *
 *   2. A best-effort wrapper around applyConnectorSetupEvent that
 *      swallows the Postgres "relation does not exist" error so the
 *      dashboard works pre-migration. Other errors propagate.
 */

import { applyConnectorSetupEvent, type ApplyEventResult, type ConnectorSetupRepo } from "./connectorSetupRepo";
import type { ConnectorSetupEvent } from "./connectorSetupSession";
import { isMissingTable } from "./setupDigestResponder";

/* ──────────────────────────────────────────────────────────────────
   The closed union of operator-allowed event kinds.

   An attacker controlling the dashboard request CANNOT make the
   kernel jump to `connected` — only legitimate server-side validation
   can do that. The most an operator can do is:
     - operator_started        ("Connect" / "Reconnect")
     - operator_disconnected   ("Disconnect")
     - provider_link_opened    (recorded when the UI launches the CFN
                                tab — separate event so timeline shows it)
     - bounce_back_received    (recorded when the operator returns and
                                hands the role ARN back to the validator;
                                the actual validation event is server-side)
   ────────────────────────────────────────────────────────────── */

export const OPERATOR_ALLOWED_EVENT_KINDS = [
  "operator_started",
  "provider_link_opened",
  "bounce_back_received",
  "operator_disconnected",
] as const;

export type OperatorAllowedEventKind = (typeof OPERATOR_ALLOWED_EVENT_KINDS)[number];

export function isOperatorAllowedEventKind(s: string): s is OperatorAllowedEventKind {
  return (OPERATOR_ALLOWED_EVENT_KINDS as readonly string[]).includes(s);
}

/* ──────────────────────────────────────────────────────────────────
   Provider whitelist — keeps unknown strings out of the DB.
   ────────────────────────────────────────────────────────────── */

export const ALLOWED_PROVIDERS = ["aws", "azure", "gcp"] as const;
export type AllowedProvider = (typeof ALLOWED_PROVIDERS)[number];

export function isAllowedProvider(s: string): s is AllowedProvider {
  return (ALLOWED_PROVIDERS as readonly string[]).includes(s);
}

/* ──────────────────────────────────────────────────────────────────
   Best-effort wrapper.
   ────────────────────────────────────────────────────────────── */

export type RecordEventOutcome =
  | { kind: "applied"; result: ApplyEventResult }
  | { kind: "migration_pending" }
  | { kind: "validation_failed"; reason: ValidationReason };

export type ValidationReason =
  | "unknown_provider"
  | "unknown_event_kind"
  | "event_kind_not_operator_allowed";

export interface RecordEventInput {
  organizationId: string;
  provider: string;
  eventKind: string;
  actorUserId: string;
}

export async function recordConnectorSetupEvent(
  repo: ConnectorSetupRepo,
  input: RecordEventInput,
): Promise<RecordEventOutcome> {
  if (!isAllowedProvider(input.provider)) {
    return { kind: "validation_failed", reason: "unknown_provider" };
  }
  if (!isOperatorAllowedEventKind(input.eventKind)) {
    // Could be a malformed string OR a legitimate kernel event that's
    // off-limits for operator UIs. Either way, refuse.
    return {
      kind: "validation_failed",
      reason: looksLikeKernelEvent(input.eventKind)
        ? "event_kind_not_operator_allowed"
        : "unknown_event_kind",
    };
  }

  const event = toKernelEvent(input.eventKind);
  try {
    const result = await applyConnectorSetupEvent(repo, {
      organizationId: input.organizationId,
      provider: input.provider,
      event,
      actor: { userId: input.actorUserId },
    });
    return { kind: "applied", result };
  } catch (err) {
    if (isMissingTable(err)) {
      return { kind: "migration_pending" };
    }
    throw err;
  }
}

/* ──────────────────────────────────────────────────────────────────
   Internals.
   ────────────────────────────────────────────────────────────── */

const KERNEL_EVENT_KINDS = [
  "operator_started",
  "provider_link_opened",
  "bounce_back_received",
  "validation_succeeded",
  "validation_failed",
  "operator_disconnected",
  "provider_revoked_credentials",
  "health_check_regressed",
  "health_check_recovered",
];

function looksLikeKernelEvent(s: string): boolean {
  return KERNEL_EVENT_KINDS.includes(s);
}

function toKernelEvent(kind: OperatorAllowedEventKind): ConnectorSetupEvent {
  // All operator-allowed events are payload-less. validation_failed,
  // which carries an errorCode, is server-only by design.
  return { kind } as ConnectorSetupEvent;
}
