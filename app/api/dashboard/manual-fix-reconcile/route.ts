/**
 * POST /api/dashboard/manual-fix-reconcile — Phase 495.
 * Body: { fixId, outcome: "reconciled" | "wont_fix", reconciliationRef? }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildManualFixReconcileResponse,
  type ManualFixRepo,
} from "@/lib/releaseops/manualFixResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  let body: { fixId?: unknown; outcome?: unknown; reconciliationRef?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const fixId = typeof body.fixId === "string" ? body.fixId : null;
  const outcome = body.outcome === "reconciled" || body.outcome === "wont_fix" ? body.outcome : null;

  if (!fixId || !outcome) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { fixId, outcome: 'reconciled' | 'wont_fix', reconciliationRef? }." },
      { status: 400 },
    );
  }

  const r = await buildManualFixReconcileResponse(
    prisma as unknown as ManualFixRepo,
    {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      fixId, outcome,
      ...(typeof body.reconciliationRef === "string" ? { reconciliationRef: body.reconciliationRef } : {}),
    },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "manual_fix.reconcile",
      subjectKind: "manual_fix",
      subjectId: fixId,
      summary: outcome === "reconciled"
        ? `Reconciled manual fix${typeof body.reconciliationRef === "string" && body.reconciliationRef ? ` via ${body.reconciliationRef}` : ""}`
        : "Marked manual fix as won't fix",
      outcome: "ok",
      actorUserId: ctx.userId,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}
