/**
 * GET /api/dashboard/autonomy-history — Phase 513.
 *
 * Returns the recent autonomous tick log entries for the org plus
 * the global aggregates. Used by the Autonomy page.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  try {
    const [orgRows, globalRows] = await Promise.all([
      prisma.autonomousTickLog.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { generatedAt: "desc" },
        take: 50,
      }),
      prisma.autonomousTickLog.findMany({
        where: { organizationId: "" },
        orderBy: { generatedAt: "desc" },
        take: 20,
      }),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        generatedAt: new Date().toISOString(),
        org: orgRows.map((r) => ({
          id: r.id,
          totalRuns: r.totalRuns,
          okRuns: r.okRuns,
          errorRuns: r.errorRuns,
          skippedRuns: r.skippedRuns,
          report: r.reportJson,
          generatedAtIso: r.generatedAt.toISOString(),
        })),
        global: globalRows.map((r) => ({
          id: r.id,
          totalRuns: r.totalRuns,
          okRuns: r.okRuns,
          errorRuns: r.errorRuns,
          skippedRuns: r.skippedRuns,
          generatedAtIso: r.generatedAt.toISOString(),
        })),
        summary: {
          ticksInWindow: orgRows.length,
          totalRunsInWindow: orgRows.reduce((s, r) => s + r.totalRuns, 0),
          okRunsInWindow: orgRows.reduce((s, r) => s + r.okRuns, 0),
          errorRunsInWindow: orgRows.reduce((s, r) => s + r.errorRuns, 0),
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    // P2021 — table missing
    if (message.includes("relation") && message.includes("does not exist")) {
      return NextResponse.json(
        { ok: false, error: "migration_pending", hint: "AutonomousTickLog table needs Phase 513 migration." },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
