/**
 * GET/POST /api/notifications/cron-weekly-digest
 *
 * Vercel-cron entrypoint. For each tenant in AUTONOMY_SCHEDULER_TENANTS,
 * builds the weekly digest and fires one Slack/Teams notification.
 *
 * Guards:
 *   - Authorization: Bearer ${CRON_SECRET}
 *
 * Safety contract: 'notification_read_only'.
 */

import { NextResponse, type NextRequest } from "next/server";
import { buildWeeklyDigest } from "@/lib/notifications/weeklyDigestBuilder";
import { sendOutboundNotification } from "@/lib/notifications/outboundNotificationLane";
import { loadAppEnv } from "@/lib/config/env";
import { resolveCorrelationId, apiOk } from "@/lib/api";
import type { OrganizationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest)  { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }

async function handle(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  const env = loadAppEnv();

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
      { ok: false, error: { code: "cron.not_configured", userMessage: "CRON_SECRET is not set." }, meta: { correlationId, generatedAt: new Date().toISOString() } },
      { status: 503 },
    );
  }

  const tenantIds = resolveActiveTenantIds();
  if (tenantIds.length === 0) {
    return apiOk(
      { ran: false, summary: "No tenants registered for weekly digest. Set AUTONOMY_SCHEDULER_TENANTS.", outcomes: [] },
      { correlationId, safetyContract: "notification_read_only" },
    );
  }

  const outcomes: Array<{ tenantId: string; sent: boolean; reason?: string; total: number }> = [];

  for (const tenantId of tenantIds) {
    try {
      const digest = await buildWeeklyDigest(String(tenantId));
      const today = new Date().toISOString().slice(0, 10);
      const result = await sendOutboundNotification({
        dedupeKey: `weekly-digest:${tenantId}:${today}`,
        kind: "cycle_summary",
        severity: "info",
        tenantId: String(tenantId),
        headline: digest.headline,
        body: digest.body,
        safeNextAction: { label: "Open Decision Rationale", href: "/dashboard/rationale" },
        evidenceRefs: [`window:${digest.windowStart}/${digest.windowEnd}`],
      });
      outcomes.push({
        tenantId: String(tenantId),
        sent: result.ok,
        reason: result.reason,
        total: digest.decisions.total,
      });
    } catch (err) {
      outcomes.push({
        tenantId: String(tenantId),
        sent: false,
        reason: err instanceof Error ? err.message.slice(0, 200) : "unknown_error",
        total: 0,
      });
    }
  }

  return apiOk(
    {
      ran: true,
      summary: `Sent weekly digest to ${outcomes.filter((o) => o.sent).length}/${outcomes.length} tenant(s).`,
      outcomes,
    },
    { correlationId, safetyContract: "notification_read_only" },
  );
}

function resolveActiveTenantIds(): OrganizationId[] {
  const raw = process.env.AUTONOMY_SCHEDULER_TENANTS?.trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean) as unknown as OrganizationId[];
}
