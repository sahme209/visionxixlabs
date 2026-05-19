/**
 * GET /api/notifications/history
 *
 * Returns the OutboundHistoryReport — last N outbound notification
 * sends across every channel. Backed by the OutboundNotificationRecord
 * Prisma table. Read-only.
 *
 * Query params:
 *   - limit (1..200, default 50)
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { readOutboundNotificationHistory } from "@/lib/notifications/outboundNotificationStore";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const raw = req.nextUrl.searchParams.get("limit");
    const limit = raw ? Number.parseInt(raw, 10) : undefined;
    const report = await readOutboundNotificationHistory({
      organizationId: String(ctx.organizationId),
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return apiOk(report, {
      correlationId,
      safetyContract: "notification_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "notification_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
