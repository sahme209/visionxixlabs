/**
 * Workspace usage summary rebuilder — Phase 382.
 *
 * Aggregates the current month's UsageEvent rows into per-workspace
 * WorkspaceUsageSummary rows. Idempotent — re-running upserts the
 * same period_month row in place. Counts every eventKind we ship
 * today (ai_invocation, agent_run, automation_run, connector_sync,
 * cloud_scan, report_generated) — new event kinds get added here as
 * the producer ships.
 *
 * Lives separate from the cron route so the same code path is
 * available for manual rebuild + test harness.
 */

import "server-only";

import { prisma } from "@/lib/db";

const periodKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const periodStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

export interface RebuildUsageSummaryResult {
  periodMonth: string;
  workspacesProcessed: number;
  rowsUpserted: number;
  rowsSkipped: number;
}

export async function rebuildUsageSummary(now: Date = new Date()): Promise<RebuildUsageSummaryResult> {
  const period = periodKey(now);
  const start = periodStart(now);

  // Find every workspace that produced at least one UsageEvent this month.
  // Aggregating by groupBy on the full event table is cheap with the
  // (organizationId, createdAt) index.
  const orgs = await prisma.usageEvent.groupBy({
    by: ["organizationId"],
    where: { createdAt: { gte: start } },
    _count: { _all: true },
  }).catch(() => [] as Array<{ organizationId: string; _count: { _all: number } }>);

  let rowsUpserted = 0;
  let rowsSkipped = 0;

  for (const org of orgs) {
    try {
      // Pull aggregate per (workspace, kind) for the period.
      const buckets = await prisma.usageEvent.groupBy({
        by: ["eventKind"],
        where: {
          organizationId: org.organizationId,
          createdAt: { gte: start },
        },
        _sum: {
          costCents: true,
          inputTokens: true,
          outputTokens: true,
          cachedReadTokens: true,
        },
        _count: { _all: true },
      });

      const get = (kind: string) => buckets.find((b) => b.eventKind === kind);
      const ai = get("ai_invocation");

      const aiCostCents = ai?._sum.costCents ?? 0;
      const aiInvocationCount = ai?._count._all ?? 0;
      const aiInputTokens = BigInt(ai?._sum.inputTokens ?? 0);
      const aiOutputTokens = BigInt(ai?._sum.outputTokens ?? 0);
      const aiCachedReadTokens = BigInt(ai?._sum.cachedReadTokens ?? 0);

      const totalCostCents = buckets.reduce((acc, b) => acc + (b._sum.costCents ?? 0), 0);

      await prisma.workspaceUsageSummary.upsert({
        where: { organizationId_periodMonth: { organizationId: org.organizationId, periodMonth: period } },
        create: {
          organizationId: org.organizationId,
          periodMonth: period,
          totalCostCents,
          aiCostCents,
          aiInvocationCount,
          aiInputTokens,
          aiOutputTokens,
          aiCachedReadTokens,
          agentRunCount:      get("agent_run")?._count._all      ?? 0,
          automationRunCount: get("automation_run")?._count._all ?? 0,
          connectorSyncCount: get("connector_sync")?._count._all ?? 0,
          cloudScanCount:     get("cloud_scan")?._count._all     ?? 0,
          reportCount:        get("report_generated")?._count._all ?? 0,
          lastRebuiltAt: now,
        },
        update: {
          totalCostCents,
          aiCostCents,
          aiInvocationCount,
          aiInputTokens,
          aiOutputTokens,
          aiCachedReadTokens,
          agentRunCount:      get("agent_run")?._count._all      ?? 0,
          automationRunCount: get("automation_run")?._count._all ?? 0,
          connectorSyncCount: get("connector_sync")?._count._all ?? 0,
          cloudScanCount:     get("cloud_scan")?._count._all     ?? 0,
          reportCount:        get("report_generated")?._count._all ?? 0,
          lastRebuiltAt: now,
        },
      });
      rowsUpserted++;
    } catch {
      rowsSkipped++;
    }
  }

  return {
    periodMonth: period,
    workspacesProcessed: orgs.length,
    rowsUpserted,
    rowsSkipped,
  };
}
