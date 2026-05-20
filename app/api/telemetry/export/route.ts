/**
 * GET /api/telemetry/export
 *
 * Streams the current telemetry ingest signals as CSV. Caller picks
 * the minSeverity filter; default is "low" which captures every
 * surfaceable signal.
 *
 * Query params:
 *   - minSeverity (info | low | medium | high | critical)
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildTelemetryIngest } from "@/lib/telemetry/telemetryIngestBuilder";
import { buildTelemetrySignalCsv } from "@/lib/telemetry/telemetrySignalCsv";
import { resolveCorrelationId } from "@/lib/api";
import type { TelemetrySeverity } from "@/lib/telemetry/telemetryIngestModel";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const ALLOWED: TelemetrySeverity[] = ["critical", "high", "medium", "low", "info"];

const RANK: Record<TelemetrySeverity, number> = {
  critical: 4, high: 3, medium: 2, low: 1, info: 0,
};

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return new Response("Sign in required.", { status: 401 });
  }
  const rawSeverity = req.nextUrl.searchParams.get("minSeverity") ?? "low";
  const minSeverity: TelemetrySeverity = (ALLOWED as string[]).includes(rawSeverity)
    ? (rawSeverity as TelemetrySeverity)
    : "low";

  const report = await buildTelemetryIngest({
    tenantId: ctx.organizationId,
    actorUserId: ctx.userId,
  });

  const min = RANK[minSeverity];
  const filtered = report.signals.filter((s) => RANK[s.severity] >= min);
  const csv = buildTelemetrySignalCsv(filtered);
  const filename = `axiom-telemetry-signals-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "x-correlation-id": correlationId,
      "x-axiom-safety-contract": "telemetry_ingest_read_only",
    },
  });
}

export async function POST(req: NextRequest) { return GET(req); }
