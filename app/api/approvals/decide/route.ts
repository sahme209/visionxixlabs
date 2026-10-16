import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
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
import { canDecideApprovals } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: "invalid_request_origin" }, { status: 403 });
  }
  const ctx = await requireContext();
  if (!canDecideApprovals({ email: ctx.email, roles: ctx.roles })) {
    return NextResponse.json({ ok: false, error: "forbidden_role" }, { status: 403 });
  }
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
    select: { id: true, organizationId: true, status: true, updatedAt: true, title: true },
  });
  if (!item || item.organizationId !== ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (item.status !== "pending" && item.status !== "snoozed") {
    return NextResponse.json({ ok: false, error: "not_actionable", current: item.status }, { status: 409 });
  }

  const nextStatus = action === "approve" ? "approved" : "rejected";
  const decision = await prisma.axiomApprovalItem.updateMany({
    where: { id: itemId, organizationId: ctx.organizationId, status: item.status, updatedAt: item.updatedAt },
    data: { status: nextStatus, decidedBy: ctx.userId, decidedAt: new Date(), snoozedUntil: null },
  });
  if (decision.count !== 1) {
    return NextResponse.json({ ok: false, error: "decision_conflict" }, { status: 409 });
  }

  // Map UI vocabulary (approve/reject) → AuditAction enum (grant/deny).
  const auditActionName = action === "approve" ? "approval.grant" as const : "approval.deny" as const;
  try {
    await auditRecord({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: auditActionName,
      outcome: "success",
      entityRef: `approval:${itemId}`,
      correlationId,
      detail: { title: item.title, nextStatus },
    });
  } catch { /* The committed decision remains authoritative during audit outages. */ }

  // Redirect back to the queue so the page re-renders with the
  // updated status. Same-origin POST → 303 lets the browser switch
  // to GET on the way back.
  const destination = new URL("/dashboard/approvals", req.url);
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const candidate = new URL(referer);
      if (candidate.origin === destination.origin && candidate.pathname === destination.pathname && !candidate.username && !candidate.password) {
        destination.search = candidate.search;
      }
    } catch { /* Missing or malformed navigation metadata must not fail a committed decision. */ }
  }
  return NextResponse.redirect(destination, 303);
}
