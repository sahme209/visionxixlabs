/**
 * GET /api/approvals/export.csv
 *
 * Streams an org-scoped approvals CSV — up to 5000 rows. Optional
 * ?status filter lets auditors pull only applied + approved items
 * for an evidence package, or only pending/expired for a backlog
 * review.
 *
 * Columns:
 *   id, created_at, decided_at, status, risk_level, action_type,
 *   provider, region, title, disposition_reason, monthly_low,
 *   monthly_high, decided_by, run_id, plan_item_id
 *
 * Matches the column shape of /api/findings/export.csv so the three
 * audit-handoff CSVs (findings, compliance, approvals) line up.
 */

import { type NextRequest } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Status = "pending" | "approved" | "rejected" | "snoozed" | "applied" | "failed" | "expired";

function clampStatus(input: string | null): Status | null {
  if (
    input === "pending" || input === "approved" || input === "rejected" ||
    input === "snoozed" || input === "applied" || input === "failed" ||
    input === "expired"
  ) return input;
  return null;
}

function csv(field: string | number | null | undefined): string {
  if (field == null) return "";
  const s = String(field);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const ctx = await requireContext();
  const statusFilter = clampStatus(req.nextUrl.searchParams.get("status"));

  const items = await prisma.axiomApprovalItem.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      id: true,
      createdAt: true,
      decidedAt: true,
      status: true,
      riskLevel: true,
      actionType: true,
      provider: true,
      region: true,
      title: true,
      dispositionReason: true,
      monthlyLow: true,
      monthlyHigh: true,
      decidedBy: true,
      runId: true,
      planItemId: true,
    },
  });

  const header = [
    "id", "created_at", "decided_at", "status", "risk_level", "action_type",
    "provider", "region", "title", "disposition_reason", "monthly_low",
    "monthly_high", "decided_by", "run_id", "plan_item_id",
  ].join(",");

  const rows = items.map((i) =>
    [
      csv(i.id),
      csv(i.createdAt.toISOString()),
      csv(i.decidedAt ? i.decidedAt.toISOString() : null),
      csv(i.status),
      csv(i.riskLevel),
      csv(i.actionType),
      csv(i.provider),
      csv(i.region),
      csv(i.title),
      csv(i.dispositionReason),
      csv(i.monthlyLow),
      csv(i.monthlyHigh),
      csv(i.decidedBy),
      csv(i.runId),
      csv(i.planItemId),
    ].join(","),
  );

  const csvBody = [header, ...rows].join("\n");
  const filename = `axiom-approvals-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
