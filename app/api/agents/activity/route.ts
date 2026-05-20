/**
 * GET /api/agents/activity
 *
 * Aggregates the caller-tenant's recent agent bus messages into a
 * per-role + per-kind activity report. Optional `windowHours` query
 * (default 24, capped at 720 — 30 days). Read-only.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { buildActivityReport } from "@/lib/agents/agentActivityAggregator";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

const WINDOW_HOURS_MIN = 1;
const WINDOW_HOURS_MAX = 720;

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const raw = Number.parseInt(req.nextUrl.searchParams.get("windowHours") ?? "24", 10);
    const windowHours = Number.isFinite(raw)
      ? Math.max(WINDOW_HOURS_MIN, Math.min(raw, WINDOW_HOURS_MAX))
      : 24;
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    let rows: Array<{ sender: string; kind: string; createdAt: Date }> = [];
    try {
      rows = await prisma.agentBusMessage.findMany({
        where: { organizationId: String(ctx.organizationId), createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        select: { sender: true, kind: true, createdAt: true },
        take: 5000,
      });
    } catch {
      rows = [];
    }

    const report = buildActivityReport(rows);
    return apiOk({ windowHours, ...report }, {
      correlationId,
      safetyContract: "audit_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "audit_read_only" });
  }
}
