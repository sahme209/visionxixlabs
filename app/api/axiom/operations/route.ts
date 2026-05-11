/**
 * GET /api/axiom/operations?organizationId=XXX
 *
 * Returns operational dashboard data: recent runs, drift summary,
 * outcome history, scheduled scans, and pending approvals.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as { id?: string }).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const organizationId = req.nextUrl.searchParams.get("organizationId");

  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }

  try {
    const [recentRuns, schedules, approvals, auditOutcomes, cloudAccounts] = await Promise.all([
      prisma.axiomAgentRun.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          status: true,
          trigger: true,
          summary: true,
          createdAt: true,
          completedAt: true,
          cloudAccountId: true,
          errorMessage: true,
          _count: { select: { findings: true, recommendations: true } },
        },
      }),

      prisma.axiomScheduledRun.findMany({
        where: { organizationId },
        select: {
          id: true,
          frequency: true,
          enabled: true,
          nextRunAt: true,
          lastRunId: true,
          consecutiveFailures: true,
          cloudAccount: {
            select: { provider: true, externalAccountId: true },
          },
        },
      }),

      prisma.axiomApprovalRequest.findMany({
        where: {
          run: { organizationId },
          decision: "approve_partial",
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          runId: true,
          decision: true,
          note: true,
          createdAt: true,
          approvedItemIds: true,
        },
      }),

      prisma.auditLog.findMany({
        where: {
          action: { in: ["axiom_outcome_scan", "axiom_outcome_action"] },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { metadata: true, createdAt: true },
      }),

      prisma.cloudAccount.findMany({
        where: { organizationId },
        select: {
          id: true,
          provider: true,
          externalAccountId: true,
          enabled: true,
          lastScannedAt: true,
        },
      }),
    ]);

    const relevantOutcomes = auditOutcomes.filter((log) => {
      const meta = log.metadata as Record<string, unknown> | null;
      return meta?.organizationId === organizationId;
    });

    let totalSavingsIdentified = 0;
    let totalSavingsRealized = 0;
    let totalScans = 0;
    let totalActionsApplied = 0;
    let totalActionsFailed = 0;
    let driftDetections = 0;

    for (const log of relevantOutcomes) {
      const meta = log.metadata as Record<string, unknown>;
      if (meta.type === "scan_outcome") {
        totalScans++;
        totalSavingsIdentified += (meta.savingsYearly as number) ?? 0;
        driftDetections += (meta.driftCount as number) ?? 0;
      }
      if (meta.type === "action_outcome") {
        const status = meta.status as string;
        if (status === "verified" || status === "applied") {
          totalActionsApplied++;
          totalSavingsRealized += (meta.savingsRealized as number) ?? 0;
        } else if (status === "failed") {
          totalActionsFailed++;
        }
      }
    }

    const findingsFromRuns = recentRuns.reduce((sum, r) => sum + r._count.findings, 0);
    const lastDriftRun = recentRuns.find((r) => r.status === "completed");

    return NextResponse.json({
      summary: {
        totalScans,
        totalFindings: findingsFromRuns,
        totalActionsApplied,
        totalActionsFailed,
        totalSavingsIdentified,
        totalSavingsRealized,
        driftDetections,
        connectedAccounts: cloudAccounts.length,
        activeSchedules: schedules.filter((s) => s.enabled).length,
        pendingApprovals: approvals.length,
      },
      recentRuns: recentRuns.map((r) => ({
        id: r.id,
        status: r.status,
        trigger: r.trigger,
        summary: r.summary,
        createdAt: r.createdAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
        cloudAccountId: r.cloudAccountId,
        error: r.errorMessage,
        findingCount: r._count.findings,
        recommendationCount: r._count.recommendations,
      })),
      schedules: schedules.map((s) => ({
        id: s.id,
        frequency: s.frequency,
        enabled: s.enabled,
        nextRunAt: s.nextRunAt?.toISOString() ?? null,
        lastRunId: s.lastRunId,
        consecutiveFailures: s.consecutiveFailures,
        provider: s.cloudAccount.provider,
        accountId: s.cloudAccount.externalAccountId,
      })),
      pendingApprovals: approvals.map((a) => ({
        id: a.id,
        runId: a.runId,
        note: a.note,
        createdAt: a.createdAt.toISOString(),
        itemCount: (a.approvedItemIds as string[])?.length ?? 0,
      })),
      cloudAccounts: cloudAccounts.map((a) => ({
        id: a.id,
        provider: a.provider,
        accountId: a.externalAccountId,
        enabled: a.enabled,
        lastScannedAt: a.lastScannedAt?.toISOString() ?? null,
      })),
    });
  } catch (e) {
    console.error("[axiom operations]", e);
    return NextResponse.json({ error: "Failed to load operations data" }, { status: 500 });
  }
}
