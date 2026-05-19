/**
 * GET /api/autonomy/rationale/export
 *
 * Streams the decision rationale rows as CSV. Compliance reviewers
 * use this for audit packets. Tenant-scoped, read-only.
 *
 * Query params:
 *   - limit   (1..1000, default 500)
 *   - outcome (optional filter)
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { readRationaleHistory } from "@/lib/autonomy/decisionRationaleStore";
import { buildRationaleCsv, type RationaleCsvRow } from "@/lib/autonomy/decisionRationaleCsv";
import { resolveCorrelationId } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return new Response("Sign in required.", { status: 401 });
  }
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const outcome = req.nextUrl.searchParams.get("outcome") || undefined;
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 500;

  const report = await readRationaleHistory({
    organizationId: String(ctx.organizationId),
    limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 1000)) : 500,
    outcome,
  });

  const csvRows: RationaleCsvRow[] = report.rows.map((r) => ({
    id: r.id,
    candidateId: r.candidateId,
    title: r.title,
    charterMode: r.charterMode,
    boundaryClass: r.boundaryClass,
    outcome: r.outcome,
    haltedAtStage: r.haltedAtStage,
    haltReason: r.haltReason,
    proposedIntent: r.proposedIntent,
    durationMs: r.durationMs,
    evidenceRefs: r.evidenceRefs,
    createdAt: r.createdAt,
  }));

  const csv = buildRationaleCsv(csvRows);
  const filename = `axiom-decision-rationale-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "x-correlation-id": correlationId,
      "x-axiom-safety-contract": "audit_read_only",
    },
  });
}

export async function POST(req: NextRequest) { return GET(req); }
