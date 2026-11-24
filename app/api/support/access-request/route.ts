/**
 * POST /api/support/access-request — Ask Axiom "request access".
 * Body: { requestedRole, reason }
 * Signed-in members only. Records an access request for workspace admins
 * (audit log + webhook). It never changes a role; admins decide in Members.
 */
import { randomUUID } from "node:crypto";
import { readBoundedRequestJson } from "@/lib/api/readBoundedRequestJson";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatchWebhookEvent";
import { redactSecrets } from "@/lib/ai/contextRedaction";
import { decideAccessRequest } from "@/lib/support/accessRequest";

export const dynamic = "force-dynamic";

function reply(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) return reply({ ok: false, error: "same_origin_required" }, 403);
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.sessionUserId) return reply({ ok: false, error: "sign_in_required" }, 401);
  const userId = String(ctx.sessionUserId), organizationId = String(ctx.organizationId);
  if (!checkRateLimit(`access-request:${userId}`)) return reply({ ok: false, error: "rate_limited" }, 429);
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(5_000)]);
  const body = await readBoundedRequestJson(req, signal, 4096).catch(() => null) as { requestedRole?: unknown; reason?: unknown } | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ ok: false, error: "invalid_payload" }, 400);
  const me = await prisma.orgMembership.findUnique({ where: { userId_organizationId: { userId, organizationId } }, select: { role: true, acceptedAt: true } }).catch(() => null);
  if (!me?.acceptedAt) return reply({ ok: false, error: "membership_required" }, 403);
  const d = decideAccessRequest({ requestedRole: body.requestedRole, reason: body.reason, currentRole: me.role });
  if (!d.ok) return reply(d, 400);
  const reason = redactSecrets(d.reason).text;
  const referenceId = `access_${randomUUID()}`;
  const recorded = await appendAuditEvent(prisma as unknown as AuditEventRepo, {
    organizationId, kind: "access.requested", subjectKind: "membership", subjectId: userId,
    summary: `${ctx.email ?? "A member"} asked for ${d.requestedRole} (currently ${me.role})`,
    actorUserId: userId, correlationId: referenceId, detailJson: { requestedRole: d.requestedRole, currentRole: me.role, reason },
  });
  if (!recorded) return reply({ ok: false, error: "request_not_recorded" }, 503);
  try {
    await dispatchWebhookEvent({ organizationId, eventKind: "workspace.access_requested",
      data: { requestedRole: d.requestedRole, currentRole: me.role, reviewUrl: "/control/members" }, fireImmediately: true });
  } catch { /* The audit record, rather than notification delivery, confirms receipt. */ }
  return reply({ ok: true, requested: d.requestedRole, referenceId,
    message: "Request recorded. A workspace admin can review it in Members." });
}
