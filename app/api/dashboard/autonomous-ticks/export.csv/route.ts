/**
 * GET /api/dashboard/autonomous-ticks/export.csv — Phase 542.
 *
 * Audit-handoff CSV for the AutonomousTickLog feed. Up to 5000 rows
 * desc by generatedAt for the caller's org.
 *
 * Columns:
 *   id, generated_at, total_runs, ok_runs, error_runs, skipped_runs,
 *   report_json
 *
 * report_json is a single quoted CSV field so the JSON survives
 * pivot-table import. Operators want this for "show me every AGI
 * decision the platform made on its own last quarter" audits.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csv(field: string | number | null | undefined): string {
  if (field == null) return "";
  const s = String(field);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const rows = await prisma.autonomousTickLog.findMany({
    where: { organizationId: String(ctx.organizationId) },
    orderBy: { generatedAt: "desc" },
    take: 5000,
    select: {
      id: true,
      generatedAt: true,
      totalRuns: true,
      okRuns: true,
      errorRuns: true,
      skippedRuns: true,
      reportJson: true,
    },
  }).catch(() => []);

  const header = [
    "id", "generated_at", "total_runs", "ok_runs",
    "error_runs", "skipped_runs", "report_json",
  ].join(",");

  const body = rows.map((r) =>
    [
      csv(r.id),
      csv(r.generatedAt.toISOString()),
      csv(r.totalRuns),
      csv(r.okRuns),
      csv(r.errorRuns),
      csv(r.skippedRuns),
      csv(JSON.stringify(r.reportJson)),
    ].join(","),
  );

  const csvBody = [header, ...body].join("\n");
  const filename = `axiom-autonomous-ticks-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
