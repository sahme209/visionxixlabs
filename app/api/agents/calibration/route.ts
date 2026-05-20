/**
 * GET /api/agents/calibration
 *
 * Returns per-(authorAgent,target) calibration: approval rate vs.
 * self-declared confidence. Operators use this to spot over- or
 * under-confident agents. Read-only — agents do not retune themselves
 * from this endpoint.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { buildCalibrationReport, type RawProposal } from "@/lib/agents/proposalCalibration";
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

    let rows: Array<{ authorAgent: string; target: string; status: string; confidence: number }> = [];
    try {
      rows = await prisma.methodProposal.findMany({
        where: { organizationId: String(ctx.organizationId) },
        select: { authorAgent: true, target: true, status: true, confidence: true },
        take: 5000,
      });
    } catch {
      rows = [];
    }

    const cleaned: RawProposal[] = rows
      .filter((r) => isProposalTarget(r.target) && isProposalStatus(r.status))
      .map((r) => ({
        authorAgent: r.authorAgent,
        target: r.target as RawProposal["target"],
        status: r.status as RawProposal["status"],
        confidence: r.confidence,
      }));

    const report = buildCalibrationReport(cleaned);
    return apiOk(report, {
      correlationId,
      safetyContract: "audit_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "audit_read_only" });
  }
}
