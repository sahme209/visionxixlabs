/**
 * GET /api/insights/tenant
 *
 * GET reads aggregate metrics. POST explicitly requests a metered summary
 * using the same server-derived counts.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { prisma } from "@/lib/db";
import { summarizeInsightsMetrics, synthesizeInsights, type InsightsSeed } from "@/lib/insights/tenantInsightsSynthesizer";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 7;
const MAX_DAYS = 30;

export function GET(req: NextRequest) {
  return readInsights(req, false);
}

export function POST(req: NextRequest) {
  return readInsights(req, true);
}

async function readInsights(req: NextRequest, generate: boolean) {
  const correlationId = resolveCorrelationId(req.headers);
  const safetyContract = generate ? undefined : "audit_read_only";
  try {
    if (generate && !isSameOriginRequest(req)) {
      return apiErr(AxiomErrors.policy("insights.invalid_origin", "Open Tenant Insights in your workspace to generate a summary."), { correlationId, status: 403 });
    }
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId || (generate && !ctx.userId)) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const requestKey = req.headers.get("idempotency-key")?.trim() ?? "";
    if (generate && !/^[A-Za-z0-9_-]{16,160}$/.test(requestKey)) {
      throw AxiomErrors.validation("insights.request_key_required", "A stable request key is required for AI generation.");
    }
    const rawDays = Number.parseInt(req.nextUrl.searchParams.get("days") ?? `${DEFAULT_DAYS}`, 10);
    const windowDays = Number.isFinite(rawDays) ? Math.max(1, Math.min(rawDays, MAX_DAYS)) : DEFAULT_DAYS;
    const since = new Date(Date.now() - windowDays * DAY_MS);
    const orgId = String(ctx.organizationId);

    const seed: InsightsSeed = {
      tenantId: orgId,
      windowDays,
      proposalsDecided: 0,
      proposalsApproved: 0,
      proposalsApplied: 0,
      proposalsRejected: 0,
      autonomyCycles: 0,
      outboundSends: 0,
      outboundFailures: 0,
      dissentCount: 0,
      topAuthorAgent: null,
    };

    try {
      const props = await prisma.methodProposal.findMany({
        where: { organizationId: orgId, updatedAt: { gte: since } },
        select: { status: true, authorAgent: true },
        take: 5000,
      });
      const authorCount = new Map<string, number>();
      for (const p of props) {
        if (p.status === "approved") seed.proposalsApproved += 1;
        else if (p.status === "applied") seed.proposalsApplied += 1;
        else if (p.status === "rejected") seed.proposalsRejected += 1;
        if (p.status === "approved" || p.status === "applied" || p.status === "rejected") seed.proposalsDecided += 1;
        authorCount.set(p.authorAgent, (authorCount.get(p.authorAgent) ?? 0) + 1);
      }
      const sorted = [...authorCount.entries()].sort((a, b) => b[1] - a[1]);
      seed.topAuthorAgent = sorted[0]?.[0] ?? null;
    } catch { /* DB outage → leave zeros */ }

    try {
      seed.autonomyCycles = await prisma.autonomyDecisionRationale.count({
        where: { organizationId: orgId, createdAt: { gte: since } },
      });
    } catch { /* leave zero */ }

    try {
      const outRows = await prisma.outboundNotificationRecord.findMany({
        where: { organizationId: orgId, createdAt: { gte: since } },
        select: { outcome: true },
        take: 5000,
      });
      seed.outboundSends = outRows.length;
      seed.outboundFailures = outRows.filter((r) => r.outcome === "failed").length;
    } catch { /* leave zero */ }

    try {
      // Count consensus records. Retain the historical response field name.
      const consensus = await prisma.agentBusMessage.count({
        where: { organizationId: orgId, kind: "council_consensus", createdAt: { gte: since } },
      });
      seed.dissentCount = consensus;
    } catch { /* leave zero */ }

    const narrative = generate && ctx.userId
      ? await synthesizeInsights(seed, {
        userId: String(ctx.userId), correlationId, idempotencyKey: `tenant_insights_${requestKey}`,
      })
      : summarizeInsightsMetrics(seed);

    return apiOk({ seed, narrative }, {
      correlationId,
      safetyContract,
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract });
  }
}
