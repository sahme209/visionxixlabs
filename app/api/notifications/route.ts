/**
 * GET /api/notifications
 *
 * Returns the canonical Notification Report via the canonical API
 * envelope. Pure read-only. Tenant-scoped.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildNotifications } from "@/lib/notifications/notificationBuilder";
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
    const report = await buildNotifications({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    const firstMode = report.notifications[0]?.sourceMode ?? "preview";
    return apiOk(report, {
      correlationId,
      safetyContract: "notification_read_only",
      sourceMode: asApiSourceMode(firstMode),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "notification_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
