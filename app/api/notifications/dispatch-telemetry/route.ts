/**
 * POST /api/notifications/dispatch-telemetry
 *
 * Runs the telemetry ingest builder, then dispatches Slack/Teams
 * notifications for every signal at severity >= high (default).
 * Operators can hit this manually; a cron job will hit it on a
 * cadence in a follow-up phase.
 *
 * Body (optional):
 *   { "minSeverity": "critical" | "high" | "medium" | "low" | "info" }
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildTelemetryIngest } from "@/lib/telemetry/telemetryIngestBuilder";
import { dispatchCriticalTelemetry } from "@/lib/notifications/criticalTelemetryDispatcher";
import { apiOk, apiErr, resolveCorrelationId, asApiSourceMode } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";
import type { TelemetrySeverity } from "@/lib/telemetry/telemetryIngestModel";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_SEVERITY: TelemetrySeverity[] = ["critical", "high", "medium", "low", "info"];

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    let minSeverity: TelemetrySeverity = "high";
    try {
      const body = (await req.json()) as { minSeverity?: string } | null;
      if (body?.minSeverity && (ALLOWED_SEVERITY as string[]).includes(body.minSeverity)) {
        minSeverity = body.minSeverity as TelemetrySeverity;
      }
    } catch {
      // No body — fall back to default.
    }
    const report = await buildTelemetryIngest({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    const outcome = await dispatchCriticalTelemetry({
      tenantId: String(ctx.organizationId),
      signals: report.signals,
      minSeverity,
    });
    return apiOk({ outcome, minSeverity, generatedAt: new Date().toISOString() }, {
      correlationId,
      safetyContract: "telemetry_ingest_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "telemetry_ingest_read_only" });
  }
}

export async function GET(req: NextRequest) { return POST(req); }
