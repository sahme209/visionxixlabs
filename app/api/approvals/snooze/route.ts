/** Form-only dashboard snooze. Decisions share the tenant/revision CAS kernel. */
import { NextResponse, type NextRequest } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { canDecideApprovals } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { decideItem } from "@/lib/axiom/approvalCenter";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ ok: false, error: "invalid_request_origin" }, { status: 403 });
  const ctx = await requireContext();
  if (!canDecideApprovals({ email: ctx.email, roles: ctx.roles })) return NextResponse.json({ ok: false, error: "forbidden_role" }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const itemId = form?.get("itemId");
  const days = form?.get("days");
  if (typeof itemId !== "string" || (days !== "1" && days !== "7")) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });

  let decision;
  try {
    decision = await decideItem({ itemId, organizationId: ctx.organizationId, userId: ctx.userId, action: "snooze", snoozeDays: Number(days) });
  } catch {
    return NextResponse.json({ ok: false, error: "decision_unconfirmed", message: "Refresh approval state before retrying." }, { status: 503 });
  }
  if (!decision.success) return NextResponse.json({ ok: false, error: decision.item.status === "unavailable" ? "not_found" : "decision_conflict" }, { status: decision.item.status === "unavailable" ? 404 : 409 });
  try {
    await auditRecord({ organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "engineer.approval_voted", outcome: "success",
      entityRef: `approval:${itemId}`, correlationId: `snooze_${Date.now().toString(36)}` as CorrelationId,
      detail: { decision: "snooze", days: Number(days) } });
  } catch { /* The committed snooze remains valid when audit storage is unavailable. */ }
  let destination = new URL("/dashboard/approvals", req.url);
  try { const referrer = new URL(req.headers.get("referer") ?? "", req.url); if (referrer.origin === req.nextUrl.origin && req.headers.has("referer")) destination = referrer; } catch { /* use queue */ }
  return NextResponse.redirect(destination, 303);
}
