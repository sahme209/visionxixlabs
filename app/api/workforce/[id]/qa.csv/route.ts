/**
 * GET /api/workforce/[id]/qa.csv — Phase 569.
 *
 * Per-engineer Q&A history export. Up to 5000 engineer_qa rows for
 * the engineer, desc by generatedAt. Operators handing off audits
 * get the full conversation context, not just the latest exchange.
 *
 * Columns:
 *   target_id, generated_at, outcome, model_hint, error_message,
 *   question, answer
 *
 * The persistence model stashes the operator question on
 * riskFactorsJson[0], so the CSV extracts it back into its own
 * column for spreadsheet readability.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { AGENT_WORKFORCE_REGISTRY } from "@/lib/workforce/agentWorkforceRegistry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csv(field: string | number | null | undefined): string {
  if (field == null) return "";
  const s = String(field);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireContext();
  const { id } = await params;
  const engineer = AGENT_WORKFORCE_REGISTRY.find((e) => e.id === id);
  if (!engineer || engineer.productLayer !== "client") {
    return NextResponse.json({ error: "engineer not found" }, { status: 404 });
  }

  const rows = await prisma.aiRationaleEnrichment.findMany({
    where: {
      organizationId: String(ctx.organizationId),
      targetKind: "engineer_qa",
      targetId: { startsWith: `${engineer.id}:` },
    },
    orderBy: { generatedAt: "desc" },
    take: 5000,
    select: {
      targetId: true,
      generatedAt: true,
      outcome: true,
      modelHint: true,
      errorMessage: true,
      narrative: true,
      riskFactorsJson: true,
    },
  }).catch(() => []);

  const header = [
    "target_id", "generated_at", "outcome", "model_hint",
    "error_message", "question", "answer",
  ].join(",");

  const body = rows.map((r) => {
    const question = Array.isArray(r.riskFactorsJson) && typeof r.riskFactorsJson[0] === "string"
      ? r.riskFactorsJson[0]
      : "";
    return [
      csv(r.targetId),
      csv(r.generatedAt.toISOString()),
      csv(r.outcome),
      csv(r.modelHint),
      csv(r.errorMessage),
      csv(question),
      csv(r.narrative),
    ].join(",");
  });

  const csvBody = [header, ...body].join("\n");
  const filename = `axiom-${engineer.id}-qa-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
