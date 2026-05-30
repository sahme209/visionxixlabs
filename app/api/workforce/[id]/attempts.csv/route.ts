/**
 * GET /api/workforce/[id]/attempts.csv
 *
 * Streams up to 5000 AgentEngineerActionAttempt rows for a single
 * engineer, scoped to the caller's org. Lets operators hand auditors
 * a per-engineer evidence file: "here's every gated attempt the
 * Security engineer made in 2026 Q1 and what the gate said."
 *
 * Columns:
 *   id, created_at, action, risk_level, is_read_only, runtime_decision,
 *   effective_rule, policy_source, required_approvers, requested_by,
 *   correlation_id, reason, module, connector
 *
 * Engineer id is validated against the canonical registry — a bogus
 * id returns 404 rather than dumping a zero-row CSV.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { AGENT_WORKFORCE_REGISTRY } from "@/lib/workforce/agentWorkforceRegistry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csv(field: string | number | boolean | null | undefined): string {
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

  const rows = await prisma.agentEngineerActionAttempt.findMany({
    where: {
      organizationId: String(ctx.organizationId),
      engineerId: engineer.id,
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      id: true,
      createdAt: true,
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
  }).catch(() => [] as Array<{
    id: string;
    createdAt: Date;
    action: string;
    riskLevel: string;
    isReadOnly: boolean;
    runtimeDecision: string;
    effectiveRule: string;
    policySource: string;
    requiredApprovers: number;
    requestedBy: string;
    correlationId: string;
    reason: string;
    module: string | null;
    connector: string | null;
  }>);

  const header = [
    "id", "created_at", "action", "risk_level", "is_read_only",
    "runtime_decision", "effective_rule", "policy_source",
    "required_approvers", "requested_by", "correlation_id",
    "reason", "module", "connector",
  ].join(",");

  const body = rows.map((r) =>
    [
      csv(r.id),
      csv(r.createdAt.toISOString()),
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
  const filename = `axiom-${engineer.id}-attempts-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
