/**
 * POST /api/workforce/[id]/policy — operator override of an engineer's
 * approval rule + enabled flag.
 *
 * Hard invariant: workspace admins can ONLY tighten the rule beyond the
 * canonical default. Loosening is silently rejected at the boundary
 * and never reaches the database.
 *
 * Writes:
 *   - upserts AgentEngineerRecord with the new rule + isEnabled flag
 *   - emits engineer.policy_override_updated audit row
 *
 * Auth: requires the caller to be authenticated AND in the workspace.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import {
  AGENT_WORKFORCE_REGISTRY,
  type ApprovalRule,
} from "@/lib/workforce/agentWorkforceRegistry";
import { canTightenApprovalRule } from "@/lib/workforce/runtimeActionGate";

export const dynamic = "force-dynamic";

const APPROVAL_RULES = new Set<ApprovalRule>([
  "no_approval_needed",
  "single_approver",
  "two_step_approval",
  "incident_commander_only",
  "blocked_always",
]);

function isApprovalRule(value: unknown): value is ApprovalRule {
  return typeof value === "string" && APPROVAL_RULES.has(value as ApprovalRule);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const session = await currentContext();
  if (!session.isAuthenticated || !session.organizationId) {
    return NextResponse.json({ ok: false, reason: "auth_required" }, { status: 401 });
  }

  const engineer = AGENT_WORKFORCE_REGISTRY.find((e) => e.id === id);
  if (!engineer) {
    return NextResponse.json({ ok: false, reason: "engineer_not_found" }, { status: 404 });
  }

  // Internal-layer engineers cannot be edited from a client workspace.
  if (engineer.productLayer !== "client") {
    return NextResponse.json({ ok: false, reason: "engineer_not_in_workspace_layer" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  const raw = body as { rule?: unknown; isEnabled?: unknown };
  const requestedRule = raw.rule;
  const requestedEnabled = typeof raw.isEnabled === "boolean" ? raw.isEnabled : true;

  if (!isApprovalRule(requestedRule)) {
    return NextResponse.json({
      ok: false,
      reason: "invalid_rule",
      detail: "rule must be one of: no_approval_needed, single_approver, two_step_approval, incident_commander_only, blocked_always",
    }, { status: 400 });
  }

  // Enforce the tightening invariant at the boundary.
  if (!canTightenApprovalRule(engineer.approvalRule, requestedRule)) {
    return NextResponse.json({
      ok: false,
      reason: "cannot_loosen",
      detail: `Workspace overrides may not loosen the canonical baseline (${engineer.approvalRule}). Requested ${requestedRule} is looser.`,
      canonical: engineer.approvalRule,
      requested: requestedRule,
    }, { status: 422 });
  }

  // Persist. currentApprovalRule === canonical means "no override" — store null.
  const overrideToStore: string | null = requestedRule === engineer.approvalRule ? null : requestedRule;

  const orgId = String(session.organizationId);
  try {
    await prisma.agentEngineerRecord.upsert({
      where: { organizationId_engineerId: { organizationId: orgId, engineerId: engineer.id } },
      update: {
        defaultApprovalRule: engineer.approvalRule,
        currentApprovalRule: overrideToStore,
        isEnabled: requestedEnabled,
      },
      create: {
        organizationId: orgId,
        engineerId: engineer.id,
        defaultApprovalRule: engineer.approvalRule,
        currentApprovalRule: overrideToStore,
        isEnabled: requestedEnabled,
      },
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      reason: "persistence_failed",
      detail: err instanceof Error ? err.message : "unknown",
    }, { status: 500 });
  }

  // Audit row.
  try {
    await recordAudit({
      organizationId: idFactory.organization(orgId),
      actorUserId: session.userId ?? idFactory.user(session.email ?? "unknown"),
      actorKind: "user",
      action: "engineer.policy_override_updated",
      outcome: "success",
      entityRef: `engineer:${engineer.id}`,
      correlationId: idFactory.correlation(`override_${Date.now().toString(36)}`),
      source: "live",
      detail: {
        engineerId: engineer.id,
        canonical: engineer.approvalRule,
        requestedRule,
        isEnabled: requestedEnabled,
      },
    });
  } catch {
    // Best-effort — the policy is persisted; audit failure is operational.
  }

  return NextResponse.json({
    ok: true,
    engineerId: engineer.id,
    canonical: engineer.approvalRule,
    currentRule: requestedRule,
    overrideActive: overrideToStore !== null,
    isEnabled: requestedEnabled,
  });
}
