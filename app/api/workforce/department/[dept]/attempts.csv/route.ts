/**
 * GET /api/workforce/department/[dept]/attempts.csv
 *
 * Department-scoped attempt export — every gated attempt across every
 * engineer in one department, up to 5000 rows desc by createdAt.
 *
 * Department slug is validated against the registry's client engineers
 * — an unknown department returns 404 instead of dumping a zero-row
 * file. Resolved engineer ids are passed to AgentEngineerActionAttempt
 * via `engineerId: { in: [...] }`, so the query stays sargable on the
 * engineerId index.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  AGENT_WORKFORCE_REGISTRY,
  type WorkforceDepartment,
} from "@/lib/workforce/agentWorkforceRegistry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEPARTMENT_SET = new Set<WorkforceDepartment>([
  "perception", "reasoning", "planning", "safety", "verification",
  "memory", "workflow", "devops", "database", "security", "finops",
  "observability", "incident_response", "marketing", "sales",
]);

function clampDept(input: string): WorkforceDepartment | null {
  return DEPARTMENT_SET.has(input as WorkforceDepartment) ? (input as WorkforceDepartment) : null;
}

function csv(field: string | number | boolean | null | undefined): string {
  if (field == null) return "";
  const s = String(field);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dept: string }> },
) {
  const ctx = await requireContext();
  const { dept: deptRaw } = await params;
  const dept = clampDept(deptRaw);
  if (!dept) {
    return NextResponse.json({ error: "department not found" }, { status: 404 });
  }
  const engineerIds = AGENT_WORKFORCE_REGISTRY
    .filter((e) => e.productLayer === "client" && e.department === dept)
    .map((e) => e.id);
  if (engineerIds.length === 0) {
    return NextResponse.json({ error: "department has no client engineers" }, { status: 404 });
  }

  const rows = await prisma.agentEngineerActionAttempt.findMany({
    where: {
      organizationId: String(ctx.organizationId),
      engineerId: { in: engineerIds },
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
  const filename = `axiom-workforce-${dept}-attempts-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
