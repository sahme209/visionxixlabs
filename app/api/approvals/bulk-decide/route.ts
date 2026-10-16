/** Dashboard batch decisions. Each item uses the same tenant/revision CAS as
 * single-item decisions; response counts and audits include committed wins only. */
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
  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  const { action, itemIds } = body as Record<string, unknown>;
  if (action !== "approve" && action !== "reject") return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  const ids = Array.isArray(itemIds) ? itemIds.filter((value): value is string => typeof value === "string") : [];
  if (ids.length === 0 || ids.length > 100) return NextResponse.json({ ok: false, error: "invalid_items", message: "Select between one and 100 approval items." }, { status: 400 });

  let processed = 0;
  let skipped = 0;
  const correlationId = `bulk_${Date.now().toString(36)}` as CorrelationId;
  for (const itemId of ids) {
    let decision;
    try { decision = await decideItem({ itemId, organizationId: ctx.organizationId, userId: ctx.userId, action }); }
    catch {
      // Earlier acknowledged decisions remain committed. A storage error does
      // not prove this item was untouched; never fabricate a successful count.
      return NextResponse.json({ ok: false, error: "decision_unconfirmed", processed, skipped, message: "Refresh approval state before retrying the remaining items." }, { status: 503 });
    }
    if (!decision.success) { skipped++; continue; }
    processed++;
    try {
      await auditRecord({ organizationId: ctx.organizationId, actorUserId: ctx.userId, action: action === "approve" ? "approval.grant" : "approval.deny", outcome: "success",
        entityRef: `approval:${itemId}`, correlationId, detail: { nextStatus: decision.item.status, bulk: true } });
    } catch { /* Audit failure must not roll back or duplicate a committed decision. */ }
  }
  return NextResponse.json({ ok: true, processed, skipped });
}
