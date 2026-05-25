/**
 * Phase 427 — AlertEscalationSession persistence.
 *
 * Sibling to lib/connectors/connectorSetupRepo.ts (Phase 414). Wraps
 * the Phase 426 kernel with Prisma reads/writes, audits every
 * transition attempt, and applies an additive set of "interaction
 * timestamps" so the dashboard can render "open for 12 minutes",
 * "acknowledged by Sam 4 minutes ago", "snoozed for 13 more minutes".
 *
 * Dependency-injected Prisma client — same testability pattern Phase
 * 414 uses (broken jws/gaxios + iCloud node_modules make a real client
 * a non-starter in the test env).
 */

import {
  ALL_ALERT_STATUSES,
  transitionAlertEscalation,
  type AlertEscalationEvent,
  type AlertEscalationStatus,
} from "./alertEscalationSession";

/* ──────────────────────────────────────────────────────────────────
   Row types — narrow projection of the Prisma model.
   ────────────────────────────────────────────────────────────── */

export interface AlertEscalationSessionRow {
  id: string;
  organizationId: string;
  signalRef: string;
  status: AlertEscalationStatus;
  lastEventKind: string | null;
  firstFiredAt: Date | null;
  acknowledgedAt: Date | null;
  acknowledgedByUserId: string | null;
  snoozedUntilAt: Date | null;
  resolvedAt: Date | null;
  resolvedByUserId: string | null;
  lastTransitionAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertEscalationTransitionRow {
  id: string;
  sessionId: string;
  fromStatus: AlertEscalationStatus;
  toStatus: AlertEscalationStatus;
  eventKind: string;
  isLegal: boolean;
  rejectionReason: string | null;
  eventPayload: Record<string, unknown> | null;
  actorUserId: string | null;
  actorLabel: string | null;
  createdAt: Date;
}

/* ──────────────────────────────────────────────────────────────────
   Structural repo contract.
   ────────────────────────────────────────────────────────────── */

interface SessionDelegate {
  findUnique(args: { where: { organizationId_signalRef: { organizationId: string; signalRef: string } } }): Promise<AlertEscalationSessionRow | null>;
  create(args: { data: { organizationId: string; signalRef: string } }): Promise<AlertEscalationSessionRow>;
  update(args: {
    where: { id: string };
    data: Partial<Omit<AlertEscalationSessionRow, "id" | "organizationId" | "signalRef" | "createdAt" | "updatedAt">>;
  }): Promise<AlertEscalationSessionRow>;
}

interface TransitionDelegate {
  create(args: { data: Omit<AlertEscalationTransitionRow, "id" | "createdAt"> }): Promise<AlertEscalationTransitionRow>;
  findMany(args: { where: { sessionId: string }; orderBy: { createdAt: "desc" }; take: number }): Promise<AlertEscalationTransitionRow[]>;
}

export interface AlertEscalationRepo {
  alertEscalationSession: SessionDelegate;
  alertEscalationTransition: TransitionDelegate;
  $transaction<T>(fn: (tx: AlertEscalationRepo) => Promise<T>): Promise<T>;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export interface ApplyAlertEventInput {
  organizationId: string;
  signalRef: string;
  event: AlertEscalationEvent;
  actor: { userId: string } | { systemLabel: string };
  /** Override the wallclock used for the additive timestamps. Tests only. */
  now?: Date;
}

export type ApplyAlertEventResult =
  | {
      ok: true;
      session: AlertEscalationSessionRow;
      transition: AlertEscalationTransitionRow;
      previousStatus: AlertEscalationStatus;
      nextStatus: AlertEscalationStatus;
    }
  | {
      ok: false;
      reason: "illegal_transition";
      session: AlertEscalationSessionRow;
      transition: AlertEscalationTransitionRow;
      from: AlertEscalationStatus;
      eventKind: string;
    };

export async function applyAlertEscalationEvent(
  repo: AlertEscalationRepo,
  input: ApplyAlertEventInput,
): Promise<ApplyAlertEventResult> {
  return repo.$transaction(async (tx) => {
    const existing = await tx.alertEscalationSession.findUnique({
      where: { organizationId_signalRef: { organizationId: input.organizationId, signalRef: input.signalRef } },
    });
    const session = existing ?? await tx.alertEscalationSession.create({
      data: { organizationId: input.organizationId, signalRef: input.signalRef },
    });

    const result = transitionAlertEscalation(session.status, input.event);
    const eventPayload = extractEventPayload(input.event);
    const actorUserId = "userId" in input.actor ? input.actor.userId : null;
    const actorLabel = "systemLabel" in input.actor ? input.actor.systemLabel : null;

    if (!result.ok) {
      const transition = await tx.alertEscalationTransition.create({
        data: {
          sessionId: session.id,
          fromStatus: session.status,
          toStatus: session.status,
          eventKind: input.event.kind,
          isLegal: false,
          rejectionReason: result.reason,
          eventPayload,
          actorUserId,
          actorLabel,
        },
      });
      return {
        ok: false as const,
        reason: "illegal_transition" as const,
        session,
        transition,
        from: session.status,
        eventKind: input.event.kind,
      };
    }

    const now = input.now ?? new Date();
    const additive = computeAdditiveTimestamps(session, input.event, result.next, now);

    const updated = await tx.alertEscalationSession.update({
      where: { id: session.id },
      data: {
        status: result.next,
        lastEventKind: input.event.kind,
        lastTransitionAt: now,
        ...additive,
      },
    });

    const transition = await tx.alertEscalationTransition.create({
      data: {
        sessionId: session.id,
        fromStatus: session.status,
        toStatus: result.next,
        eventKind: input.event.kind,
        isLegal: true,
        rejectionReason: null,
        eventPayload,
        actorUserId,
        actorLabel,
      },
    });

    return {
      ok: true as const,
      session: updated,
      transition,
      previousStatus: session.status,
      nextStatus: result.next,
    };
  });
}

export async function readAlertEscalationSession(
  repo: AlertEscalationRepo,
  args: { organizationId: string; signalRef: string },
): Promise<AlertEscalationSessionRow | null> {
  return repo.alertEscalationSession.findUnique({
    where: { organizationId_signalRef: { organizationId: args.organizationId, signalRef: args.signalRef } },
  });
}

export async function listRecentAlertTransitions(
  repo: AlertEscalationRepo,
  args: { sessionId: string; take?: number },
): Promise<AlertEscalationTransitionRow[]> {
  return repo.alertEscalationTransition.findMany({
    where: { sessionId: args.sessionId },
    orderBy: { createdAt: "desc" },
    take: args.take ?? 25,
  });
}

export function isKnownAlertStatus(s: string): s is AlertEscalationStatus {
  return (ALL_ALERT_STATUSES as readonly string[]).includes(s);
}

/* ──────────────────────────────────────────────────────────────────
   Internals.
   ────────────────────────────────────────────────────────────── */

function extractEventPayload(event: AlertEscalationEvent): Record<string, unknown> | null {
  switch (event.kind) {
    case "signal_fired":          return { signalRef: event.signalRef };
    case "operator_snoozed":      return { operatorUserId: event.operatorUserId, snoozeMinutes: event.snoozeMinutes };
    case "operator_acknowledged": return { operatorUserId: event.operatorUserId };
    case "operator_resolved":     return { operatorUserId: event.operatorUserId };
    default:                      return null;
  }
}

/**
 * Compute the "additive" fields update — the operator-interaction
 * timestamps that DON'T get reset on a status change. firstFiredAt is
 * set once, then preserved across the whole lifecycle (including after
 * resolve + re-fire — that's a fresh "first fire" only if the prior
 * resolve already cleared it; here we KEEP it so the dashboard can
 * show "first fired 3 days ago" even after re-fires).
 *
 * Note: returns Partial — every key omitted means "leave as-is."
 */
function computeAdditiveTimestamps(
  prev: AlertEscalationSessionRow,
  event: AlertEscalationEvent,
  next: AlertEscalationStatus,
  now: Date,
): Partial<Omit<AlertEscalationSessionRow, "id" | "organizationId" | "signalRef" | "status" | "lastEventKind" | "lastTransitionAt" | "createdAt" | "updatedAt">> {
  const out: ReturnType<typeof computeAdditiveTimestamps> = {};

  // First-fire stamp — set once on the very first time we enter `fired`.
  if (next === "fired" && prev.firstFiredAt === null) {
    out.firstFiredAt = now;
  }

  if (event.kind === "operator_acknowledged") {
    out.acknowledgedAt = now;
    out.acknowledgedByUserId = event.operatorUserId;
  }

  if (event.kind === "operator_snoozed") {
    out.snoozedUntilAt = new Date(now.getTime() + event.snoozeMinutes * 60_000);
  }

  // Snooze ended → clear the until-stamp so dashboard stops counting down.
  if (event.kind === "snooze_expired" || (next !== "snoozed" && prev.snoozedUntilAt !== null)) {
    out.snoozedUntilAt = null;
  }

  if (event.kind === "operator_resolved") {
    out.resolvedAt = now;
    out.resolvedByUserId = event.operatorUserId;
  }

  return out;
}
