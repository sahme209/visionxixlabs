/**
 * GET /api/admin/eval-runs/release-gate — Phase 393.
 *
 * Returns the current release-gate decision: pulls the latest EvalRun,
 * compares it to the previous completed run, runs the pure
 * `assertEvalReleaseHealthy` kernel, and surfaces the verdict + every
 * blocker.
 *
 * Designed for two consumers:
 *   - the admin UI's trend page (renders the current gate badge)
 *   - CI: a release-gate workflow can curl this endpoint and refuse
 *     to deploy when `passed: false`
 *
 * Admin-gated via ADMIN_EMAILS. Read-only.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin/auth";
import { compareEvalRuns } from "@/lib/workforce/eval/compareEvalRuns";
import { assertEvalReleaseHealthy } from "@/lib/workforce/eval/assertEvalReleaseHealthy";
import {
  findLatestEvalRunWithStatus,
  findPreviousCompletedRun,
} from "@/lib/workforce/eval/loadEvalRunSnapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ ok: false, reason: "admin_required" }, { status: 403 });
  }

  const latest = await findLatestEvalRunWithStatus();
  if (!latest) {
    return NextResponse.json({
      ok: true,
      hasRun: false,
      message: "No eval runs have completed yet.",
    });
  }

  const previous = await findPreviousCompletedRun(latest.snapshot.startedAt, latest.snapshot.runId);
  const diff = compareEvalRuns(previous, latest.snapshot);
  const gate = assertEvalReleaseHealthy({
    current: latest.snapshot,
    diff,
    runStatus: latest.status,
  });

  return NextResponse.json({
    ok: true,
    hasRun: true,
    gate: {
      passed: gate.passed,
      passRate: gate.passRate,
      averageScore: gate.averageScore,
      blockers: gate.blockers,
      summary: gate.summary,
    },
    diff: {
      regressionCount: diff.counts.regressionCount,
      improvementCount: diff.counts.improvementCount,
      regressions: diff.regressions,
      improvements: diff.improvements,
    },
    latestRun: {
      runId: latest.snapshot.runId,
      startedAt: latest.snapshot.startedAt,
      status: latest.status,
      totalCases: latest.snapshot.totalCases,
      passCount: latest.snapshot.passCount,
      failCount: latest.snapshot.failCount,
      skippedCount: latest.snapshot.skippedCount,
      totalCostCents: latest.snapshot.totalCostCents,
    },
    previousRun: previous ? {
      runId: previous.runId,
      startedAt: previous.startedAt,
      passCount: previous.passCount,
      failCount: previous.failCount,
      totalCases: previous.totalCases,
    } : null,
  });
}
