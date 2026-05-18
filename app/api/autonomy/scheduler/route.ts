/**
 * GET/POST /api/autonomy/scheduler
 *
 * Vercel cron entry-point for the autonomy scheduler. Runs one
 * cycle per tenant. Guarded by:
 *
 *   - Authorization: Bearer ${CRON_SECRET}  (Vercel cron header)
 *   - AUTONOMY_SCHEDULER_ENABLED env flag
 *
 * Hard-literal safety contract: 'autonomy_gated_no_unsafe_execution'
 * — same contract as the on-demand cycle endpoint, since the
 * scheduler runs the same closed runner.
 */

import { NextResponse, type NextRequest } from "next/server";
import { runSchedulerTick } from "@/lib/autonomy/autonomyScheduler";
import { loadAppEnv } from "@/lib/config/env";
import { resolveCorrelationId, apiOk } from "@/lib/api";
import type { OrganizationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel pro/hobby maximum

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  const env = loadAppEnv();

  // Vercel cron sends Authorization: Bearer <CRON_SECRET>.
  if (env.cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${env.cronSecret}`) {
      return NextResponse.json(
        { ok: false, error: { code: "cron.unauthorized", userMessage: "Cron secret mismatch." }, meta: { correlationId, generatedAt: new Date().toISOString() } },
        { status: 401 },
      );
    }
  } else {
    return NextResponse.json(
      { ok: false, error: { code: "cron.not_configured", userMessage: "CRON_SECRET is not set — scheduler refuses to run." }, meta: { correlationId, generatedAt: new Date().toISOString() } },
      { status: 503 },
    );
  }

  if (!env.autonomySchedulerEnabled) {
    return apiOk(
      { ran: false, summary: "AUTONOMY_SCHEDULER_ENABLED is not set — scheduler skipped.", cycles: [], skipped: [] },
      { correlationId, safetyContract: "autonomy_gated_no_unsafe_execution" },
    );
  }

  // Active tenant resolver — server-only. Until a per-tenant directory
  // wires in persistence, we read a comma-separated env override.
  const tenantIds = resolveActiveTenantIds();
  if (tenantIds.length === 0) {
    return apiOk(
      { ran: false, summary: "No tenants registered for scheduler. Set AUTONOMY_SCHEDULER_TENANTS or wire persistence.", cycles: [], skipped: [] },
      { correlationId, safetyContract: "autonomy_gated_no_unsafe_execution" },
    );
  }

  const result = await runSchedulerTick({ tenantIds });
  return apiOk(result, {
    correlationId,
    safetyContract: "autonomy_gated_no_unsafe_execution",
  });
}

function resolveActiveTenantIds(): OrganizationId[] {
  const raw = process.env.AUTONOMY_SCHEDULER_TENANTS?.trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean) as unknown as OrganizationId[];
}
