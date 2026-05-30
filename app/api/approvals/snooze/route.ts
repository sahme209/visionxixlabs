/**
 * POST /api/approvals/snooze
 *
 * Snoozes a pending approval for N days. Items snoozed past their
 * snoozedUntil are returned to 'pending' by the hourly cron worker.
 *
 * Form-encoded body (so the page can stay a server component):
 *   itemId: string
 *   days:   "1" | "7" — clamps to those two for now
 *
 * Transitions pending → snoozed and sets snoozedUntil. Audits via
 * the existing AuditAction union.
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
  const correlationId = `snooze_${Date.now().toString(36)}` as CorrelationId;

  const form = await req.formData().catch(() => null);
  const itemId = form?.get("itemId");
  const daysStr = form?.get("days");
  if (typeof itemId !== "string" || (daysStr !== "1" && daysStr !== "7")) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  const days = Number(daysStr);

  const item = await prisma.axiomApprovalItem.findUnique({
    where: { id: itemId },
    select: { id: true, organizationId: true, status: true, title: true },
  });
  if (!item || item.organizationId !== ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (item.status !== "pending") {
    return NextResponse.json({ ok: false, error: "not_pending", current: item.status }, { status: 409 });
  }

  const snoozedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await prisma.axiomApprovalItem.update({
    where: { id: itemId },
    data: { status: "snoozed", snoozedUntil },
  });

  // Re-use an existing enum — 'engineer.approval_voted' captures the
  // 'human did something to this item' semantics. The detail discriminates.
  void auditRecord({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "engineer.approval_voted",
    outcome: "success",
    entityRef: `approval:${itemId}`,
    correlationId,
    detail: { title: item.title, decision: "snooze", days, snoozedUntil: snoozedUntil.toISOString() },
  });

  const referer = req.headers.get("referer") ?? "/dashboard/approvals";
  return NextResponse.redirect(referer, 303);
}
