/**
 * GET /api/cron/expire-approvals — hourly cron.
 *
 * Two passes:
 *   1. Sweep AxiomApprovalItem rows that have been pending for 7+
 *      days and flip them to "expired". Keeps the approval queue
 *      honest — stale recommendations don't sit at the top of the
 *      dashboard forever.
 *   2. Reactivate snoozed rows whose snoozedUntil has passed back
 *      into "pending" so the operator sees them again.
 *
 * Auth: Vercel sets CRON_SECRET as an env var; this route checks
 * it via Authorization: Bearer when set. Audits an
 * 'engineer.approval_expired' event per expired item.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);
  const correlationId = `expire_${Date.now().toString(36)}` as CorrelationId;

  let stale: Array<{ id: string; organizationId: string; title: string }> = [];
  try {
    stale = await prisma.axiomApprovalItem.findMany({
      where: {
        status: "pending",
        createdAt: { lt: cutoff },
      },
      take: 200, // bound the per-tick blast radius
      select: { id: true, organizationId: true, title: true },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      return NextResponse.json({ ok: true, expired: 0, migrationPending: true });
    }
    throw err;
  }

  if (stale.length === 0) {
    return NextResponse.json({ ok: true, expired: 0, sweptAt: new Date().toISOString() });
  }

  await prisma.axiomApprovalItem.updateMany({
    where: { id: { in: stale.map((s) => s.id) } },
    data: { status: "expired" },
  });

  // Fire one audit row per expired item so the trail shows what
  // dropped off the queue and why.
  for (const item of stale) {
    void auditRecord({
      organizationId: ids.organization(item.organizationId),
      action: "engineer.approval_expired",
      outcome: "success",
      entityRef: `approval:${item.id}`,
      correlationId,
      detail: { title: item.title, ageDays: 7, trigger: "cron" },
    });
  }

  // Pass 2: reactivate snoozed items whose timer expired.
  let reactivated = 0;
  try {
    const result = await prisma.axiomApprovalItem.updateMany({
      where: {
        status: "snoozed",
        snoozedUntil: { lte: new Date() },
      },
      data: { status: "pending", snoozedUntil: null },
    });
    reactivated = result.count;
  } catch (err) {
    console.warn("[expire-approvals] reactivate pass failed:", err instanceof Error ? err.message : err);
  }

  return NextResponse.json({
    ok: true,
    expired: stale.length,
    reactivated,
    sweptAt: new Date().toISOString(),
  });
}
