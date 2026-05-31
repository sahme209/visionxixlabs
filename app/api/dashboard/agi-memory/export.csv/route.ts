/**
 * GET /api/dashboard/agi-memory/export.csv — Phase 540.
 *
 * Audit-handoff CSV for the AGI's cross-engine rationale memory.
 * Up to 5000 rows from AiRationaleEnrichment for the caller's org,
 * desc by generatedAt.
 *
 * Filters mirror the live surface:
 *   ?targetKind=council|triage|remediation   scope to one kind
 *
 * Columns:
 *   id, generated_at, updated_at, target_kind, target_id, outcome,
 *   model_hint, engine_version, error_message, narrative,
 *   risk_factors, next_actions
 *
 * Risk-factors / next-actions render as pipe-delimited so the row
 * stays a single CSV row. Narrative gets CSV-escaped (quotes +
 * newlines preserved).
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KIND_SET = new Set(["council", "triage", "remediation"]);

function csv(field: string | number | null | undefined): string {
  if (field == null) return "";
  const s = String(field);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function pipeList(v: unknown): string {
  if (!Array.isArray(v)) return "";
  return v.filter((x): x is string => typeof x === "string").join(" | ");
}

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const targetKindRaw = req.nextUrl.searchParams.get("targetKind");
  const targetKind = targetKindRaw && KIND_SET.has(targetKindRaw) ? targetKindRaw : null;

  const rows = await prisma.aiRationaleEnrichment.findMany({
    where: {
      organizationId: String(ctx.organizationId),
      ...(targetKind ? { targetKind } : {}),
    },
    orderBy: { generatedAt: "desc" },
    take: 5000,
    select: {
      id: true,
      generatedAt: true,
      updatedAt: true,
      targetKind: true,
      targetId: true,
      outcome: true,
      modelHint: true,
      engineVersion: true,
      errorMessage: true,
      narrative: true,
      riskFactorsJson: true,
      nextActionsJson: true,
    },
  }).catch(() => []);

  const header = [
    "id", "generated_at", "updated_at", "target_kind", "target_id",
    "outcome", "model_hint", "engine_version", "error_message",
    "narrative", "risk_factors", "next_actions",
  ].join(",");

  const body = rows.map((r) =>
    [
      csv(r.id),
      csv(r.generatedAt.toISOString()),
      csv(r.updatedAt.toISOString()),
      csv(r.targetKind),
      csv(r.targetId),
      csv(r.outcome),
      csv(r.modelHint),
      csv(r.engineVersion),
      csv(r.errorMessage),
      csv(r.narrative),
      csv(pipeList(r.riskFactorsJson)),
      csv(pipeList(r.nextActionsJson)),
    ].join(","),
  );

  const csvBody = [header, ...body].join("\n");
  const filename = `axiom-agi-memory-${targetKind ?? "all"}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
