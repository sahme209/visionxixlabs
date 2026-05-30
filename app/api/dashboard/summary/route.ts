/**
 * GET /api/dashboard/summary
 *
 * One-shot stats roll-up for the dashboard hero. Returns:
 *   - findingCount       (latest 100 findings, mirrors /dashboard/findings)
 *   - pendingApprovals   (AxiomApprovalItem where status in pending|snoozed)
 *   - monthlyLow         (sum of monthlyLow across pending approvals)
 *   - monthlyHigh        (sum of monthlyHigh, ditto)
 *   - lastScanIso        (most recent AxiomAgentRun.completedAt)
 *
 * Session-gated. Returns zeros + nullable lastScanIso when nothing is
 * connected yet; migration-pending honestly when the tables aren't
 * migrated. Never errors — the dashboard renders even on a fresh
 * Postgres.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SummaryResponse {
  ok: true;
  findingCount: number;
  pendingApprovals: number;
  highRiskApprovals: number;
  monthlyLow: number;
  monthlyHigh: number;
  lastScanIso: string | null;
  migrationPending: boolean;
}

export async function GET() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json<SummaryResponse>({
      ok: true,
      findingCount: 0,
      pendingApprovals: 0,
      highRiskApprovals: 0,
      monthlyLow: 0,
      monthlyHigh: 0,
      lastScanIso: null,
      migrationPending: false,
    });
  }

  // Run everything in parallel. Each branch degrades to zero on a
  // missing table so a partial migration still renders.
  const [findingCount, pendingApprovals, highRiskApprovals, savingsAgg, lastRun] = await Promise.all([
    prisma.axiomFinding
      .count({ where: { run: { organizationId: ctx.organizationId } } })
      .catch(() => 0),
    prisma.axiomApprovalItem
      .count({
        where: {
          organizationId: ctx.organizationId,
          status: { in: ["pending", "snoozed"] },
        },
      })
      .catch(() => 0),
    prisma.axiomApprovalItem
      .count({
        where: {
          organizationId: ctx.organizationId,
          status: { in: ["pending", "snoozed"] },
          riskLevel: "high",
        },
      })
      .catch(() => 0),
    prisma.axiomApprovalItem
      .aggregate({
        where: {
          organizationId: ctx.organizationId,
          status: { in: ["pending", "snoozed"] },
        },
        _sum: { monthlyLow: true, monthlyHigh: true },
      })
      .catch(() => ({ _sum: { monthlyLow: 0, monthlyHigh: 0 } as { monthlyLow: number | null; monthlyHigh: number | null } })),
    prisma.axiomAgentRun
      .findFirst({
        where: { organizationId: ctx.organizationId, status: "completed" },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true },
      })
      .catch(() => null),
  ]);

  return NextResponse.json<SummaryResponse>({
    ok: true,
    findingCount,
    pendingApprovals,
    highRiskApprovals,
    monthlyLow: savingsAgg._sum.monthlyLow ?? 0,
    monthlyHigh: savingsAgg._sum.monthlyHigh ?? 0,
    lastScanIso: lastRun?.completedAt?.toISOString() ?? null,
    migrationPending: false,
  });
}
