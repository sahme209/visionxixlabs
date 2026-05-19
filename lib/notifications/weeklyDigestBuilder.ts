/**
 * Weekly autonomy digest builder.
 *
 * Reads the last 7 days of:
 *   • AutonomyDecisionRationale (Phase 110)
 *   • StagedRemediationRunbook  (Phase 101)
 *   • OutboundNotificationRecord (Phase 99)
 *
 * Folds them into a single typed digest. The cron route sends this
 * as one Slack/Teams summary every Monday — gives operators a
 * weekly view without forcing them to open the dashboard.
 *
 * Hard rules:
 *   - Read-only. Never mutates a row.
 *   - Tenant-scoped: cross-tenant rows excluded.
 *   - Best-effort: a DB failure yields an empty-but-honest digest.
 */

import "server-only";

import { prisma } from "@/lib/db";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const TOP_N = 5;

export interface WeeklyDigest {
  organizationId: string;
  windowStart: string;
  windowEnd: string;
  decisions: {
    total: number;
    perOutcome: Record<string, number>;
    /** Top boundary classes by frequency. */
    topBoundaryClasses: { boundaryClass: string; count: number }[];
    /** Most-frequent halt reasons. */
    topHaltReasons: { reason: string; count: number }[];
  };
  runbooks: {
    staged: number;
    approved: number;
    rejected: number;
    expired: number;
    /** Top eventNames driving runbooks. */
    topEventNames: { eventName: string; count: number }[];
  };
  notifications: {
    total: number;
    perOutcome: Record<string, number>;
    perKind: Record<string, number>;
  };
  /** Operator-readable headline (one sentence). */
  headline: string;
  /** Operator-readable Slack/Teams body in mrkdwn. */
  body: string;
}

export async function buildWeeklyDigest(organizationId: string): Promise<WeeklyDigest> {
  const end = new Date();
  const start = new Date(end.getTime() - WEEK_MS);

  // Decisions
  const decisionRows = await safe(() =>
    prisma.autonomyDecisionRationale.findMany({
      where: { organizationId, createdAt: { gte: start, lte: end } },
      select: { outcome: true, boundaryClass: true, haltReason: true, haltedAtStage: true },
      take: 5000,
    }),
  );
  const perOutcome: Record<string, number> = {};
  const boundaryCounts = new Map<string, number>();
  const haltCounts = new Map<string, number>();
  for (const r of decisionRows) {
    perOutcome[r.outcome] = (perOutcome[r.outcome] ?? 0) + 1;
    boundaryCounts.set(r.boundaryClass, (boundaryCounts.get(r.boundaryClass) ?? 0) + 1);
    if (r.haltReason || r.haltedAtStage) {
      const k = (r.haltReason ?? r.haltedAtStage ?? "unknown").slice(0, 80);
      haltCounts.set(k, (haltCounts.get(k) ?? 0) + 1);
    }
  }

  // Runbooks
  const runbookRows = await safe(() =>
    prisma.stagedRemediationRunbook.findMany({
      where: { organizationId, stagedAt: { gte: start, lte: end } },
      select: { status: true, eventName: true },
      take: 5000,
    }),
  );
  let staged = 0;
  let approved = 0;
  let rejected = 0;
  let expired = 0;
  const eventCounts = new Map<string, number>();
  for (const r of runbookRows) {
    if (r.status === "staged") staged++;
    else if (r.status === "approved") approved++;
    else if (r.status === "rejected") rejected++;
    else if (r.status === "expired") expired++;
    eventCounts.set(r.eventName, (eventCounts.get(r.eventName) ?? 0) + 1);
  }

  // Notifications
  const notifRows = await safe(() =>
    prisma.outboundNotificationRecord.findMany({
      where: { organizationId, createdAt: { gte: start, lte: end } },
      select: { outcome: true, kind: true },
      take: 5000,
    }),
  );
  const notifPerOutcome: Record<string, number> = {};
  const notifPerKind: Record<string, number> = {};
  for (const r of notifRows) {
    notifPerOutcome[r.outcome] = (notifPerOutcome[r.outcome] ?? 0) + 1;
    notifPerKind[r.kind] = (notifPerKind[r.kind] ?? 0) + 1;
  }

  const topBoundaryClasses = topN(boundaryCounts).map(([k, v]) => ({ boundaryClass: k, count: v }));
  const topHaltReasons = topN(haltCounts).map(([k, v]) => ({ reason: k, count: v }));
  const topEventNames = topN(eventCounts).map(([k, v]) => ({ eventName: k, count: v }));

  const verifiedComplete = perOutcome.verified_complete ?? 0;
  const haltedAtGate = perOutcome.halted_at_gate ?? 0;
  const totalDecisions = decisionRows.length;

  const headline = totalDecisions === 0
    ? "Quiet week — Axiom touched 0 candidates."
    : `${totalDecisions} candidate${totalDecisions === 1 ? "" : "s"} this week · ${verifiedComplete} verified · ${haltedAtGate} halted at gate.`;

  const body = [
    `*Axiom weekly digest · ${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}*`,
    "",
    `:chart_with_upwards_trend: *Autonomy* — ${totalDecisions} candidate(s)`,
    `   • verified_complete: ${verifiedComplete}`,
    `   • approval_packet_prepared: ${perOutcome.approval_packet_prepared ?? 0}`,
    `   • halted_at_gate: ${haltedAtGate}`,
    `   • errored: ${perOutcome.errored ?? 0}`,
    "",
    `:wrench: *Runbooks* — ${staged + approved + rejected + expired} staged`,
    `   • approved ${approved} · rejected ${rejected} · still staged ${staged} · expired ${expired}`,
    "",
    `:bell: *Notifications* — ${notifRows.length} sends`,
    `   • ok ${notifPerOutcome.ok ?? 0} · deduped ${notifPerOutcome.deduped ?? 0} · failed ${(notifPerOutcome.failed ?? 0) + (notifPerOutcome.skipped ?? 0)}`,
    "",
    topEventNames.length > 0 ? `*Top runbook events*` : "",
    ...topEventNames.map((t) => `   • ${t.eventName} — ${t.count}`),
    "",
    topHaltReasons.length > 0 ? `*Top halt reasons*` : "",
    ...topHaltReasons.map((t) => `   • ${t.reason} — ${t.count}`),
  ].filter(Boolean).join("\n");

  return {
    organizationId,
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    decisions: { total: totalDecisions, perOutcome, topBoundaryClasses, topHaltReasons },
    runbooks: { staged, approved, rejected, expired, topEventNames },
    notifications: { total: notifRows.length, perOutcome: notifPerOutcome, perKind: notifPerKind },
    headline,
    body,
  };
}

async function safe<T>(fn: () => Promise<T>): Promise<T extends Array<infer U> ? U[] : T> {
  try {
    const v = await fn();
    return v as T extends Array<infer U> ? U[] : T;
  } catch {
    return [] as unknown as T extends Array<infer U> ? U[] : T;
  }
}

function topN<K>(m: Map<K, number>): Array<[K, number]> {
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N);
}
