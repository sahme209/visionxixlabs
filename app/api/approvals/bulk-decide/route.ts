/**
 * POST /api/approvals/bulk-decide
 *
 * Accept multiple itemIds + one action ("approve" | "reject") and
 * transition all matching pending|snoozed AxiomApprovalItem rows
 * in a single round-trip. Tenant-scoped: rows belonging to other
 * orgs are silently filtered out before mutation. Audit one row per
 * approved/rejected item.
 *
 * Request body (JSON):
 *   { itemIds: string[], action: "approve" | "reject" }
 *
 * Response:
 *   { ok: true, processed: number, skipped: number }
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
  const ctx = await requireContext();
  if (!canDecideApprovals({ email: ctx.email, roles: ctx.roles })) {
    return NextResponse.json({ ok: false, error: "forbidden_role" }, { status: 403 });
  }
  const correlationId = `bulk_${Date.now().toString(36)}` as CorrelationId;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  }
  const ids = Array.isArray(body.itemIds)
    ? body.itemIds.filter((v): v is string => typeof v === "string")
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "no_items" }, { status: 400 });
  }

  // Filter to the caller's org + actionable statuses before mutation.
  const eligible = await prisma.axiomApprovalItem.findMany({
    where: {
      id: { in: ids },
      organizationId: ctx.organizationId,
      status: { in: ["pending", "snoozed"] },
    },
    select: { id: true, title: true },
  });

  if (eligible.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, skipped: ids.length });
  }

  const nextStatus = action === "approve" ? "approved" : "rejected";
  await prisma.axiomApprovalItem.updateMany({
    where: { id: { in: eligible.map((e) => e.id) } },
    data: { status: nextStatus },
  });

  // Audit one row per item — fire-and-forget so the response is fast.
  // Map UI vocabulary (approve/reject) → AuditAction enum (grant/deny).
  const auditActionName = action === "approve" ? "approval.grant" as const : "approval.deny" as const;
  for (const item of eligible) {
    void auditRecord({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: auditActionName,
      outcome: "success",
      entityRef: `approval:${item.id}`,
      correlationId,
      detail: { title: item.title, nextStatus, bulk: true },
    });
  }

  return NextResponse.json({
    ok: true,
    processed: eligible.length,
    skipped: ids.length - eligible.length,
  });
}
