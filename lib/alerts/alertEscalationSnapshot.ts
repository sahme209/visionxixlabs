/**
 * Phase 428 — AlertEscalationSnapshot view model.
 *
 * Sibling to Phase 415. Reads persisted alert sessions + the last N
 * transitions per session and produces a UI-ready snapshot.
 *
 * Attention sort: alerts the operator MUST look at first.
 *   1. waiting_for_human   (fired / escalated)
 *   2. acknowledged        (still open, someone owns it)
 *   3. snoozed             (will re-fire — keep visible)
 *   4. terminal in last hour (recently resolved — show as "cleared")
 *   5. quiet
 * Within bucket, more-recent first.
 */

import {
  alertStatusLabel,
  isOpen,
  isTerminal,
  isWaitingForHuman,
  type AlertEscalationStatus,
} from "./alertEscalationSession";
import type {
  AlertEscalationRepo,
  AlertEscalationSessionRow,
  AlertEscalationTransitionRow,
} from "./alertEscalationRepo";

/* ──────────────────────────────────────────────────────────────────
   Extended repo contract — adds findMany for sessions.
   ────────────────────────────────────────────────────────────── */

export interface AlertSnapshotRepo extends AlertEscalationRepo {
  alertEscalationSession: AlertEscalationRepo["alertEscalationSession"] & {
    findMany(args: { where: { organizationId: string } }): Promise<AlertEscalationSessionRow[]>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Output shape.
   ────────────────────────────────────────────────────────────── */

export type AlertSidebarTone = "red" | "amber" | "blue" | "emerald" | "zinc";

export interface AlertSnapshot {
  signalRef: string;
  status: AlertEscalationStatus;
  statusLabel: string;
  sidebarTone: AlertSidebarTone;
  /** True iff operator must act (fired/escalated). */
  waitingForHuman: boolean;
  /** Open in any sense — fired, escalated, acknowledged, or snoozed. */
  open: boolean;
  /** Terminal — resolved, auto_resolved, or expired. */
  terminal: boolean;
  /** Minutes since first fire. Null if never fired. */
  minutesSinceFirstFire: number | null;
  /** Minutes until snooze auto-expires. Null when not snoozed or past. */
  minutesUntilSnoozeExpires: number | null;
  acknowledgedByUserId: string | null;
  resolvedByUserId: string | null;
  recentTransitions: AlertSnapshotTransition[];
}

export interface AlertSnapshotTransition {
  fromStatus: AlertEscalationStatus;
  toStatus: AlertEscalationStatus;
  eventKind: string;
  isLegal: boolean;
  actorLabel: string | null;
  actorUserId: string | null;
  ageSeconds: number;
}

export interface OrgAlertSnapshot {
  organizationId: string;
  generatedAt: Date;
  alerts: AlertSnapshot[];
  summary: {
    total: number;
    waitingForHuman: number;
    open: number;
    terminal: number;
    quiet: number;
  };
}

export interface AlertSnapshotOptions {
  now?: Date;
  recentTransitionsLimit?: number;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildOrgAlertSnapshot(
  repo: AlertSnapshotRepo,
  organizationId: string,
  opts: AlertSnapshotOptions = {},
): Promise<OrgAlertSnapshot> {
  const now = opts.now ?? new Date();
  const limit = opts.recentTransitionsLimit ?? 5;

  const sessions = await repo.alertEscalationSession.findMany({ where: { organizationId } });

  const alerts = await Promise.all(sessions.map(async (s) => {
    const transitions = await repo.alertEscalationTransition.findMany({
      where: { sessionId: s.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return shapeAlert(s, transitions, now);
  }));

  alerts.sort(compareByAttention);

  return {
    organizationId,
    generatedAt: now,
    alerts,
    summary: summarize(alerts),
  };
}

/* ──────────────────────────────────────────────────────────────────
   Pure helpers — exported for direct testing.
   ────────────────────────────────────────────────────────────── */

export function sidebarToneFor(status: AlertEscalationStatus): AlertSidebarTone {
  if (status === "fired" || status === "escalated") return "red";
  if (status === "acknowledged" || status === "snoozed") return "amber";
  if (status === "resolved" || status === "auto_resolved") return "emerald";
  if (status === "expired") return "blue";
  return "zinc"; // quiet
}

export function attentionRank(status: AlertEscalationStatus): number {
  if (isWaitingForHuman(status)) return 0;
  if (status === "acknowledged") return 1;
  if (status === "snoozed") return 2;
  if (isTerminal(status)) return 3;
  return 4; // quiet
}

/* ──────────────────────────────────────────────────────────────────
   Internals.
   ────────────────────────────────────────────────────────────── */

function shapeAlert(
  s: AlertEscalationSessionRow,
  transitions: AlertEscalationTransitionRow[],
  now: Date,
): AlertSnapshot {
  const minutesSinceFirstFire = s.firstFiredAt
    ? Math.max(0, Math.floor((now.getTime() - s.firstFiredAt.getTime()) / 60_000))
    : null;
  const minutesUntilSnoozeExpires = s.snoozedUntilAt && s.snoozedUntilAt > now
    ? Math.max(0, Math.ceil((s.snoozedUntilAt.getTime() - now.getTime()) / 60_000))
    : null;

  return {
    signalRef: s.signalRef,
    status: s.status,
    statusLabel: alertStatusLabel(s.status),
    sidebarTone: sidebarToneFor(s.status),
    waitingForHuman: isWaitingForHuman(s.status),
    open: isOpen(s.status),
    terminal: isTerminal(s.status),
    minutesSinceFirstFire,
    minutesUntilSnoozeExpires,
    acknowledgedByUserId: s.acknowledgedByUserId,
    resolvedByUserId: s.resolvedByUserId,
    recentTransitions: transitions.map((t) => ({
      fromStatus: t.fromStatus,
      toStatus: t.toStatus,
      eventKind: t.eventKind,
      isLegal: t.isLegal,
      actorLabel: t.actorLabel,
      actorUserId: t.actorUserId,
      ageSeconds: Math.max(0, Math.floor((now.getTime() - t.createdAt.getTime()) / 1000)),
    })),
  };
}

function compareByAttention(a: AlertSnapshot, b: AlertSnapshot): number {
  const ra = attentionRank(a.status);
  const rb = attentionRank(b.status);
  if (ra !== rb) return ra - rb;
  // Within the same bucket, more-recent first.
  const ageA = a.recentTransitions[0]?.ageSeconds ?? Infinity;
  const ageB = b.recentTransitions[0]?.ageSeconds ?? Infinity;
  return ageA - ageB;
}

function summarize(alerts: AlertSnapshot[]): OrgAlertSnapshot["summary"] {
  let waitingForHuman = 0, open = 0, terminal = 0, quiet = 0;
  for (const a of alerts) {
    if (a.waitingForHuman) waitingForHuman += 1;
    if (a.open) open += 1;
    if (a.terminal) terminal += 1;
    if (a.status === "quiet") quiet += 1;
  }
  return { total: alerts.length, waitingForHuman, open, terminal, quiet };
}
