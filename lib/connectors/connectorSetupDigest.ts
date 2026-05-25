/**
 * Phase 420 — master digest for the ConnectorSetup state machine.
 *
 * Composes:
 *   - Phase 415  ConnectorSetupSnapshot     (sorted providers + derived UI)
 *   - Phase 417  suggestNextAction          (per-provider CTA)
 *   - Phase 417  describeTransition         (humanized audit lines)
 *   - Phase 418  classifyTransitionHistory  (sticky/oscillation flag)
 *
 * Output is the exact shape a dashboard panel renders. The panel does
 * zero derivation — every label, every CTA, every sticky-error pill
 * is computed here, so the React side is purely presentational.
 *
 * Pure orchestration, no I/O beyond the repo round-trips that Phase 415
 * already performs.
 */

import {
  buildOrgSetupSnapshot,
  type OrgSnapshot,
  type ProviderSnapshot,
  type SnapshotRepo,
  type SnapshotOptions,
  type SnapshotTransition,
} from "./connectorSetupSnapshot";
import {
  suggestNextAction,
  describeTransition,
  type SuggestedAction,
  type TransitionView,
} from "./connectorSetupOperatorCopy";
import {
  classifyTransitionHistory,
  type StickyErrorClassification,
  type TransitionForClassify,
} from "./connectorSetupStickyError";
import type { ConnectorSetupStatus } from "./connectorSetupSession";
import type { ConnectorSetupTransitionRow } from "./connectorSetupRepo";

/* ──────────────────────────────────────────────────────────────────
   Output shapes.
   ────────────────────────────────────────────────────────────── */

export interface ProviderDigest {
  provider: string;
  status: ConnectorSetupStatus;
  statusLabel: string;
  sidebarDotColor: ProviderSnapshot["sidebarDotColor"];
  actionable: boolean;
  daysConnected: number | null;
  minutesSinceTransition: number;

  /** Phase 417 — CTA + description + optional hint. */
  suggested: SuggestedAction;

  /** Phase 418 — escalate signal. */
  errorClass: StickyErrorClassification;

  /** Up to N recent transitions, each rendered as a one-line audit row. */
  timeline: TimelineLine[];
}

export interface TimelineLine {
  ageSeconds: number;
  text: string;
  isLegal: boolean;
}

export interface OrgDigest {
  organizationId: string;
  generatedAt: Date;
  providers: ProviderDigest[];
  summary: OrgSnapshot["summary"] & {
    stickyErrorCount: number;
    chronicOscillationCount: number;
  };
}

export interface DigestOptions extends SnapshotOptions {
  /** Lookback hours for sticky-error classifier. Defaults to 24. */
  stickyWindowHours?: number;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildOrgSetupDigest(
  repo: SnapshotRepo,
  organizationId: string,
  opts: DigestOptions = {},
): Promise<OrgDigest> {
  const snapshot = await buildOrgSetupSnapshot(repo, organizationId, opts);

  // For the sticky-error classifier we need the FULL transition history
  // in the window — `recentTransitionsLimit` from the snapshot caps at
  // 5 by default which is too small to detect 3+ streaks reliably.
  // Pull a wider slice per provider here.
  const providers: ProviderDigest[] = await Promise.all(snapshot.providers.map(async (p) => {
    const sessionRow = await repo.connectorSetupSession.findUnique({
      where: { organizationId_provider: { organizationId, provider: p.provider } },
    });
    const transitions: ConnectorSetupTransitionRow[] = sessionRow
      ? await repo.connectorSetupTransition.findMany({
          where: { sessionId: sessionRow.id },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [];

    const errorClass = classifyTransitionHistory(
      transitions.map(toClassifyInput),
      { now: opts.now, windowHours: opts.stickyWindowHours },
    );

    return {
      provider: p.provider,
      status: p.status,
      statusLabel: p.statusLabel,
      sidebarDotColor: p.sidebarDotColor,
      actionable: p.actionable,
      daysConnected: p.daysConnected,
      minutesSinceTransition: p.minutesSinceTransition,
      suggested: suggestNextAction(p.status, p.lastErrorCode),
      errorClass,
      timeline: renderTimeline(p.recentTransitions),
    };
  }));

  let stickyErrorCount = 0, chronicOscillationCount = 0;
  for (const p of providers) {
    if (p.errorClass.kind === "sticky_error")        stickyErrorCount += 1;
    if (p.errorClass.kind === "chronic_oscillation") chronicOscillationCount += 1;
  }

  return {
    organizationId,
    generatedAt: snapshot.generatedAt,
    providers,
    summary: { ...snapshot.summary, stickyErrorCount, chronicOscillationCount },
  };
}

/* ──────────────────────────────────────────────────────────────────
   Internals.
   ────────────────────────────────────────────────────────────── */

function toClassifyInput(t: ConnectorSetupTransitionRow): TransitionForClassify {
  return {
    toStatus: t.toStatus,
    eventKind: t.eventKind,
    isLegal: t.isLegal,
    eventPayload: t.eventPayload,
    createdAt: t.createdAt,
  };
}

function renderTimeline(snapshotTransitions: ReadonlyArray<SnapshotTransition>): TimelineLine[] {
  return snapshotTransitions.map((t) => {
    const view: TransitionView = {
      fromStatus: t.fromStatus,
      toStatus: t.toStatus,
      eventKind: t.eventKind,
      isLegal: t.isLegal,
      actorLabel: t.actorLabel,
      actorUserId: t.actorUserId,
    };
    return {
      ageSeconds: t.ageSeconds,
      text: describeTransition(view),
      isLegal: t.isLegal,
    };
  });
}
