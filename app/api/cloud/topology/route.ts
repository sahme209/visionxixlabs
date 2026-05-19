/**
 * GET /api/cloud/topology
 *
 * Returns the NetworkTopologyReport — normalized cross-cloud node/edge
 * graph (AWS + Azure + GCP) showing vpcs/vnets, subnets, peerings, and
 * internet exposure.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildNetworkTopology } from "@/lib/cloud/networkTopologyBuilder";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    const report = await buildNetworkTopology();
    const anyLive = report.sections.some((s) => s.mode === "live" || s.mode === "partial");
    return apiOk(report, {
      correlationId,
      safetyContract: "aws_service_inventory_read_only",
      sourceMode: asApiSourceMode(anyLive ? "live" : "preview"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "aws_service_inventory_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
