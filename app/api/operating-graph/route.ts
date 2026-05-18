/**
 * GET /api/operating-graph
 *
 * Returns the canonical Operating Graph via the canonical API envelope.
 * Pure read-only projection over AxiomOSState.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildOperatingGraph } from "@/lib/operatingGraph/operatingGraphBuilder";
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
    const graph = await buildOperatingGraph({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return apiOk(graph, {
      correlationId,
      safetyContract: "operating_graph_read_only",
      sourceMode: asApiSourceMode(graph.overallSourceMode),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "operating_graph_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
