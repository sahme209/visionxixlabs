/**
 * GET /api/agents/impact
 *
 * Aggregates the caller-tenant's MethodProposal rows into a funnel +
 * per-target lifecycle report. Operators use this to answer "how much
 * are agents actually shipping improvements?"
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { buildImpactReport, type RawImpactRow } from "@/lib/agents/proposalImpactTracker";
import { isProposalStatus, isProposalTarget } from "@/lib/agents/methodProposalModel";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }

    let rows: Array<{ target: string; status: string; updatedAt: Date }> = [];
    try {
      rows = await prisma.methodProposal.findMany({
        where: { organizationId: String(ctx.organizationId) },
        select: { target: true, status: true, updatedAt: true },
        take: 5000,
      });
    } catch {
      rows = [];
    }

    const cleaned: RawImpactRow[] = rows
      .filter((r) => isProposalTarget(r.target) && isProposalStatus(r.status))
      .map((r) => ({
        target: r.target as RawImpactRow["target"],
        status: r.status as RawImpactRow["status"],
        updatedAt: r.updatedAt.toISOString(),
      }));

    const report = buildImpactReport(cleaned);
    return apiOk(report, {
      correlationId,
      safetyContract: "audit_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "audit_read_only" });
  }
}
