import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId, OrganizationId, UserId } from "@/lib/domain/ids";
import { prisma } from "@/lib/db";
import { buildWebhookEnvelope } from "@/lib/webhooks/buildWebhookPayload";
import { deliverWebhookDelivery } from "@/lib/webhooks/deliverWebhook";
import { workspaceUnenrolled } from "@/lib/governance/intelligence/enrolledRefusal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: noStore });
const PING_INTERVAL_MS = 60_000;

/**
 * Sends one signed `webhook.ping` delivery to a workspace webhook so an owner or admin can check the
 * receiver and its signature check. The ping is sent once and never retried, does not count toward
 * auto-disable, and at most one ping per webhook per minute is allowed.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.userId || !c.roles.length) return fail("workspace_membership_required", 403);
  if (!isAdminOrOwner({ email: c.email, roles: c.roles })) return fail("workspace_admin_required", 403);
  const { id } = await params;
  if (!id || id.length > 64) return fail("webhook_not_found", 404);
  const organizationId = String(c.organizationId);
  try {
    const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id, organizationId, revokedAt: null }, select: { id: true, name: true } });
    if (!endpoint) return fail("webhook_not_found", 404);
    const recent = await prisma.webhookDelivery.findFirst({ where: { endpointId: id, organizationId, eventKind: "webhook.ping", createdAt: { gte: new Date(Date.now() - PING_INTERVAL_MS) } }, select: { id: true } });
    if (recent) return fail("ping_rate_limited", 429);
    // While Governance enrollment holds non-security deliveries, a test would only sit in the queue.
    if (!await workspaceUnenrolled(organizationId)) return fail("governance_enrolled_delivery_paused", 409);
    const eventId = `evt_${randomBytes(12).toString("base64url")}`;
    const envelope = buildWebhookEnvelope({ eventId, type: "webhook.ping", organizationId, data: { webhookName: endpoint.name, message: "Test delivery from the V19 Webhooks page." }, attemptNumber: 1, timestampSec: Math.floor(Date.now() / 1000) });
    const row = await prisma.webhookDelivery.create({ data: { endpointId: id, organizationId, eventId, eventKind: "webhook.ping", attemptNumber: 1, status: "queued", payload: envelope as unknown as object }, select: { id: true } });
    const result = await deliverWebhookDelivery(row.id);
    try { await auditRecord({ organizationId: organizationId as OrganizationId, actorUserId: String(c.userId) as UserId, action: "governance.update", outcome: "success", entityRef: `webhook_endpoint:${id}`, correlationId: randomUUID() as CorrelationId, detail: { kind: "webhook.ping", outcomeKind: result?.outcomeKind ?? "unknown" } }); } catch { /* best-effort */ }
    const after = await prisma.webhookDelivery.findUnique({ where: { id: row.id }, select: { status: true, httpStatus: true } });
    return NextResponse.json({ ok: true, data: { eventId, outcomeKind: result?.outcomeKind ?? "unknown", status: after?.status ?? "unknown", httpStatus: after?.httpStatus ?? null } }, { headers: noStore });
  } catch {
    return fail("webhook_test_unavailable", 503);
  }
}
