/**
 * GET /api/workforce/[id]/agi.csv — Phase 556.
 *
 * Per-engineer AGI rationale export. Scoped by the targetKinds this
 * engineer's department maps to — same mapping as the engineer
 * detail's AGI panel (Phase 550) — so an auditor handed this file
 * sees exactly what the operator saw on the surface.
 *
 * Columns:
 *   target_kind, target_id, generated_at, updated_at, outcome,
 *   model_hint, engine_version, error_message, narrative,
 *   risk_factors, next_actions
 *
 * Up to 5000 rows desc by generatedAt — same cap as every other
 * audit-handoff CSV in the platform.
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

function pipeList(v: unknown): string {
  if (!Array.isArray(v)) return "";
  return v.filter((x): x is string => typeof x === "string").join(" | ");
}

function agiKindsForDepartment(dept: string): string[] {
  if (dept === "safety" || dept === "planning" || dept === "reasoning") return ["council"];
  if (dept === "incident_response" || dept === "security" || dept === "devops" || dept === "finops" || dept === "observability") return ["triage", "remediation"];
  return ["council", "triage", "remediation"];
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

  const kinds = agiKindsForDepartment(engineer.department);
  const rows = await prisma.aiRationaleEnrichment.findMany({
    where: {
      organizationId: String(ctx.organizationId),
      targetKind: { in: kinds },
    },
    orderBy: { generatedAt: "desc" },
    take: 5000,
    select: {
      targetKind: true,
      targetId: true,
      generatedAt: true,
      updatedAt: true,
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
    "target_kind", "target_id", "generated_at", "updated_at",
    "outcome", "model_hint", "engine_version", "error_message",
    "narrative", "risk_factors", "next_actions",
  ].join(",");

  const body = rows.map((r) =>
    [
      csv(r.targetKind),
      csv(r.targetId),
      csv(r.generatedAt.toISOString()),
      csv(r.updatedAt.toISOString()),
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
  const filename = `axiom-${engineer.id}-agi-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
