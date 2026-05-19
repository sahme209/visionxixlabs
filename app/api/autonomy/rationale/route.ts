/**
 * GET /api/autonomy/rationale
 *
 * Durable audit history of every autonomy candidate's decision —
 * inputs, per-stage transcript, outcome. Pure read.
 *
 * Query params:
 *   - limit  (1..500, default 100)
 *   - outcome (optional: passed / approval_packet_prepared / halted_at_gate / errored / ...)
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { readRationaleHistory } from "@/lib/autonomy/decisionRationaleStore";
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
    const limitRaw = req.nextUrl.searchParams.get("limit");
    const outcome = req.nextUrl.searchParams.get("outcome") || undefined;
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const report = await readRationaleHistory({
      organizationId: String(ctx.organizationId),
      limit: Number.isFinite(limit) ? limit : undefined,
      outcome,
    });
    return apiOk(report, {
      correlationId,
      safetyContract: "audit_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "audit_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
