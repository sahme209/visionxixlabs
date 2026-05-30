/**
 * GET /api/workforce/attempts.csv
 *
 * Workspace-wide engineer attempt export — every gated attempt across
 * every client engineer, up to 5000 rows desc by createdAt. Optional
 * filters mirror the activity feed:
 *   ?engineer=foo         scope to a single engineer
 *   ?decision=blocked     scope to a runtime decision
 *
 * Columns include engineer_id so a flat CSV remains parseable for
 * pivot tables / spreadsheet handoff. Audit-handoff trio gets a fifth
 * file: findings + compliance + approvals + workforce/<id> + workforce
 * (this one, the cross-engineer roll-up).
 */

import { type NextRequest } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DECISIONS = new Set(["allowed", "requires_approval", "blocked"]);

function csv(field: string | number | boolean | null | undefined): string {
  if (field == null) return "";
  const s = String(field);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const ctx = await requireContext();
  const engineer = (req.nextUrl.searchParams.get("engineer") ?? "").trim();
  const decisionRaw = (req.nextUrl.searchParams.get("decision") ?? "").trim();
  const decision = DECISIONS.has(decisionRaw) ? decisionRaw : null;

  const rows = await prisma.agentEngineerActionAttempt.findMany({
    where: {
      organizationId: String(ctx.organizationId),
      ...(engineer ? { engineerId: engineer } : {}),
      ...(decision ? { runtimeDecision: decision } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      id: true,
      createdAt: true,
      engineerId: true,
      action: true,
      riskLevel: true,
      isReadOnly: true,
      runtimeDecision: true,
      effectiveRule: true,
      policySource: true,
      requiredApprovers: true,
      requestedBy: true,
      correlationId: true,
      reason: true,
      module: true,
      connector: true,
    },
  }).catch(() => []);

  const header = [
    "id", "created_at", "engineer_id", "action", "risk_level",
    "is_read_only", "runtime_decision", "effective_rule",
    "policy_source", "required_approvers", "requested_by",
    "correlation_id", "reason", "module", "connector",
  ].join(",");

  const body = rows.map((r) =>
    [
      csv(r.id),
      csv(r.createdAt.toISOString()),
      csv(r.engineerId),
      csv(r.action),
      csv(r.riskLevel),
      csv(r.isReadOnly),
      csv(r.runtimeDecision),
      csv(r.effectiveRule),
      csv(r.policySource),
      csv(r.requiredApprovers),
      csv(r.requestedBy),
      csv(r.correlationId),
      csv(r.reason),
      csv(r.module),
      csv(r.connector),
    ].join(","),
  );

  const csvBody = [header, ...body].join("\n");
  const filename = `axiom-workforce-attempts-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
