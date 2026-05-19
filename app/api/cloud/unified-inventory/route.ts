/**
 * GET /api/cloud/unified-inventory
 *
 * Returns the UnifiedInventoryReport — one normalized cross-cloud
 * resource catalog with compute / storage / database totals + posture
 * rollups per cloud.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildUnifiedInventory } from "@/lib/cloud/unifiedInventoryBuilder";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const report = await buildUnifiedInventory({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
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
