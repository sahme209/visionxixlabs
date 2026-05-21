/**
 * GET /api/tenant/freshness
 *
 * Returns a tiny tenant-scoped snapshot: does this tenant already have
 * any real data on the platform? Dashboards use the answer to decide
 * between rendering preview/sample content and rendering a calm
 * empty-state with a "Connect your first cloud" CTA.
 *
 * No PII, no row contents — just booleans + counts.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { getLivePlatformSummary } from "@/lib/platform/livePlatformState";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";
import type { TenantFreshnessSnapshot } from "@/lib/platform/tenantFreshnessTypes";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");

    const summary = await getLivePlatformSummary();
    const snapshot: TenantFreshnessSnapshot = {
      hasConnectors: summary.cloudAccounts > 0,
      hasAgentRuns: summary.agentRuns24h > 0 || summary.busMessages24h > 0,
      hasApprovals: summary.pendingApprovals > 0,
      freshTenant: summary.cloudAccounts === 0 && summary.agentRuns24h === 0,
      counts: {
        cloudAccounts: summary.cloudAccounts,
        agentRuns24h: summary.agentRuns24h,
        busMessages24h: summary.busMessages24h,
        pendingApprovals: summary.pendingApprovals,
      },
    };

    return apiOk(snapshot, {
      correlationId,
      safetyContract: "command_center_read_only",
      sourceMode: asApiSourceMode(summary.ok ? "live" : "unknown"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "command_center_read_only" });
  }
}
