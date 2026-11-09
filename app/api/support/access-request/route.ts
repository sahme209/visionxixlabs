/**
 * POST /api/support/access-request — Ask Axiom "request access".
 * Body: { requestedRole, reason }
 * Signed-in members only. Records an access request for workspace admins
 * (audit log + webhook). It never changes a role; admins decide in Members.
 */
import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatchWebhookEvent";
import { redactSecrets } from "@/lib/ai/contextRedaction";
import { decideAccessRequest } from "@/lib/support/accessRequest";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.sessionUserId) return NextResponse.json({ ok: false, error: "sign_in_required" }, { status: 401 });
  const userId = String(ctx.sessionUserId), organizationId = String(ctx.organizationId);
  if (!checkRateLimit(`access-request:${userId}`)) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  const me = await prisma.orgMembership.findUnique({ where: { userId_organizationId: { userId, organizationId } }, select: { role: true, acceptedAt: true } }).catch(() => null);
  if (!me?.acceptedAt) return NextResponse.json({ ok: false, error: "membership_required" }, { status: 403 });
  const body = await req.json().catch(() => null) as { requestedRole?: unknown; reason?: unknown } | null;
  const d = decideAccessRequest({ requestedRole: body?.requestedRole, reason: body?.reason, currentRole: me.role });
  if (!d.ok) return NextResponse.json(d, { status: 400 });
  const reason = redactSecrets(d.reason).text;
  const recorded = await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind: "access.requested", subjectKind: "membership", subjectId: userId, summary: `${ctx.email ?? "A member"} asked for ${d.requestedRole} (currently ${me.role})`, actorUserId: userId, detailJson: { requestedRole: d.requestedRole, currentRole: me.role, reason } });
  if (!recorded) return NextResponse.json({ ok: false, error: "request_not_recorded" }, { status: 503 });
  try { await dispatchWebhookEvent({ organizationId, eventKind: "workspace.access_requested", data: { requestedRole: d.requestedRole, currentRole: me.role, reviewUrl: "/control/members" }, fireImmediately: true }); } catch { /* best-effort */ }
  return NextResponse.json({ ok: true, requested: d.requestedRole, message: "Sent to your workspace admins. They decide on the Members page; nothing changes until they do." });
}
