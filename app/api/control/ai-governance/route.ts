import { NextResponse, type NextRequest } from "next/server";

import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { recordRequiredAudit as recordAudit } from "@/lib/audit/requiredAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import { loadGatewayModelCatalog } from "@/lib/ai/gatewayModelCatalog";
import {
  loadWorkspaceAIProviderPolicyWithState,
  normalizeWorkspaceAIProviderPolicyUpdate,
  gatewayPolicyModelIds,
  resolveWorkspaceAIProviderPolicy,
  saveWorkspaceAIProviderPolicy,
} from "@/lib/ai/workspaceProviderPolicy";
import {
  agentToolCatalog,
  normalizeAgentIdentityInput,
  readWorkspaceAgentIdentity,
  saveWorkspaceAgentIdentity,
} from "@/lib/axiom/agentRuntime/agentIdentityPolicy";
import { readTenantCharter, upsertTenantCharter } from "@/lib/autonomy/tenantCharterStore";
import { workspaceUnenrolled } from "@/lib/governance/intelligence/enrolledRefusal";
import { isAutonomyLoosening } from "@/lib/governance/intelligence/enrolledRefusalPolicy";
import type { AutonomyMode } from "@/lib/autonomy/autonomousLoopModel";
import { loadBudgetConfig, upsertBudgetConfig } from "@/lib/workforce/pipelines/budgetConfigStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AUTONOMY_MODES = new Set<AutonomyMode>(["observer", "review", "assisted", "autonomous"]);

function identityStorageState(error: unknown): "migration_pending" | "unavailable" {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  return code === "P2021" || code === "P2022" ? "migration_pending" : "unavailable";
}


async function context() {
  const value = await currentContext();
  if (!value.isAuthenticated || !value.organizationId || !value.userId) return null;
  return {
    organizationId: String(value.organizationId),
    userId: String(value.userId),
    email: value.email,
    roles: value.roles,
  };
}

function serviceProviders() {
  return getAIProviderManager().status()
    .filter((row) => row.provider !== "mock" && row.configured)
    .map((row) => row.provider);
}

export async function GET() {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });

  const providers = serviceProviders();
  const [loadedPolicy, identity, autonomy, budget, gatewayModels] = await Promise.all([
    loadWorkspaceAIProviderPolicyWithState(ctx.organizationId),
    readWorkspaceAgentIdentity(ctx.organizationId)
      .then(value => ({ value, state: "ready" as const }))
      .catch(error => ({ value: null, state: identityStorageState(error) })),
    readTenantCharter(ctx.organizationId),
    loadBudgetConfig(ctx.organizationId),
    providers.includes("vercel_gateway") ? loadGatewayModelCatalog().catch(() => null) : Promise.resolve([]),
  ]);
  if (loadedPolicy.storageState !== "ready") {
    return NextResponse.json({ ok: false, error: "provider_policy_unavailable" }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      canManage: isAdminOrOwner({ email: ctx.email, roles: ctx.roles }),
      providerPolicy: resolveWorkspaceAIProviderPolicy({ stored: loadedPolicy.policy, serviceEnabled: providers }),
      availableProviders: providers,
      gatewayModels,
      gatewayCatalogLive: providers.includes("vercel_gateway") && gatewayModels !== null,
      agentIdentity: identity.value,
      agentIdentityState: identity.state,
      autonomy: autonomy ? {
        mode: autonomy.mode,
        perCycleActionLimit: autonomy.perCycleActionLimit ?? autonomy.resolved.perCycleActionLimit,
        rationale: autonomy.rationale ?? "",
        updatedAt: autonomy.updatedAt,
        updatedBy: autonomy.updatedBy,
      } : null,
      budget,
      tools: agentToolCatalog(),
    },
  });
}

