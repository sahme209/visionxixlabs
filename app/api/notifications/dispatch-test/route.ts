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
import { createWebNotificationMutationAuthority } from "@/lib/notifications/webNotificationMutationAuthority";
import {NextResponse} from "next/server";
import { sendOutboundNotification } from "@/lib/notifications/outboundNotificationLane";
import { apiOk, apiErr, resolveCorrelationId, asApiSourceMode } from "@/lib/api";


export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const authority=await createWebNotificationMutationAuthority(req);
    await authority.beforeSend();
    const today = new Date().toISOString().slice(0, 10);
    const result = await sendOutboundNotification({
      dedupeKey: `dispatch-test:${authority.organizationId}:${today}`,
      kind: "cycle_summary",
      severity: "info",
      tenantId: String(authority.organizationId),
      headline: "Axiom outbound dispatch test",
      body: `*This is a synthetic notification.* Triggered manually from /dashboard/notifications-outbound.\n\n*Correlation:* \`${correlationId}\`\n*Dispatched at:* ${new Date().toISOString()}`,
      safeNextAction: { label: "Open Outbound Notifications", href: "/dashboard/notifications-outbound" },
      evidenceRefs: [`correlation:${correlationId}`],
    },()=>authority.beforeSend());
    return apiOk(result, {
      correlationId,
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId });
  }
}

export async function GET(_req: NextRequest) { return NextResponse.json({ok:false,error:"method_not_allowed"},{status:405,headers:{Allow:"POST","Cache-Control":"no-store"}}); }
