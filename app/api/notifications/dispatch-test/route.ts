/**
 * POST /api/notifications/dispatch-test
 *
 * Sends a synthetic test notification through every configured outbound
 * channel. Lets operators verify Slack/Teams webhook delivery without
 * waiting for a real autonomy halt or telemetry signal.
 *
 * Dedupe key is per-tenant + per-day so repeat clicks within 10 minutes
 * still suppress as designed (proves the dedupe path too).
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { sendOutboundNotification } from "@/lib/notifications/outboundNotificationLane";
import { apiOk, apiErr, resolveCorrelationId, asApiSourceMode } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const today = new Date().toISOString().slice(0, 10);
    const result = await sendOutboundNotification({
      dedupeKey: `dispatch-test:${ctx.organizationId}:${today}`,
      kind: "cycle_summary",
      severity: "info",
      tenantId: String(ctx.organizationId),
      headline: "Axiom outbound dispatch test",
      body: `*This is a synthetic notification.* Triggered manually from /dashboard/notifications-outbound.\n\n*Correlation:* \`${correlationId}\`\n*Dispatched at:* ${new Date().toISOString()}`,
      safeNextAction: { label: "Open Outbound Notifications", href: "/dashboard/notifications-outbound" },
      evidenceRefs: [`correlation:${correlationId}`],
    });
    return apiOk(result, {
      correlationId,
      safetyContract: "notification_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "notification_read_only" });
  }
}

export async function GET(req: NextRequest) { return POST(req); }
