/**
 * POST /api/admin/workforce-smoke-test — admin-only.
 *
 * Exercises any operational engineer's runtime gate against the live
 * workspace. Pass { engineer: "migration" | "schema" | "pipeline" |
 * "finops" | "secrets", kind?: "..." } and get back the verdict, the
 * approval id (if minted), and the attempt id (if persisted).
 *
 * Used to validate Phase 364/365 end-to-end before any kernel is
 * wired to a real UI button.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { currentContext } from "@/lib/auth/currentContext";
import { syncAgentEngineerRegistryForWorkspace } from "@/lib/workforce/workspaceRegistrySync";
import { planAndRequestMigrationApply } from "@/lib/workforce/orchestrators/migrationEngineerOrchestrator";
import { planAndRequestSchemaApply, planAndRequestIndexApply } from "@/lib/workforce/orchestrators/schemaEngineerOrchestrator";
import { planAndRequestPipelineFix } from "@/lib/workforce/orchestrators/pipelineRepairEngineerOrchestrator";
import { planAndRequestFinopsAction } from "@/lib/workforce/orchestrators/finopsEngineerOrchestrator";
import { planAndRequestSecretRotation } from "@/lib/workforce/orchestrators/secretsHygieneEngineerOrchestrator";
import type { MigrationKind } from "@/lib/agents/migrationCoordinator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type EngineerKey = "migration" | "schema_apply" | "schema_index" | "pipeline" | "finops" | "secrets";

interface SmokeResponse {
  ok: boolean;
  engineer: EngineerKey;
  verdict?: {
    decision: string;
    effectiveRule: string;
    policySource: string;
    requiredApprovers: number;
    auditTopic: string;
    reason: string;
  };
  attemptId?: string;
  correlationId?: string;
  approvalRequestId?: string | null;
  notes?: string;
  refused?: { reason: string };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const session = await currentContext();
  if (!session.isAuthenticated || !session.organizationId) {
    return NextResponse.json({ ok: false, reason: "auth_required" }, { status: 401 });
  }
  const workspaceId = String(session.organizationId);
  const requestedBy = session.userId ?? "admin_smoke_test";

  let body: { engineer?: EngineerKey; kind?: string } = {};
  try { body = await req.json() as typeof body; } catch { /* empty body OK */ }
  const engineer = body.engineer ?? "migration";

  // Ensure the engineer record exists in this workspace.
  await syncAgentEngineerRegistryForWorkspace(workspaceId).catch(() => null);

  let result: SmokeResponse;

  switch (engineer) {
    case "migration": {
      const r = await planAndRequestMigrationApply({
        workspaceId, requestedBy,
        descriptor: {
          id: `mig_smoke_${Date.now().toString(36)}`,
          kind: ((body.kind as MigrationKind) ?? "add_column"),
          target: "users",
          rationale: "Smoke test.",
          hasReverseScript: true, hasActiveWriters: true,
          estimatedRowCount: 1000, windowHours: 24,
        },
        connector: "postgres",
      });
      result = r.ok
        ? toSmoke("migration", r.verdict, r.attemptId, r.correlationId, r.approvalRequestId)
        : { ok: false, engineer: "migration", refused: { reason: r.reason } };
      break;
    }
    case "schema_apply": {
      const r = await planAndRequestSchemaApply({
        workspaceId, requestedBy,
        snapshot: {
          dialect: "postgres",
          tables: [{
            name: "users",
            columns: [
              { name: "id", type: "bigint", nullable: false, hasDefault: false },
              { name: "email", type: "text", nullable: false, hasDefault: false },
              { name: "created_at", type: "timestamp", nullable: false, hasDefault: true },
            ],
            indexes: [],
            primaryKey: ["id"],
            rowEstimate: 100_000,
          }],
        } as never,
        findingId: "non-existent-finding-on-purpose",
        connector: "postgres",
      });
      result = r.ok
        ? toSmoke("schema_apply", r.verdict, r.attemptId, r.correlationId, r.approvalRequestId)
        : { ok: false, engineer: "schema_apply", refused: { reason: r.reason }, notes: "No findings on the synthetic snapshot — expected." };
      break;
    }
    case "schema_index": {
      const r = await planAndRequestIndexApply({
        workspaceId, requestedBy,
        slowQueries: [],
        context: { dialect: "postgres" } as never,
        proposalId: "non-existent-proposal",
        connector: "postgres",
      });
      result = r.ok
        ? toSmoke("schema_index", r.verdict, r.attemptId, r.correlationId, r.approvalRequestId)
        : { ok: false, engineer: "schema_index", refused: { reason: r.reason }, notes: "No slow queries on synthetic input — expected." };
      break;
    }
    case "pipeline": {
      const r = await planAndRequestPipelineFix({
        workspaceId, requestedBy,
        failedRun: {
          runId: "run_smoke", repo: "sahme209/platform", branch: "main",
          jobName: "build", stepName: "npm test",
          logExcerpt: "Error: jest exited with code 1\nEXPECTED FAIL — smoke test",
          flakeRate30d: 0.1, lastGreenSha: "abc1234",
        },
      });
      result = toSmoke("pipeline", r.verdict, r.attemptId, r.correlationId, r.approvalRequestId);
      result.notes = `kernel verdict: ${r.proposal.recommendedGate} (confidence ${r.proposal.confidence})`;
      break;
    }
    case "finops": {
      const r = await planAndRequestFinopsAction({
        workspaceId, requestedBy,
        resources: [{
          id: "vol-smoke",
          kind: "ebs_volume_unattached",
          region: "us-east-1",
          daysIdle: 30, monthlyUsd: 42,
          hasProductionTag: false, hasBackup: false, sizeGb: 100,
        }],
        findingId: "non-existent-on-purpose",
        connector: "aws",
      });
      result = r.ok
        ? toSmoke("finops", r.verdict, r.attemptId, r.correlationId, r.approvalRequestId)
        : { ok: false, engineer: "finops", refused: { reason: r.reason }, notes: "Synthetic finding id doesn't match the kernel-generated one — expected behaviour." };
      break;
    }
    case "secrets": {
      // Use a known-bad-on-purpose token that the scanner will detect.
      const sample = "API token: AKIAEXAMPLEKEY12345X\nNot a secret here.";
      const r = await planAndRequestSecretRotation({
        workspaceId, requestedBy,
        input: sample,
        selector: { kind: "aws_access_key", line: 1, column: 11 },
        connector: "github",
      });
      result = r.ok
        ? toSmoke("secrets", r.verdict, r.attemptId, r.correlationId, r.approvalRequestId)
        : { ok: false, engineer: "secrets", refused: { reason: r.reason }, notes: "Synthetic line/column may not match exact detector output — try kind: aws_access_key with correct offset." };
      break;
    }
    default:
      return NextResponse.json({ ok: false, reason: "unknown_engineer" }, { status: 400 });
  }

  return NextResponse.json(result);
}

function toSmoke(engineer: EngineerKey, verdict: NonNullable<SmokeResponse["verdict"]> | { decision: string; effectiveRule: string; policySource: string; requiredApprovers: number; auditTopic: string; reason: string }, attemptId: string, correlationId: string, approvalRequestId?: string): SmokeResponse {
  return {
    ok: true,
    engineer,
    verdict: {
      decision: verdict.decision,
      effectiveRule: verdict.effectiveRule,
      policySource: verdict.policySource,
      requiredApprovers: verdict.requiredApprovers,
      auditTopic: verdict.auditTopic,
      reason: verdict.reason,
    },
    attemptId,
    correlationId,
    approvalRequestId: approvalRequestId ?? null,
  };
}
