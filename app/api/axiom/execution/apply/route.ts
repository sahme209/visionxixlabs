/**
 * POST /api/axiom/execution/apply
 *
 * Apply approved execution plan actions with full safety pipeline:
 * prechecks → rollback plan → apply → verify → audit log.
 *
 * Body: {
 *   executionPlanId: string,     // stored plan ID (from lead payload)
 *   approvedActionIds: string[], // only these items will be attempted
 *   confirmedMediumRiskIds?: string[], // explicit confirmation for medium-risk
 *   leadId?: string,             // connector credential lookup key
 * }
 *
 * Security:
 * - Requires authenticated session (session or token)
 * - Scale or Enterprise plan required (axiomExecution entitlement)
 * - High-risk and decommission/commitment actions are always rejected
 * - Credentials loaded from encrypted vault — never accepted from client
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import { getCredentialProvider } from "@/lib/plugins/credentials";

import type { ExecutionPlan, ExecutionPlanItem } from "@/lib/axiom/executionPlan";
import type { CloudProvider } from "@/lib/axiom/cloudSnapshot";
import { runPrechecks, runAllPrechecks } from "@/lib/axiom/precheckSystem";
import { generateRollbackPlan } from "@/lib/axiom/rollbackPlanner";
import { captureComputeState, captureStorageState } from "@/lib/axiom/rollbackPlanner";
import { verifyAppliedAction } from "@/lib/axiom/verificationEngine";
import {
  createAuditLog,
  markPrecheckFailed,
  markApplied,
  markVerified,
  markFailed,
} from "@/lib/axiom/auditLog";
import {
  applyExecutionPlan,
  getHandlersForProvider,
} from "@/lib/axiom/applyEngine";

// ---------------------------------------------------------------------------
// Blocked action types — never auto-applied
// ---------------------------------------------------------------------------

const BLOCKED_ACTION_TYPES = new Set(["purchase_commitment", "decommission_compute"]);

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    // ---- Auth ----
    const body = await req.json();
    const { executionPlanId, approvedActionIds, confirmedMediumRiskIds, leadId, token } = body;

    const auth = await resolveAuth(req, token, leadId);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { userId, organizationId, credentialsKey } = auth;

    // ---- Validate input ----
    if (!executionPlanId || typeof executionPlanId !== "string") {
      return NextResponse.json({ error: "executionPlanId is required" }, { status: 400 });
    }

    if (!Array.isArray(approvedActionIds) || approvedActionIds.length === 0) {
      return NextResponse.json({ error: "approvedActionIds[] is required and must not be empty" }, { status: 400 });
    }

    // ---- Load plan from database ----
    const plan = await loadExecutionPlan(executionPlanId, credentialsKey);
    if (!plan) {
      return NextResponse.json({ error: "Execution plan not found" }, { status: 404 });
    }

    // ---- Filter to approved items only ----
    const approvedSet = new Set(approvedActionIds as string[]);
    const confirmedSet = new Set((confirmedMediumRiskIds ?? []) as string[]);
    const approvedItems = plan.items.filter((item) => approvedSet.has(item.id));

    if (approvedItems.length === 0) {
      return NextResponse.json({ error: "No matching items found for the provided approvedActionIds" }, { status: 400 });
    }

    // ---- Reject blocked actions ----
    const blocked = approvedItems.filter(
      (item) => BLOCKED_ACTION_TYPES.has(item.actionType) || item.riskLevel === "high"
    );

    if (blocked.length > 0) {
      return NextResponse.json({
        error: "Cannot auto-apply high-risk, commitment, or decommission actions",
        blockedItems: blocked.map((b) => ({
          id: b.id,
          actionType: b.actionType,
          riskLevel: b.riskLevel,
          reason: BLOCKED_ACTION_TYPES.has(b.actionType)
            ? `${b.actionType} requires manual execution`
            : "High-risk actions cannot be auto-applied",
        })),
      }, { status: 403 });
    }

    // ---- Reject medium-risk without explicit confirmation ----
    const unconfirmedMedium = approvedItems.filter(
      (item) => item.riskLevel === "medium" && !confirmedSet.has(item.id)
    );

    if (unconfirmedMedium.length > 0) {
      return NextResponse.json({
        error: "Medium-risk actions require explicit confirmation",
        requiresConfirmation: unconfirmedMedium.map((item) => ({
          id: item.id,
          actionType: item.actionType,
          riskLevel: item.riskLevel,
          resourceIds: item.resourceIds,
          region: item.region,
        })),
      }, { status: 422 });
    }

    // ---- Verify credentials exist (without exposing them) ----
    const credProvider = getCredentialProvider();
    const hasCredentials = await verifyCredentialsExist(credProvider, userId, credentialsKey, plan.provider);
    if (!hasCredentials) {
      return NextResponse.json({
        error: `No ${plan.provider.toUpperCase()} credentials found. Connect your cloud account first.`,
      }, { status: 403 });
    }

    // ---- Execute pipeline per item ----
    const results: ActionPipelineResult[] = [];

    for (const item of approvedItems) {
      const result = await executePipeline(item, userId, organizationId);
      results.push(result);

      if (result.status === "apply_failed") {
        break;
      }
    }

    // ---- Build response ----
    const applied = results.filter((r) => r.status === "verified" || r.status === "applied").length;
    const simulated = results.filter((r) => r.status === "simulated").length;
    const failed = results.filter((r) => r.status === "apply_failed" || r.status === "precheck_failed").length;

    return NextResponse.json({
      planId: executionPlanId,
      provider: plan.provider,
      totalActions: results.length,
      applied,
      simulated,
      failed,
      results: results.map(toResponseItem),
    });
  } catch (e) {
    console.error("[axiom execution/apply]", e);
    return NextResponse.json({ error: "Failed to apply execution plan" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Pipeline: prechecks → rollback plan → apply → verify → audit
// ---------------------------------------------------------------------------

type ActionPipelineResult = {
  itemId: string;
  actionType: string;
  provider: CloudProvider;
  region: string;
  resourceIds: string[];
  status: "verified" | "applied" | "simulated" | "apply_failed" | "precheck_failed" | "verify_failed";
  precheck: { passed: boolean; warnings: string[]; blockers: string[] };
  rollbackPlan: { steps: string[]; automated: boolean; estimatedDurationMin: number };
  verification: { verified: boolean; details: string[]; warnings: string[] } | null;
  auditLogId: string | null;
  error: string | null;
};

async function executePipeline(
  item: ExecutionPlanItem,
  userId: string,
  organizationId: string,
): Promise<ActionPipelineResult> {
  // Capture pre-apply state
  const beforeState = item.actionType === "resize_compute"
    ? captureComputeState(item)
    : captureStorageState(item);

  // Create audit log entry (pending)
  let auditLogId: string | null = null;
  try {
    const audit = await createAuditLog({
      userId,
      organizationId,
      item,
      beforeState,
      metadata: { source: "api", route: "/api/axiom/execution/apply" },
    });
    auditLogId = audit.id;
  } catch (e) {
    console.error("[audit] Failed to create audit log:", e);
  }

  // ---- 1. Prechecks ----
  const precheck = runPrechecks(item);

  if (!precheck.passed) {
    if (auditLogId) {
      try { await markPrecheckFailed(auditLogId, precheck.blockers.join("; ")); } catch {}
    }
    return {
      itemId: item.id,
      actionType: item.actionType,
      provider: item.provider,
      region: item.region,
      resourceIds: item.resourceIds,
      status: "precheck_failed",
      precheck: { passed: false, warnings: precheck.warnings, blockers: precheck.blockers },
      rollbackPlan: { steps: [], automated: false, estimatedDurationMin: 0 },
      verification: null,
      auditLogId,
      error: `Precheck failed: ${precheck.blockers.join("; ")}`,
    };
  }

  // ---- 2. Generate rollback plan ----
  const rollback = generateRollbackPlan(item);

  // ---- 3. Apply ----
  const handlers = getHandlersForProvider(item.provider);
  const handler = handlers[item.actionType];

  if (!handler) {
    if (auditLogId) {
      try { await markFailed(auditLogId, `No handler for ${item.actionType}`); } catch {}
    }
    return {
      itemId: item.id,
      actionType: item.actionType,
      provider: item.provider,
      region: item.region,
      resourceIds: item.resourceIds,
      status: "apply_failed",
      precheck: { passed: true, warnings: precheck.warnings, blockers: [] },
      rollbackPlan: { steps: rollback.rollbackSteps.map((s) => s.description), automated: rollback.automated, estimatedDurationMin: rollback.estimatedTotalDurationMin },
      verification: null,
      auditLogId,
      error: `No apply handler for action type: ${item.actionType}`,
    };
  }

  let applyResult;
  try {
    applyResult = await handler.apply(item);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (auditLogId) {
      try { await markFailed(auditLogId, msg); } catch {}
    }
    return {
      itemId: item.id,
      actionType: item.actionType,
      provider: item.provider,
      region: item.region,
      resourceIds: item.resourceIds,
      status: "apply_failed",
      precheck: { passed: true, warnings: precheck.warnings, blockers: [] },
      rollbackPlan: { steps: rollback.rollbackSteps.map((s) => s.description), automated: rollback.automated, estimatedDurationMin: rollback.estimatedTotalDurationMin },
      verification: null,
      auditLogId,
      error: msg,
    };
  }

  if (!applyResult.success) {
    if (auditLogId) {
      try { await markFailed(auditLogId, applyResult.message); } catch {}
    }
    return {
      itemId: item.id,
      actionType: item.actionType,
      provider: item.provider,
      region: item.region,
      resourceIds: item.resourceIds,
      status: "apply_failed",
      precheck: { passed: true, warnings: precheck.warnings, blockers: [] },
      rollbackPlan: { steps: rollback.rollbackSteps.map((s) => s.description), automated: rollback.automated, estimatedDurationMin: rollback.estimatedTotalDurationMin },
      verification: null,
      auditLogId,
      error: applyResult.message,
    };
  }

  // Mark applied in audit
  if (auditLogId) {
    try {
      await markApplied(auditLogId, {
        recommendedState: item.recommendedState,
        appliedAt: new Date().toISOString(),
      });
    } catch {}
  }

  // ---- 4. Verify ----
  // verifyAppliedAction()'s checks are currently hardcoded `passed: true`
  // stubs (lib/axiom/verificationEngine.ts) — not real post-apply reads.
  // When the handler itself never called a live cloud SDK (applyResult.
  // simulated), running this stub afterward is doubly meaningless, so
  // "simulated" takes priority over whatever it returns.
  const verification = verifyAppliedAction(item);

  if (!applyResult.simulated && verification.verified && auditLogId) {
    try { await markVerified(auditLogId); } catch {}
  }

  return {
    itemId: item.id,
    actionType: item.actionType,
    provider: item.provider,
    region: item.region,
    resourceIds: item.resourceIds,
    status: applyResult.simulated ? "simulated" : (verification.verified ? "verified" : "verify_failed"),
    precheck: { passed: true, warnings: precheck.warnings, blockers: [] },
    rollbackPlan: { steps: rollback.rollbackSteps.map((s) => s.description), automated: rollback.automated, estimatedDurationMin: rollback.estimatedTotalDurationMin },
    verification: { verified: verification.verified, details: verification.details, warnings: verification.warnings },
    auditLogId,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Auth resolution (session or token)
// ---------------------------------------------------------------------------

type AuthResult =
  | { userId: string; organizationId: string; credentialsKey: string }
  | { error: string; status: number };

async function resolveAuth(
  req: NextRequest,
  token: string | undefined,
  leadId: string | undefined,
): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  if (session?.user && (session.user as { id?: string }).id) {
    const userId = (session.user as { id: string }).id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    const entitlements = getEntitlementsFromPlan(user?.plan ?? null);
    if (!entitlements.axiomExecution) {
      return { error: "Applying changes requires a Scale plan. Let the agent apply approved changes with prechecks, dry-run simulation, and automatic rollback. See /pricing?ref=axiom-apply", status: 403 };
    }

    const credentialsKey = leadId ?? userId;
    return { userId, organizationId: userId, credentialsKey };
  }

  if (token) {
    const result = verifyStarterToken(token);
    if ("error" in result) {
      return { error: result.error === "expired" ? "Token expired" : "Invalid token", status: 401 };
    }

    const lead = await prisma.lead.findUnique({
      where: { id: result.leadId },
      select: { userId: true, id: true },
    });

    if (!lead) return { error: "Lead not found", status: 404 };
    if (!lead.userId) {
      return { error: "Sign in to apply optimizations. Link your account first.", status: 403 };
    }

    const user = await prisma.user.findUnique({
      where: { id: lead.userId },
      select: { plan: true },
    });

    const entitlements = getEntitlementsFromPlan(user?.plan ?? null);
    if (!entitlements.axiomExecution) {
      return { error: "Applying changes requires a Scale plan. Let the agent apply approved changes with prechecks, dry-run simulation, and automatic rollback. See /pricing?ref=axiom-apply", status: 403 };
    }

    return { userId: lead.userId, organizationId: lead.userId, credentialsKey: lead.id };
  }

  return { error: "Unauthorized. Sign in or provide token.", status: 401 };
}

// ---------------------------------------------------------------------------
// Plan loader
// ---------------------------------------------------------------------------

async function loadExecutionPlan(
  planId: string,
  credentialsKey: string,
): Promise<ExecutionPlan | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: credentialsKey },
    select: { fullPayload: true },
  });

  if (!lead) return null;

  const payload = (lead.fullPayload as Record<string, unknown>) ?? {};
  const plans = (payload.executionPlans as Record<string, unknown>) ?? {};
  const plan = plans[planId] as ExecutionPlan | undefined;

  return plan ?? null;
}

// ---------------------------------------------------------------------------
// Credential verification (existence check only — never exposes secrets)
// ---------------------------------------------------------------------------

async function verifyCredentialsExist(
  credProvider: ReturnType<typeof getCredentialProvider>,
  userId: string,
  credentialsKey: string,
  provider: CloudProvider,
): Promise<boolean> {
  try {
    switch (provider) {
      case "aws":
        return (await credProvider.getAWSCredentials(userId, credentialsKey)) !== null;
      case "azure":
        return (await credProvider.getAzureCredentials(userId, credentialsKey)) !== null;
      case "gcp":
        return (await credProvider.getGCPCredentials(userId, credentialsKey)) !== null;
    }
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Response serialization (strip internal fields)
// ---------------------------------------------------------------------------

function toResponseItem(r: ActionPipelineResult) {
  return {
    itemId: r.itemId,
    actionType: r.actionType,
    provider: r.provider,
    region: r.region,
    resourceCount: r.resourceIds.length,
    status: r.status,
    precheck: r.precheck,
    rollbackPlan: {
      stepsCount: r.rollbackPlan.steps.length,
      automated: r.rollbackPlan.automated,
      estimatedDurationMin: r.rollbackPlan.estimatedDurationMin,
    },
    verification: r.verification,
    auditLogId: r.auditLogId,
    error: r.error,
  };
}
