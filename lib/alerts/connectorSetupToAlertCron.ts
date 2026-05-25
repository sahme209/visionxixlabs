/**
 * Phase 434 — connector setup → alert escalation cron orchestrator.
 *
 * This is the piece that makes the two state-machine verticals talk
 * to each other automatically. Walks every connector session for an
 * org, computes the Phase 418 sticky-error classification, asks the
 * Phase 426 bridge what kernel event each one should fire on its
 * alert session, and applies the resulting events via the Phase 427
 * repo. Returns a structured tally for cron logging.
 *
 * Without this orchestrator, the bridge composes nicely at the type
 * level but the alerts table only gets rows from explicit operator
 * clicks. WITH it, a sticky AccessDenied on AWS automatically becomes
 * a `signal_fired` event with the right signalRef, the dashboard's
 * "active alerts" pill ticks up, and the on-call escalation policy
 * inherits the existing kernel timeout logic.
 *
 * Pure orchestration over existing testable pieces — no new I/O.
 */

import {
  classifyTransitionHistory,
  type StickyErrorClassification,
  type TransitionForClassify,
} from "@/lib/connectors/connectorSetupStickyError";
import type {
  ConnectorSetupRepo,
  ConnectorSetupSessionRow,
} from "@/lib/connectors/connectorSetupRepo";
import { decideAlertEventFromStickyClassification } from "./alertEscalationBridge";
import {
  applyAlertEscalationEvent,
  type AlertEscalationRepo,
  type ApplyAlertEventResult,
} from "./alertEscalationRepo";

/* ──────────────────────────────────────────────────────────────────
   Extended connector repo contract — we need findMany on sessions.
   ────────────────────────────────────────────────────────────── */

export interface ConnectorListRepo extends ConnectorSetupRepo {
  connectorSetupSession: ConnectorSetupRepo["connectorSetupSession"] & {
    findMany(args: { where: { organizationId: string } }): Promise<ConnectorSetupSessionRow[]>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Result + summary shapes.
   ────────────────────────────────────────────────────────────── */

export type PerSessionOutcome =
  | { kind: "noop"; provider: string; classification: StickyErrorClassification["kind"]; reason: string }
  | { kind: "applied"; provider: string; classification: StickyErrorClassification["kind"]; result: ApplyAlertEventResult }
  | { kind: "errored"; provider: string; error: string };

export interface CronTickResult {
  organizationId: string;
  perSession: PerSessionOutcome[];
  summary: {
    inspected: number;
    fired: number;
    cleared: number;
    noop: number;
    errored: number;
  };
}

export interface CronTickOptions {
  /** Lookback window for the sticky-error classifier. Defaults to 24h. */
  stickyWindowHours?: number;
  /** Override now for tests. */
  now?: Date;
  /** Actor label written on emitted transitions. Defaults to "bridge:sticky-error". */
  actorLabel?: string;
  /** Transition history pull depth per connector — must be ≥ stickyThreshold. Defaults to 50. */
  transitionHistoryLimit?: number;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function tickConnectorSetupToAlertEscalation(
  connectorRepo: ConnectorListRepo,
  alertRepo: AlertEscalationRepo,
  organizationId: string,
  opts: CronTickOptions = {},
): Promise<CronTickResult> {
  const actorLabel = opts.actorLabel ?? "bridge:sticky-error";
  const historyLimit = opts.transitionHistoryLimit ?? 50;

  const sessions = await connectorRepo.connectorSetupSession.findMany({ where: { organizationId } });
  const perSession: PerSessionOutcome[] = [];

  for (const session of sessions) {
    try {
      const transitions = await connectorRepo.connectorSetupTransition.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: "desc" },
        take: historyLimit,
      });
      const classification = classifyTransitionHistory(
        transitions.map(toClassifyInput),
        { now: opts.now, windowHours: opts.stickyWindowHours },
      );
      const signalRef = signalRefFor(organizationId, session.provider);

      // Look up the current alert status; bridge needs it to decide
      // whether to emit signal_fired vs noop already_open.
      const existingAlert = await alertRepo.alertEscalationSession.findUnique({
        where: { organizationId_signalRef: { organizationId, signalRef } },
      });
      const currentAlertStatus = existingAlert?.status ?? "quiet";

      const decision = decideAlertEventFromStickyClassification(
        classification,
        currentAlertStatus,
        { signalRef },
      );

      if (decision.kind === "noop") {
        perSession.push({
          kind: "noop",
          provider: session.provider,
          classification: classification.kind,
          reason: decision.reason,
        });
        continue;
      }

      const result = await applyAlertEscalationEvent(alertRepo, {
        organizationId,
        signalRef,
        event: decision.event,
        actor: { systemLabel: actorLabel },
        ...(opts.now ? { now: opts.now } : {}),
      });
      perSession.push({
        kind: "applied",
        provider: session.provider,
        classification: classification.kind,
        result,
      });
    } catch (err) {
      perSession.push({
        kind: "errored",
        provider: session.provider,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    organizationId,
    perSession,
    summary: tally(perSession),
  };
}

/**
 * Canonical signalRef for a connector setup alert. Exported so callers
 * (cron handler, dashboard "click to view connector" link) can use the
 * same naming.
 */
export function signalRefFor(organizationId: string, provider: string): string {
  return `connector_setup:${provider}:${organizationId}`;
}

/* ──────────────────────────────────────────────────────────────────
   Internals.
   ────────────────────────────────────────────────────────────── */

function toClassifyInput(t: { toStatus: TransitionForClassify["toStatus"]; eventKind: string; isLegal: boolean; eventPayload: Record<string, unknown> | null; createdAt: Date }): TransitionForClassify {
  return {
    toStatus: t.toStatus,
    eventKind: t.eventKind,
    isLegal: t.isLegal,
    eventPayload: t.eventPayload,
    createdAt: t.createdAt,
  };
}

function tally(perSession: ReadonlyArray<PerSessionOutcome>): CronTickResult["summary"] {
  let fired = 0, cleared = 0, noop = 0, errored = 0;
  for (const o of perSession) {
    if (o.kind === "noop") noop += 1;
    if (o.kind === "errored") errored += 1;
    if (o.kind === "applied") {
      if (o.result.ok) {
        if (o.result.nextStatus === "fired") fired += 1;
        if (o.result.nextStatus === "auto_resolved") cleared += 1;
      }
    }
  }
  return { inspected: perSession.length, fired, cleared, noop, errored };
}
