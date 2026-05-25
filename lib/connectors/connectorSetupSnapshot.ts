/**
 * Phase 415 — ConnectorSetupSnapshot view model.
 *
 * Reads the persisted state machine and renders it into the exact shape
 * a dashboard panel + sidebar dot need. Pure derivation on top of
 * connectorSetupRepo + the kernel — no I/O of its own beyond the repo
 * calls that fetch rows.
 *
 * Sort contract: the operator should see the connectors that NEED their
 * attention first. So:
 *   1. recoverable (failed / disconnected / revoked) — broken, must redo
 *   2. needs_attention                                — degraded, action helps
 *   3. in_flight (setup_started / waiting_for_provider / validating)
 *   4. connected                                     — quiet success
 *   5. not_connected                                 — never started
 * Within the same bucket, more-recent transitions sort first.
 */

import {
  isActive,
  isInFlight,
  isRecoverable,
  statusLabel,
  type ConnectorSetupStatus,
} from "./connectorSetupSession";
import type {
  ConnectorSetupRepo,
  ConnectorSetupSessionRow,
  ConnectorSetupTransitionRow,
} from "./connectorSetupRepo";

/* ──────────────────────────────────────────────────────────────────
   Extended repo contract — adds `findMany` so the snapshot service can
   load every session for an org in one query.
   ────────────────────────────────────────────────────────────── */

export interface SnapshotRepo extends ConnectorSetupRepo {
  connectorSetupSession: ConnectorSetupRepo["connectorSetupSession"] & {
    findMany(args: { where: { organizationId: string } }): Promise<ConnectorSetupSessionRow[]>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Snapshot shape — exactly what a dashboard panel renders.
   ────────────────────────────────────────────────────────────── */

export type SidebarDotColor = "green" | "amber" | "red" | "gray";

export interface ProviderSnapshot {
  provider: string;
  status: ConnectorSetupStatus;
  statusLabel: string;
  sidebarDotColor: SidebarDotColor;
  /** True iff the operator should look — covers failed/revoked/disconnected/needs_attention. */
  actionable: boolean;
  /** Last legal event kind, for "what just happened" copy. */
  lastEventKind: string | null;
  /** Last validation_failed errorCode — surfaced when status is `failed`. */
  lastErrorCode: string | null;
  /** Days since FIRST connected — used for "live for N days" pills. Null if never connected. */
  daysConnected: number | null;
  /** Minutes since last transition — drives "stuck waiting for AWS" copy. */
  minutesSinceTransition: number;
  /** Last 5 transitions, newest-first. */
  recentTransitions: SnapshotTransition[];
}

export interface SnapshotTransition {
  fromStatus: ConnectorSetupStatus;
  toStatus: ConnectorSetupStatus;
  eventKind: string;
  isLegal: boolean;
  actorLabel: string | null;
  actorUserId: string | null;
  ageSeconds: number;
}

export interface OrgSnapshot {
  organizationId: string;
  generatedAt: Date;
  providers: ProviderSnapshot[];
  summary: {
    total: number;
    connected: number;
    actionable: number;
    inFlight: number;
    notConnected: number;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export interface SnapshotOptions {
  /** Override "now" for deterministic test output. Defaults to Date.now(). */
  now?: Date;
  /** Number of recent transitions to inline per provider. Defaults to 5. */
  recentTransitionsLimit?: number;
}

export async function buildOrgSetupSnapshot(
  repo: SnapshotRepo,
  organizationId: string,
  opts: SnapshotOptions = {},
): Promise<OrgSnapshot> {
  const now = opts.now ?? new Date();
  const limit = opts.recentTransitionsLimit ?? 5;

  const sessions = await repo.connectorSetupSession.findMany({ where: { organizationId } });

  const providers = await Promise.all(sessions.map(async (s) => {
    const transitions = await repo.connectorSetupTransition.findMany({
      where: { sessionId: s.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return shapeProvider(s, transitions, now);
  }));

  providers.sort(compareByAttention);

  return {
    organizationId,
    generatedAt: now,
    providers,
    summary: summarize(providers),
  };
}

/* ──────────────────────────────────────────────────────────────────
   Pure helpers — exported for direct testing without a repo round-trip.
   ────────────────────────────────────────────────────────────── */

export function sidebarDotColorFor(status: ConnectorSetupStatus): SidebarDotColor {
  if (status === "connected") return "green";
  if (status === "needs_attention") return "amber";
  if (isRecoverable(status)) return "red";
  if (isInFlight(status)) return "amber";
  return "gray"; // not_connected
}

export function isActionable(status: ConnectorSetupStatus): boolean {
  // Active-but-degraded + every recoverable terminal state.
  return status === "needs_attention" || isRecoverable(status);
}

export function attentionRank(status: ConnectorSetupStatus): number {
  if (isRecoverable(status)) return 0;          // most urgent
  if (status === "needs_attention") return 1;
  if (isInFlight(status)) return 2;
  if (isActive(status)) return 3;                // connected
  return 4;                                       // not_connected
}

/* ──────────────────────────────────────────────────────────────────
   Internals.
   ────────────────────────────────────────────────────────────── */

function shapeProvider(
  s: ConnectorSetupSessionRow,
  transitions: ConnectorSetupTransitionRow[],
  now: Date,
): ProviderSnapshot {
  const minutesSinceTransition = Math.max(
    0,
    Math.floor((now.getTime() - s.lastTransitionAt.getTime()) / 60_000),
  );
  const daysConnected = s.firstConnectedAt === null
    ? null
    : Math.max(0, Math.floor((now.getTime() - s.firstConnectedAt.getTime()) / 86_400_000));

  return {
    provider: s.provider,
    status: s.status,
    statusLabel: statusLabel(s.status),
    sidebarDotColor: sidebarDotColorFor(s.status),
    actionable: isActionable(s.status),
    lastEventKind: s.lastEventKind,
    lastErrorCode: s.lastErrorCode,
    daysConnected,
    minutesSinceTransition,
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

function compareByAttention(a: ProviderSnapshot, b: ProviderSnapshot): number {
  const ra = attentionRank(a.status);
  const rb = attentionRank(b.status);
  if (ra !== rb) return ra - rb;
  // Tiebreaker: more-recently-transitioned first (lower minutesSinceTransition wins).
  return a.minutesSinceTransition - b.minutesSinceTransition;
}

function summarize(providers: ProviderSnapshot[]): OrgSnapshot["summary"] {
  let connected = 0, actionable = 0, inFlight = 0, notConnected = 0;
  for (const p of providers) {
    if (p.status === "connected") connected += 1;
    if (p.actionable) actionable += 1;
    if (isInFlight(p.status)) inFlight += 1;
    if (p.status === "not_connected") notConnected += 1;
  }
  return { total: providers.length, connected, actionable, inFlight, notConnected };
}
