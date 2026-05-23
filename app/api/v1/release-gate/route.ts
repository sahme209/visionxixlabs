/**
 * GET /api/v1/release-gate — Phase 394.
 *
 * Public, machine-to-machine release-gate endpoint. CI workflows,
 * desktop apps, and engineer tooling can poll this to ask "is the
 * platform healthy enough to deploy?"
 *
 * Auth   : Bearer API key with `release_gate:read` scope (or `*`).
 * Format : JSON, never plaintext.
 * Surface: same shape as the admin `/api/admin/eval-runs/release-gate`
 *          but stripped of any internal-only metadata (no IPs, no
 *          previous-run details — just the verdict the caller needs
 *          to make a deploy decision).
 *
 * Example
 *   curl -H "Authorization: Bearer vxlk_live_..." \
 *        https://visionxixlabs.com/api/v1/release-gate
 *
 *   → { ok: true, gate: { passed: true, passRate: 0.93, ... } }
 *
 * On failure the response is shaped { ok: false, error: <code> }
 * with the appropriate HTTP status so callers can branch on `error`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/security/authenticateApiKey";
import { compareEvalRuns } from "@/lib/workforce/eval/compareEvalRuns";
import { assertEvalReleaseHealthy } from "@/lib/workforce/eval/assertEvalReleaseHealthy";
import {
  findLatestEvalRunWithStatus,
  findPreviousCompletedRun,
} from "@/lib/workforce/eval/loadEvalRunSnapshot";

export const dynamic = "force-dynamic";

function getSourceIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? null;
}

export async function GET(req: NextRequest) {
  const correlationId = `v1_release_gate_${Date.now().toString(36)}`;
  const auth = await authenticateApiKey({
    authorizationHeader: req.headers.get("authorization"),
    sourceIp: getSourceIp(req),
    requiredScope: "release_gate:read",
    correlationId,
    route: "GET /api/v1/release-gate",
  });

  if (!auth.ok) {
    const headers: Record<string, string> = {};
    if (typeof auth.retryAfterSeconds === "number") {
      headers["Retry-After"] = String(auth.retryAfterSeconds);
    }
    return NextResponse.json(
      {
        ok: false,
        error: auth.reason,
        ...(auth.requiredScope ? { requiredScope: auth.requiredScope } : {}),
        ...(typeof auth.retryAfterSeconds === "number" ? { retryAfterSeconds: auth.retryAfterSeconds } : {}),
      },
      { status: auth.httpStatus, headers },
    );
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
    regressionCount: diff.counts.regressionCount,
    improvementCount: diff.counts.improvementCount,
    latestRun: {
      runId: latest.snapshot.runId,
      startedAt: latest.snapshot.startedAt,
      totalCases: latest.snapshot.totalCases,
      passCount: latest.snapshot.passCount,
      failCount: latest.snapshot.failCount,
      skippedCount: latest.snapshot.skippedCount,
    },
  });
}
