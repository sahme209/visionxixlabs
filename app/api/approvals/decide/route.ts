/**
 * POST /api/approvals/decide
 *
 * Server-action target for the Approve / Reject buttons on
 * /dashboard/approvals. Accepts application/x-www-form-urlencoded
 * with itemId + action so the page can stay a server component (no
 * client-side fetch required).
 *
 * Transitions:
 *   pending → approved   (when action === "approve")
 *   pending → rejected   (when action === "reject")
 *
 * Approve does NOT execute against AWS yet — that's gated until the
 * first real executor is registered. Status flips to 'approved' and
 * the audit row records who decided. A future commit can poll
 * approved items and dispatch them to the executor pipeline.
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ctx = await requireContext();
  const correlationId = `approve_${Date.now().toString(36)}` as CorrelationId;

  // Accept form-encoded so the approval page can use a plain
  // <form action> without client-side JS.
  const form = await req.formData().catch(() => null);
  const itemId = form?.get("itemId");
  const action = form?.get("action");
  if (typeof itemId !== "string" || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  // Verify the item belongs to the caller's org before mutating.
  const item = await prisma.axiomApprovalItem.findUnique({
    where: { id: itemId },
    select: { id: true, organizationId: true, status: true, title: true },
  });
  if (!item || item.organizationId !== ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (item.status !== "pending" && item.status !== "snoozed") {
    return NextResponse.json({ ok: false, error: "not_actionable", current: item.status }, { status: 409 });
  }

  const nextStatus = action === "approve" ? "approved" : "rejected";
  await prisma.axiomApprovalItem.update({
    where: { id: itemId },
    data: { status: nextStatus },
  });

  await auditRecord({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: `approval.${action}`,
    outcome: "success",
    entityRef: `approval:${itemId}`,
    correlationId,
    detail: { title: item.title, nextStatus },
  });

  // Redirect back to the queue so the page re-renders with the
  // updated status. Same-origin POST → 303 lets the browser switch
  // to GET on the way back.
  const referer = req.headers.get("referer") ?? "/dashboard/approvals";
  return NextResponse.redirect(referer, 303);
}
