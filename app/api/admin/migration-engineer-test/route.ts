/**
 * POST /api/admin/migration-engineer-test — admin-only end-to-end exercise.
 *
 * Calls `planAndRequestMigrationApply()` with a synthetic descriptor,
 * returns the full pipeline outcome:
 *   - runbook (planning kernel verdict)
 *   - runtime gate verdict (allowed | requires_approval | blocked)
 *   - attempt id (persisted row)
 *   - approval request id (if minted)
 *
 * Use this to validate Phase 364 end-to-end against your real
 * workspace — every other engineer will follow the exact same shape.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { currentContext } from "@/lib/auth/currentContext";
import { syncAgentEngineerRegistryForWorkspace } from "@/lib/workforce/workspaceRegistrySync";
import { planAndRequestMigrationApply } from "@/lib/workforce/orchestrators/migrationEngineerOrchestrator";
import type { MigrationDescriptor, MigrationKind } from "@/lib/agents/migrationCoordinator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function descriptor(kind: MigrationKind): MigrationDescriptor {
  // Conservative synthetic descriptor that produces a non-blocked runbook
  // for "add_column" but stresses approval for destructive kinds.
  const base: Pick<MigrationDescriptor, "id" | "rationale" | "hasReverseScript" | "hasActiveWriters" | "estimatedRowCount" | "windowHours"> = {
    id: `mig_test_${Date.now().toString(36)}`,
    rationale: "Admin smoke test of the Migration Engineer runtime gate.",
    hasReverseScript: true,
    hasActiveWriters: true,
    estimatedRowCount: 1_000,
    windowHours: 24,
  };
  switch (kind) {
    case "add_column":     return { ...base, kind, target: "users" };
    case "drop_column":    return { ...base, kind, target: "users" };
    case "rename_column":  return { ...base, kind, target: "users" };
    case "add_table":      return { ...base, kind, target: "audit_v2" };
    case "drop_table":     return { ...base, kind, target: "legacy_events" };
    case "alter_index":    return { ...base, kind, target: "orders" };
    case "alter_api_contract": return { ...base, kind, target: "POST /api/orders" };
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const session = await currentContext();
  if (!session.isAuthenticated || !session.organizationId) {
    return NextResponse.json({ ok: false, reason: "auth_required" }, { status: 401 });
  }

  // Pull kind from the body, default to add_column.
  let kind: MigrationKind = "add_column";
  try {
    const body = await req.json() as { kind?: MigrationKind };
    if (body?.kind) kind = body.kind;
  } catch {
    // No body — use defaults.
  }

  const workspaceId = String(session.organizationId);
  const requestedBy = session.userId ?? "admin_smoke_test";

  // Make sure the engineer record exists in this workspace.
  await syncAgentEngineerRegistryForWorkspace(workspaceId).catch(() => null);

  const result = await planAndRequestMigrationApply({
    workspaceId,
    requestedBy,
    descriptor: descriptor(kind),
    connector: "postgres",
  });

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      stage: "runbook",
      reason: result.reason,
      runbookErrors: result.runbook.errors,
      runbookVerdict: result.runbook.overallVerdict,
    });
  }

  return NextResponse.json({
    ok: true,
    workspaceId,
    runbook: {
      kind: result.runbook.descriptor.kind,
      target: result.runbook.descriptor.target,
      overallVerdict: result.runbook.overallVerdict,
      stageCount: result.runbook.stages.length,
      stages: result.runbook.stages.map((s) => ({
        order: s.order,
        kind: s.kind,
        verdict: s.verdict,
      })),
      errors: result.runbook.errors,
    },
    gate: {
      decision: result.verdict.decision,
      effectiveRule: result.verdict.effectiveRule,
      policySource: result.verdict.policySource,
      requiredApprovers: result.verdict.requiredApprovers,
      reason: result.verdict.reason,
      auditTopic: result.verdict.auditTopic,
    },
    attemptId: result.attemptId,
    correlationId: result.correlationId,
    approvalRequestId: result.approvalRequestId ?? null,
    safeNextStep: result.verdict.safeNextStep,
  });
}
