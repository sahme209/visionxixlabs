/**
 * GET /api/cron-health
 *
 * Returns the per-cron health snapshot from the in-memory tracker —
 * total ticks, failure count, success rate, consecutive failures.
 * Useful when something looks off in /dashboard/notifications-outbound
 * and you want to know if a cron has been silently failing.
 *
 * Read-only. No DB. Snapshot is per-process (ephemeral) — this is
 * the same trade-off the dedupe map makes. Long-term audit lives
 * in OutboundNotificationRecord.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { readCronHealth } from "@/lib/autonomy/cronHealthTracker";
import { CRON_CATALOG } from "@/lib/autonomy/cronHealthCatalog";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    const snapshots = CRON_CATALOG.map((spec) => ({
      ...spec,
      health: readCronHealth({ cronName: spec.id }),
    }));
    return apiOk({
      generatedAt: new Date().toISOString(),
      total: snapshots.length,
      snapshots,
    }, {
      correlationId,
      safetyContract: "trust_center_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "trust_center_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
