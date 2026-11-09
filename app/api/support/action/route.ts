/**
 * POST /api/support/action — Ask Axiom governed actions (support roadmap step 4).
 * Body: { action, confirmed }   `confirmed` must equal `action`.
 *
 * Signed-in, accepted members of the current workspace only. The pure kernel
 * (lib/support/supportActions.ts) decides: closed action set, allowed roles,
 * exact-action confirmation. Each run is recorded in the audit log with the
 * person who asked Ask Axiom to do it.
 */
import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { sealOrganizationAudit, verifyOrganizationAudit } from "@/lib/audit/sealService";
import { decideSupportAction } from "@/lib/support/supportActions";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.sessionUserId) return NextResponse.json({ ok: false, error: "sign_in_required" }, { status: 401 });
  const userId = String(ctx.sessionUserId), organizationId = String(ctx.organizationId);
  if (!checkRateLimit(`support-action:${userId}`)) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  const me = await prisma.orgMembership.findUnique({ where: { userId_organizationId: { userId, organizationId } }, select: { role: true, acceptedAt: true } }).catch(() => null);
  if (!me?.acceptedAt) return NextResponse.json({ ok: false, error: "membership_required" }, { status: 403 });
  const body = await req.json().catch(() => null) as { action?: unknown; confirmed?: unknown } | null;
  const d = decideSupportAction({ action: body?.action, role: me.role, confirmed: body?.confirmed });
  if (!d.ok) return NextResponse.json(d, { status: d.error === "role_not_allowed" ? 403 : 400 });

  let result: { ok: boolean; message: string; detail: Record<string, unknown> };
  try {
    if (d.action === "seal_audit_log") {
      const r = await sealOrganizationAudit(organizationId);
      if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 409, headers: NO_STORE });
      result = r.sealed
        ? { ok: true, message: `Sealed ${r.sealed.eventCount} audit events as seal #${r.sealed.sequence}.`, detail: { sequence: r.sealed.sequence, eventCount: r.sealed.eventCount } }
        : { ok: true, message: "Nothing new to seal. Events from the last few minutes are sealed on the next run.", detail: { sequence: null } };
    } else {
      const r = await verifyOrganizationAudit(organizationId);
      const broken = r.verdicts.filter((v) => v.status !== "intact").length;
      result = r.sealCount === 0
        ? { ok: true, message: "There are no seals yet, so there is nothing to verify. Seal the audit log first.", detail: { sealCount: 0 } }
        : r.intact
          ? { ok: true, message: `All ${r.sealCount} seals are intact.`, detail: { sealCount: r.sealCount, intact: true } }
          : { ok: true, message: `${broken} of ${r.sealCount} seals do not match their events. Open Trust tools for details; your integrity webhook has been notified.`, detail: { sealCount: r.sealCount, intact: false, broken } };
    }
  } catch {
    return NextResponse.json({ ok: false, error: "action_unavailable" }, { status: 503, headers: NO_STORE });
  }

  try {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind: "support.action_run", subjectKind: "support_action", subjectId: d.action, summary: `${ctx.email ?? "A member"} asked Ask Axiom to ${d.info.label.toLowerCase()}`, actorUserId: userId, detailJson: { action: d.action, role: me.role, ...result.detail } });
  } catch { /* best-effort */ }
  return NextResponse.json({ ok: true, action: d.action, message: result.message, href: "/control/trust-tools" }, { headers: NO_STORE });
}
