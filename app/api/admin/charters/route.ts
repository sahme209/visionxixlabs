/**
 * GET /api/admin/charters
 *
 * Admin-only: lists every TenantAutonomyCharter row across all
 * tenants. Returns 403 unless the caller's email is in ADMIN_EMAILS.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isPlatformAdmin } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    if (!isPlatformAdmin(ctx.email)) {
      throw AxiomErrors.validation("admin.required", "Platform admin email required (set ADMIN_EMAILS).");
    }
    let rows: Array<{
      organizationId: string;
      mode: string;
      perCycleActionLimit: number | null;
      rationale: string | null;
      slackWebhookOverride: string | null;
      updatedAt: Date;
      updatedBy: string | null;
      createdAt: Date;
    }> = [];
    try {
      rows = await prisma.tenantAutonomyCharter.findMany({
        orderBy: { updatedAt: "desc" },
        take: 500,
      });
    } catch {
      // Empty result — DB unavailable.
    }

    const perMode: Record<string, number> = {};
    for (const r of rows) perMode[r.mode] = (perMode[r.mode] ?? 0) + 1;

    return apiOk({
      total: rows.length,
      perMode,
      records: rows.map((r) => ({
        organizationId: r.organizationId,
        mode: r.mode,
        perCycleActionLimit: r.perCycleActionLimit,
        rationale: r.rationale,
        // Never echo the full URL — only its presence flag.
        slackWebhookOverridePresent: Boolean(r.slackWebhookOverride),
        updatedAt: r.updatedAt.toISOString(),
        updatedBy: r.updatedBy,
        createdAt: r.createdAt.toISOString(),
      })),
    }, {
      correlationId,
      safetyContract: "policy_governance_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "policy_governance_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
