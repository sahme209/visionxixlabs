/**
 * Phase 436 — pending-notification discovery.
 *
 * Sits between Phase 435 (per-transition notification builder) and an
 * actual dispatcher route. Given a "since" timestamp, walks recent
 * legal transitions across an org's alert sessions, runs the Phase 435
 * builder on each, and returns the deliverable plan in chronological
 * order so the on-call sees `signal_fired` BEFORE the operator's
 * `acknowledged` follow-up.
 *
 * Idempotency is the builder's responsibility — every entry carries
 * the Phase 435 idempotencyKey, so a dispatcher that's already pushed
 * a notification for a given key can skip the retry without losing the
 * audit-log record.
 *
 * Pure orchestration. No I/O beyond the repo reads we already have.
 */

import {
  buildAlertNotification,
  type AlertNotification,
  type NotificationChannel,
} from "./alertNotificationBuilder";
import type {
  AlertEscalationRepo,
  AlertEscalationSessionRow,
  AlertEscalationTransitionRow,
} from "./alertEscalationRepo";

/* ──────────────────────────────────────────────────────────────────
   Extended repo contract — adds findMany on sessions + a windowed
   findMany on transitions.
   ────────────────────────────────────────────────────────────── */

export interface PendingDispatchRepo extends AlertEscalationRepo {
  alertEscalationSession: AlertEscalationRepo["alertEscalationSession"] & {
    findMany(args: { where: { organizationId: string } }): Promise<AlertEscalationSessionRow[]>;
  };
  alertEscalationTransition: AlertEscalationRepo["alertEscalationTransition"] & {
    findMany(args:
      | { where: { sessionId: string }; orderBy: { createdAt: "desc" }; take: number }
      | { where: { sessionId: string; createdAt: { gte: Date } }; orderBy: { createdAt: "asc" } }
    ): Promise<AlertEscalationTransitionRow[]>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Output shape.
   ────────────────────────────────────────────────────────────── */

export interface PendingDispatchEntry {
  /** signalRef from the parent session — operator-readable alert id. */
  signalRef: string;
  /** Session row id — useful for the dispatcher's audit linkage. */
  sessionId: string;
  /** Transition row id — pairs with the notification's idempotencyKey. */
  transitionId: string;
  /** Wallclock the transition was persisted. Sort key. */
  occurredAt: Date;
  /** The Phase 435 payload, ready to dispatch. */
  notification: AlertNotification;
}

export interface PendingDispatchOptions {
  /** Lower bound for transition.createdAt. */
  sinceAt: Date;
  /**
   * Skip entries whose only channel is `audit_log`. Useful when the
   * caller is the external-dispatch loop (Slack/PagerDuty) and the
   * audit-log channel is written separately. Defaults to false.
   */
  externalOnly?: boolean;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildPendingAlertNotifications(
  repo: PendingDispatchRepo,
  organizationId: string,
  opts: PendingDispatchOptions,
): Promise<PendingDispatchEntry[]> {
  const sessions = await repo.alertEscalationSession.findMany({ where: { organizationId } });
  const collected: PendingDispatchEntry[] = [];

  for (const session of sessions) {
    const transitions = await repo.alertEscalationTransition.findMany({
      where: { sessionId: session.id, createdAt: { gte: opts.sinceAt } },
      orderBy: { createdAt: "asc" },
    });
    for (const t of transitions) {
      const notif = buildAlertNotification({
        signalRef: session.signalRef,
        transition: t,
      });
      if (!notif) continue;
      if (opts.externalOnly && !requiresExternalDispatch(notif)) continue;
      collected.push({
        signalRef: session.signalRef,
        sessionId: session.id,
        transitionId: t.id,
        occurredAt: t.createdAt,
        notification: notif,
      });
    }
  }

  // Org-wide chronological order — on-call sees fires before acks.
  collected.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  return collected;
}

/**
 * True iff the notification has at least one channel that needs
 * external dispatch (Slack, pager, etc.). audit_log entries are written
 * by the persistence layer itself, so a dispatcher loop responsible
 * only for push channels can skip them.
 */
export function requiresExternalDispatch(notification: AlertNotification): boolean {
  return notification.channels.some(isExternalChannel);
}

function isExternalChannel(channel: NotificationChannel): boolean {
  return channel === "team_chat" || channel === "oncall_pager";
}