export async function PATCH(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false, error: "invalid_request_origin" }, { status: 403 });
  const ctx = await context();
  if (!ctx || !isAdminOrOwner({ email: ctx.email, roles: ctx.roles })) {
    return NextResponse.json({ ok: false, error: "workspace_owner_required" }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid_policy_payload" }, { status: 422 });
  const section = body?.section;
  const correlationId = idFactory.correlation(request.headers.get("x-correlation-id") ?? `ai_governance_${Date.now().toString(36)}`);

  if (section === "provider_policy") {
    const policy = normalizeWorkspaceAIProviderPolicyUpdate(body ?? {});
    if (!policy) return NextResponse.json({ ok: false, error: "invalid_provider_policy" }, { status: 422 });
    const available = serviceProviders();
    if (policy.allowedProviders.some((provider) => !available.includes(provider))) {
      return NextResponse.json({ ok: false, error: "provider_unavailable" }, { status: 422 });
    }
    if (gatewayPolicyModelIds(policy).length) {
      const models = await loadGatewayModelCatalog().catch(() => null);
      if (!models) return NextResponse.json({ ok: false, error: "gateway_catalog_unavailable" }, { status: 503 });
      if (gatewayPolicyModelIds(policy).some(id => !models.some(model => model.id === id))) {
        return NextResponse.json({ ok: false, error: "gateway_model_unavailable" }, { status: 422 });
      }
    }
    await saveWorkspaceAIProviderPolicy({ organizationId: ctx.organizationId, policy, updatedBy: ctx.userId });
    try {
      await recordAudit({
        organizationId: idFactory.organization(ctx.organizationId), actorUserId: idFactory.user(ctx.userId), actorKind: "user",
        action: "policy.update", outcome: "success", entityRef: "ai_provider_policy:workspace", correlationId, source: "live",
        detail: { enabled: policy.enabled, providers: policy.allowedProviders.join(","), models: Object.values(policy.modelSelections).join(","), approvedGatewayModels: gatewayPolicyModelIds(policy).join(",") },
      });
    } catch {
      return NextResponse.json({ ok: false, error: "policy_audit_unconfirmed", correlationId: String(correlationId) }, { status: 503 });
    }
    return NextResponse.json({ ok: true, data: { providerPolicy: policy } });
  }

  if (section === "agent_identity") {
    const normalized = normalizeAgentIdentityInput(body ?? {});
    if (!normalized) return NextResponse.json({ ok: false, error: "invalid_agent_identity_policy" }, { status: 422 });
    let identity;
    try {
      identity = await saveWorkspaceAgentIdentity({ organizationId: ctx.organizationId, ...normalized, updatedBy: ctx.userId });
    } catch (error) {
      return NextResponse.json({ ok: false, error: identityStorageState(error) === "migration_pending" ? "agent_identity_migration_pending" : "agent_identity_unavailable", correlationId: String(correlationId) }, { status: 503 });
    }
    try {
      await recordAudit({
        organizationId: idFactory.organization(ctx.organizationId), actorUserId: idFactory.user(ctx.userId), actorKind: "user",
        action: "policy.update", outcome: "success", entityRef: "agent_identity:workspace", correlationId, source: "live",
        detail: { enabled: identity.enabled, displayName: identity.displayName, allowedTools: identity.allowedTools.join(",") },
      });
    } catch {
      // The identity may already be saved. Do not replay or claim an audited success.
      return NextResponse.json({ ok: false, error: "policy_audit_unconfirmed", correlationId: String(correlationId) }, { status: 503 });
    }
    return NextResponse.json({ ok: true, data: { agentIdentity: identity } });
  }

  if (section === "autonomy") {
    const mode = body.mode;
    const perCycleActionLimit = body.perCycleActionLimit;
    const rationale = typeof body.rationale === "string" ? body.rationale.trim().slice(0, 1000) : "";
    if (typeof mode !== "string" || !AUTONOMY_MODES.has(mode as AutonomyMode) || !Number.isInteger(perCycleActionLimit) || Number(perCycleActionLimit) < 1 || Number(perCycleActionLimit) > 50) {
      return NextResponse.json({ ok: false, error: "invalid_autonomy_policy" }, { status: 422 });
    }
    // Governance M02: while enrolled, the Agent's autonomy can be tightened but not loosened.
    const current = await readTenantCharter(ctx.organizationId).catch(() => null);
    const currentLimit = current ? Number(current.perCycleActionLimit ?? current.resolved?.perCycleActionLimit ?? 1) : 1;
    if (isAutonomyLoosening(current ? { mode: current.mode, perCycleActionLimit: currentLimit } : null, { mode, perCycleActionLimit: Number(perCycleActionLimit) }) && !await workspaceUnenrolled(ctx.organizationId)) {
      return NextResponse.json({ ok: false, error: "governance_enrolled_policy_loosening" }, { status: 409 });
    }
    const autonomy = await upsertTenantCharter({ organizationId: ctx.organizationId, mode: mode as AutonomyMode, perCycleActionLimit: Number(perCycleActionLimit), rationale, updatedBy: ctx.userId });
    try {
      await recordAudit({
        organizationId: idFactory.organization(ctx.organizationId), actorUserId: idFactory.user(ctx.userId), actorKind: "user",
        action: "autonomy.change", outcome: "success", entityRef: "autonomy_charter:workspace", correlationId, source: "live",
        detail: { mode: autonomy.mode, perCycleActionLimit: autonomy.resolved.perCycleActionLimit, rationale },
      });
    } catch {
      return NextResponse.json({ ok: false, error: "policy_audit_unconfirmed", correlationId: String(correlationId) }, { status: 503 });
    }
    return NextResponse.json({ ok: true, data: { autonomy: { mode: autonomy.mode, perCycleActionLimit: autonomy.resolved.perCycleActionLimit, rationale } } });
  }

  if (section === "budget") {
    const raw = body.defaultMaxCostCents;
    const defaultMaxCostCents = raw === null ? null : Number(raw);
    const rationale = typeof body.rationale === "string" ? body.rationale.trim().slice(0, 1000) : "";
    if (defaultMaxCostCents !== null && (!Number.isInteger(defaultMaxCostCents) || defaultMaxCostCents < 1 || defaultMaxCostCents > 100_000_000)) {
      return NextResponse.json({ ok: false, error: "invalid_budget_policy" }, { status: 422 });
    }
    const existingBudget = await loadBudgetConfig(ctx.organizationId);
    const pipelineOverrides = existingBudget?.pipelineOverrides ?? [];
    await upsertBudgetConfig({ organizationId: ctx.organizationId, defaultMaxCostCents, pipelineOverrides, rationale, updatedBy: ctx.userId, correlationId: String(correlationId) });
    try {
      await recordAudit({
        organizationId: idFactory.organization(ctx.organizationId), actorUserId: idFactory.user(ctx.userId), actorKind: "user",
        action: "policy.update", outcome: "success", entityRef: "budget_config:workspace", correlationId, source: "live",
        detail: { defaultMaxCostCents: defaultMaxCostCents ?? "unlimited", pipelineOverrideCount: pipelineOverrides.length, rationale },
      });
    } catch {
      return NextResponse.json({ ok: false, error: "policy_audit_unconfirmed", correlationId: String(correlationId) }, { status: 503 });
    }
    return NextResponse.json({ ok: true, data: { budget: { defaultMaxCostCents, pipelineOverrides } } });
  }

  return NextResponse.json({ ok: false, error: "unsupported_policy_section" }, { status: 422 });
}
