/**
 * POST /api/workforce/engineers/migration/stage
 *
 * Workspace admin stages a migration plan through the migration
 * engineer's runtime-gated orchestrator. Risk floor is "critical"
 * (always two-step approval) so the action lands in the approvals
 * queue as a snapshot — the operator approves there.
 *
 * Body: see parseMigrationStageBody — kind, target, rationale, etc.
 * Auth: workspace member; the gate enforces approval, not this route.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { planAndRequestMigrationApply } from "@/lib/workforce/orchestrators/migrationEngineerOrchestrator";
import { parseMigrationStageBody } from "@/lib/workforce/parseMigrationStageBody";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await currentContext();
  if (!session.isAuthenticated || !session.organizationId) {
    return NextResponse.json({ ok: false, reason: "auth_required" }, { status: 401 });
  }

  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty */ }
  const parsed = parseMigrationStageBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, reason: parsed.reason, detail: parsed.detail }, { status: 400 });
  }

  const result = await planAndRequestMigrationApply({
    workspaceId: String(session.organizationId),
    requestedBy: session.userId ?? session.email ?? "unknown",
    descriptor: parsed.descriptor,
    connector: parsed.connector,
  });

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      reason: result.reason,
      detail: "The runbook itself is unsafe — see the runbook gate checks.",
      runbook: result.runbook,
    }, { status: 422 });
  }

  return NextResponse.json({
    ok: true,
    attemptId: result.attemptId,
    correlationId: result.correlationId,
    approvalRequestId: result.approvalRequestId ?? null,
    verdict: result.verdict,
    runbook: result.runbook,
  });
}
