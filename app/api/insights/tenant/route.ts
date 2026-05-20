/**
 * GET /api/insights/tenant
 *
 * Synthesizes a 3-5 sentence operator-facing tenant summary using the
 * AI manager, falling back to a deterministic template when AI is
 * unavailable. The seed is computed server-side from Prisma counts
 * (never raw event payloads) so the prompt stays small and tenant
 * data never leaks to the model.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { synthesizeInsights, type InsightsSeed } from "@/lib/insights/tenantInsightsSynthesizer";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 7;
const MAX_DAYS = 30;

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
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
      // Dissenters bus messages: kind == "council_consensus" carries the
      // dissent count in payload; counting council_consensus emissions is
      // a cheap proxy.
      const consensus = await prisma.agentBusMessage.count({
        where: { organizationId: orgId, kind: "council_consensus", createdAt: { gte: since } },
      });
      seed.dissentCount = consensus;
    } catch { /* leave zero */ }

    const narrative = await synthesizeInsights(seed);

    return apiOk({ seed, narrative }, {
      correlationId,
      safetyContract: "audit_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "audit_read_only" });
  }
}
