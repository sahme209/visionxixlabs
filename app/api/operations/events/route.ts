/**
 * GET /api/operations/events
 *
 * Returns the live operational event stream for the authenticated user.
 * Combines ExecutionLog + AxiomAgentRun + AxiomFinding + AxiomAuditEvent rows
 * into a single unified ActivityEvent[] stream via lib/operations/eventStream.
 *
 * Query params:
 *   limit  — max events to return (default 50, max 200)
 *   view   — "activity" (default) or "memory"
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { composeActivityStream, composeMemoryGroups } from "@/lib/operations/eventStream";

type AgentRunWithRelations = Prisma.AxiomAgentRunGetPayload<{
  include: {
    cloudAccount: { select: { provider: true } };
    findings: { select: { id: true; category: true; severity: true; title: true; region: true; provider: true; monthlyHigh: true; createdAt: true } };
    recommendations: { select: { id: true; title: true; disposition: true; monthlyHigh: true; createdAt: true } };
  };
}>;

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    Number(searchParams.get("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT,
    MAX_LIMIT
  );
  const view = searchParams.get("view") === "memory" ? "memory" : "activity";

  try {
    const executionLogs = await prisma.executionLog.findMany({
      where: { userId },
      orderBy: { executedAt: "desc" },
      take: limit,
      select: {
        id: true,
        action: true,
        pluginId: true,
        status: true,
        dryRun: true,
        params: true,
        error: true,
        executedAt: true,
        rollbackSteps: true,
      },
    });

    if (view === "memory") {
      const groups = composeMemoryGroups(executionLogs);
      return NextResponse.json({
        view: "memory",
        groups,
        meta: {
          sources: { executionLogs: executionLogs.length },
          generatedAt: new Date().toISOString(),
        },
      });
    }

    // Best-effort: also pull Axiom-specific tables if they exist for this user.
    // Wrapped in try/catch so a missing table or schema drift never poisons the response.
    let agentRuns: AgentRunWithRelations[] = [];
    let findings: Awaited<ReturnType<typeof prisma.axiomFinding.findMany>> = [];
    let auditEvents: Awaited<ReturnType<typeof prisma.axiomAuditEvent.findMany>> = [];

    try {
      agentRuns = await prisma.axiomAgentRun.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: Math.min(20, limit),
        include: {
          cloudAccount: { select: { provider: true } },
          findings: { select: { id: true, category: true, severity: true, title: true, region: true, provider: true, monthlyHigh: true, createdAt: true } },
          recommendations: { select: { id: true, title: true, disposition: true, monthlyHigh: true, createdAt: true } },
        },
      });
    } catch { /* table may not exist in this deployment */ }

    try {
      findings = await prisma.axiomFinding.findMany({
        where: { run: { userId } },
        orderBy: { createdAt: "desc" },
        take: Math.min(20, limit),
      });
    } catch { /* skip */ }

    try {
      auditEvents = await prisma.axiomAuditEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: Math.min(20, limit),
      });
    } catch { /* skip */ }

    // Phase 652: pull Phase 644-649 integration dispatches.
    // Stored at AiRationaleEnrichment / targetKind=workforce_action_execution,
    // scoped by organizationId. We need to look up the user's
    // organization via OrgMembership (no schema relation to OrgMembership).
    let actionExecutions: { targetId: string; narrative: string; nextActionsJson: unknown; outcome: string; updatedAt: Date }[] = [];
    let secureAuditRecords: { id: string; action: string; outcome: string; entityRef: string | null; occurredAt: Date; detail: unknown }[] = [];
    try {
      const membership = await prisma.orgMembership.findFirst({
        where: { userId },
        select: { organizationId: true },
      });
      if (membership?.organizationId) {
        const rows = await prisma.aiRationaleEnrichment.findMany({
          where: {
            organizationId: membership.organizationId,
            targetKind: "workforce_action_execution",
          },
          orderBy: { updatedAt: "desc" },
          take: Math.min(20, limit),
          select: { targetId: true, narrative: true, nextActionsJson: true, outcome: true, updatedAt: true },
        });
        actionExecutions = rows;

        // Phase 655: pull engineer.* audit events for this org.
        try {
          const audits = await prisma.secureAuditRecord.findMany({
            where: {
              organizationId: membership.organizationId,
              action: { in: ["engineer.action_executed", "engineer.action_execution_failed", "engineer.action_attempted"] },
            },
            orderBy: { occurredAt: "desc" },
            take: Math.min(30, limit),
            select: { id: true, action: true, outcome: true, entityRef: true, occurredAt: true, detail: true },
          });
          secureAuditRecords = audits;
        } catch { /* skip — table may not exist */ }
      }
    } catch { /* skip — table or relation may not exist in this deployment */ }

    const events = composeActivityStream({
      executionLogs,
      agentRuns: agentRuns.map((r) => ({
        id: r.id,
        status: r.status,
        trigger: r.trigger,
        summary: r.summary,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
        cloudAccount: r.cloudAccount,
        findings: r.findings,
        recommendations: r.recommendations,
      })),
      findings: findings.map((f) => ({
        id: f.id,
        category: f.category,
        severity: f.severity,
        title: f.title,
        region: f.region,
        provider: f.provider,
        monthlyHigh: f.monthlyHigh,
        createdAt: f.createdAt,
      })),
      auditEvents: auditEvents.map((a) => ({
        id: a.id,
        provider: a.provider,
        actionType: a.actionType,
        region: a.region,
        status: a.status,
        riskLevel: a.riskLevel,
        monthlyHigh: a.monthlyHigh,
        createdAt: a.createdAt,
        appliedAt: a.appliedAt,
      })),
      actionExecutions,
      secureAuditRecords,
    });

    return NextResponse.json({
      view: "activity",
      events: events.slice(0, limit),
      meta: {
        sources: {
          executionLogs: executionLogs.length,
          agentRuns: agentRuns.length,
          findings: findings.length,
          auditEvents: auditEvents.length,
          actionExecutions: actionExecutions.length,
          secureAuditRecords: secureAuditRecords.length,
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error("[operations/events]", e);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}
