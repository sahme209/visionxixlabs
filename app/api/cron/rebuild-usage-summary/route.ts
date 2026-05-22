/**
 * GET/POST /api/cron/rebuild-usage-summary — Phase 382.
 *
 * Vercel cron entry-point. Rebuilds WorkspaceUsageSummary from the
 * current month's UsageEvent rows. Idempotent. Bearer CRON_SECRET
 * guard; 503 when the secret is unset (refuses to run as a public
 * endpoint).
 */

import { NextResponse, type NextRequest } from "next/server";
import { loadAppEnv } from "@/lib/config/env";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { rebuildUsageSummary } from "@/lib/billing/rebuildUsageSummary";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const env = loadAppEnv();
  if (!env.cronSecret) {
    return NextResponse.json(
      { ok: false, reason: "cron_not_configured", detail: "CRON_SECRET is not set." },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ ok: false, reason: "cron_unauthorized" }, { status: 401 });
  }

  const result = await rebuildUsageSummary();

  // System-wide audit row so the operator can confirm the rebuild ran.
  try {
    await recordAudit({
      organizationId: idFactory.organization("ws_internal_admin_visionxixlabs"),
      actorKind: "system",
      action: "billing.summary_rebuilt",
      outcome: "success",
      entityRef: `usage_summary:${result.periodMonth}`,
      correlationId: idFactory.correlation(`billing_rebuild_${result.periodMonth}_${Date.now().toString(36)}`),
      source: "live",
      detail: {
        periodMonth: result.periodMonth,
        workspacesProcessed: result.workspacesProcessed,
        rowsUpserted: result.rowsUpserted,
        rowsSkipped: result.rowsSkipped,
      },
    });
  } catch { /* best-effort */ }

  return NextResponse.json({
    ok: true,
    ...result,
    rebuiltAt: new Date().toISOString(),
  });
}
