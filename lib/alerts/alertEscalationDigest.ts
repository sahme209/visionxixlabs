/**
 * Phase 431 — AlertEscalation master digest.
 *
 * Composes:
 *   - Phase 428  buildOrgAlertSnapshot           (sorted + derived UI)
 *   - Phase 429  suggestAlertAction              (per-alert CTA)
 *   - Phase 429  describeAlertTransition         (humanized audit lines)
 *
 * Output is the exact shape the dashboard panel renders without any
 * further derivation — same contract as Phase 420 for connectors.
 */

import {
  buildOrgAlertSnapshot,
  type AlertSnapshot,
  type AlertSnapshotOptions,
  type AlertSnapshotRepo,
  type OrgAlertSnapshot,
} from "./alertEscalationSnapshot";
import {
  describeAlertTransition,
  suggestAlertAction,
  type AlertTransitionView,
  type SuggestedAlertAction,
} from "./alertEscalationOperatorCopy";
import type { AlertEscalationStatus } from "./alertEscalationSession";

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface AlertDigest {
  signalRef: string;
  status: AlertEscalationStatus;
  statusLabel: string;
  sidebarTone: AlertSnapshot["sidebarTone"];
  waitingForHuman: boolean;
  open: boolean;
  terminal: boolean;
  minutesSinceFirstFire: number | null;
  minutesUntilSnoozeExpires: number | null;
  acknowledgedByUserId: string | null;
  resolvedByUserId: string | null;
  /** Phase 429 — CTA + tone + description + optional hint. */
  suggested: SuggestedAlertAction;
  /** Humanized audit lines, newest-first. */
  timeline: AlertTimelineLine[];
}

export interface AlertTimelineLine {
  ageSeconds: number;
  text: string;
  isLegal: boolean;
}

export interface OrgAlertDigest {
  organizationId: string;
  generatedAt: Date;
  alerts: AlertDigest[];
  summary: OrgAlertSnapshot["summary"];
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildOrgAlertDigest(
  repo: AlertSnapshotRepo,
  organizationId: string,
  opts: AlertSnapshotOptions = {},
): Promise<OrgAlertDigest> {
  const snapshot = await buildOrgAlertSnapshot(repo, organizationId, opts);
  const alerts: AlertDigest[] = snapshot.alerts.map((a) => ({
    signalRef: a.signalRef,
    status: a.status,
    statusLabel: a.statusLabel,
    sidebarTone: a.sidebarTone,
    waitingForHuman: a.waitingForHuman,
    open: a.open,
    terminal: a.terminal,
    minutesSinceFirstFire: a.minutesSinceFirstFire,
    minutesUntilSnoozeExpires: a.minutesUntilSnoozeExpires,
    acknowledgedByUserId: a.acknowledgedByUserId,
    resolvedByUserId: a.resolvedByUserId,
    suggested: suggestAlertAction(a.status, a.minutesUntilSnoozeExpires),
    timeline: renderTimeline(a.recentTransitions),
  }));
  return {
    organizationId,
    generatedAt: snapshot.generatedAt,
    alerts,
    summary: snapshot.summary,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Internals.
   ────────────────────────────────────────────────────────────── */

function renderTimeline(transitions: AlertSnapshot["recentTransitions"]): AlertTimelineLine[] {
  return transitions.map((t) => {
    const view: AlertTransitionView = {
      fromStatus: t.fromStatus,
      toStatus: t.toStatus,
      eventKind: t.eventKind,
      isLegal: t.isLegal,
      actorLabel: t.actorLabel,
      actorUserId: t.actorUserId,
    };
    return {
      ageSeconds: t.ageSeconds,
      text: describeAlertTransition(view),
      isLegal: t.isLegal,
    };
  });
}
