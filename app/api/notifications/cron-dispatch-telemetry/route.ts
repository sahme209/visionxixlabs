/**
 * GET/POST /api/notifications/cron-dispatch-telemetry
 *
 * Vercel-cron entrypoint. For every active tenant, runs the
 * telemetry ingest builder + dispatches critical signals through
 * Slack/Teams. Mirrors the autonomy scheduler's auth + tenant
 * resolution.
 *
 * Guards:
 *   - Authorization: Bearer ${CRON_SECRET}
 *   - AUTONOMY_SCHEDULER_TENANTS env enumerates active tenants.
 *
 * Safety contract: 'telemetry_ingest_read_only' — pure read +
 * dispatch (the dispatcher's dedupe ensures we never spam).
 */

import { NextResponse, type NextRequest } from "next/server";
import { buildTelemetryIngest } from "@/lib/telemetry/telemetryIngestBuilder";
import { dispatchCriticalTelemetry } from "@/lib/notifications/criticalTelemetryDispatcher";
import { loadAppEnv } from "@/lib/config/env";
import { resolveCorrelationId, apiOk } from "@/lib/api";
import { isFlagEnabled } from "@/lib/flags/featureFlagStore";
import {
  recordTickOutcome,
  shouldSkipDueToConsecutiveFailures,
} from "@/lib/autonomy/cronHealthTracker";
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
      { ok: false, error: { code: "cron.not_configured", userMessage: "CRON_SECRET is not set — telemetry dispatch refuses to run." }, meta: { correlationId, generatedAt: new Date().toISOString() } },
      { status: 503 },
    );
  }

  const tenantIds = resolveActiveTenantIds();
  if (tenantIds.length === 0) {
    return apiOk(
      { ran: false, summary: "No tenants registered. Set AUTONOMY_SCHEDULER_TENANTS.", outcomes: [] },
      { correlationId, safetyContract: "telemetry_ingest_read_only" },
    );
  }

  const outcomes: Array<{
    tenantId: string;
    totalSignalsInspected: number;
    totalDispatchAttempted: number;
    totalDispatchSucceeded: number;
    error?: string;
  }> = [];

  for (const tenantId of tenantIds) {
    // Phase 121 — per-tenant feature-flag gate.
    const flagOn = await isFlagEnabled({
      organizationId: String(tenantId),
      key: "notifications.dispatch_critical_telemetry",
    });
    if (!flagOn) {
      outcomes.push({
        tenantId: String(tenantId),
        totalSignalsInspected: 0,
        totalDispatchAttempted: 0,
        totalDispatchSucceeded: 0,
        error: "flag_disabled:notifications.dispatch_critical_telemetry",
      });
      continue;
    }

    // Phase 119 — self-heal skip when last 3 ticks errored.
    const skipDecision = shouldSkipDueToConsecutiveFailures({
      cronName: "cron-dispatch-telemetry",
      tenantId: String(tenantId),
    });
    if (skipDecision.skip) {
      outcomes.push({
        tenantId: String(tenantId),
        totalSignalsInspected: 0,
        totalDispatchAttempted: 0,
        totalDispatchSucceeded: 0,
        error: skipDecision.reason,
      });
      continue;
    }

    try {
      const report = await buildTelemetryIngest({ tenantId });
      const outcome = await dispatchCriticalTelemetry({
        tenantId: String(tenantId),
        signals: report.signals,
        minSeverity: "high",
      });
      outcomes.push({
        tenantId: String(tenantId),
        totalSignalsInspected: outcome.totalSignalsInspected,
        totalDispatchAttempted: outcome.totalDispatchAttempted,
        totalDispatchSucceeded: outcome.totalDispatchSucceeded,
      });
      recordTickOutcome({
        cronName: "cron-dispatch-telemetry",
        tenantId: String(tenantId),
        outcome: "ok",
      });
    } catch (err) {
      outcomes.push({
        tenantId: String(tenantId),
        totalSignalsInspected: 0,
        totalDispatchAttempted: 0,
        totalDispatchSucceeded: 0,
        error: err instanceof Error ? err.message.slice(0, 200) : "unknown_error",
      });
      recordTickOutcome({
        cronName: "cron-dispatch-telemetry",
        tenantId: String(tenantId),
        outcome: "errored",
      });
    }
  }

  return apiOk(
    {
      ran: true,
      summary: `Ran across ${outcomes.length} tenant(s) · ${outcomes.reduce((n, o) => n + o.totalDispatchSucceeded, 0)} notification(s) dispatched`,
      outcomes,
    },
    { correlationId, safetyContract: "telemetry_ingest_read_only" },
  );
}

function resolveActiveTenantIds(): OrganizationId[] {
  const raw = process.env.AUTONOMY_SCHEDULER_TENANTS?.trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean) as unknown as OrganizationId[];
}
