import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import { listModels } from "@/lib/ai/AIModelRegistry";
import {
  loadWorkspaceAIProviderPolicy,
  normalizeWorkspaceAIProviderPolicy,
  resolveWorkspaceAIProviderPolicy,
  saveWorkspaceAIProviderPolicy,
} from "@/lib/ai/workspaceProviderPolicy";

export const dynamic = "force-dynamic";

function serviceEnabledProviders() {
  return getAIProviderManager().status()
    .filter((provider) => provider.provider !== "mock" && provider.configured)
    .map((provider) => provider.provider);
}

async function ownerContext(): Promise<{ organizationId: string; userId: string } | null> {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId || !isAdminOrOwner({ email: ctx.email, roles: ctx.roles })) return null;
  return { organizationId: ctx.organizationId, userId: ctx.userId };
}

export async function GET(): Promise<NextResponse> {
  const ctx = await ownerContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "workspace_owner_required" }, { status: 403 });
  const availableProviders = serviceEnabledProviders();
  const policy = resolveWorkspaceAIProviderPolicy({
    stored: await loadWorkspaceAIProviderPolicy(ctx.organizationId),
    serviceEnabled: availableProviders,
  });
  // Provider family names are safe to expose to an owner. Configuration,
  // credentials, account identifiers, and usage remain server-side.
  const availableModels = Object.fromEntries(availableProviders.map((provider) => [provider, listModels(provider).map((model) => ({ id: model.id, label: model.label }))]));
  return NextResponse.json({ ok: true, data: { policy, availableProviders, availableModels } });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const ctx = await ownerContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "workspace_owner_required" }, { status: 403 });
  const body = await request.json().catch(() => null) as { allowedProviders?: unknown; modelSelections?: unknown; fallbackOrder?: unknown } | null;
  const policy = body ? normalizeWorkspaceAIProviderPolicy(body) : null;
  if (!policy) return NextResponse.json({ ok: false, error: "invalid_provider_policy" }, { status: 422 });
  const serviceEnabled = serviceEnabledProviders();
  if (policy.allowedProviders.some((provider) => !serviceEnabled.includes(provider))) {
    return NextResponse.json({ ok: false, error: "provider_unavailable" }, { status: 422 });
  }
  try {
    await saveWorkspaceAIProviderPolicy({ organizationId: ctx.organizationId, policy, updatedBy: ctx.userId });
    await recordAudit({
      organizationId: idFactory.organization(ctx.organizationId),
      actorUserId: idFactory.user(ctx.userId),
      actorKind: "user",
      action: "policy.update",
      outcome: "success",
      entityRef: "ai_provider_policy:workspace",
      correlationId: idFactory.correlation(`ai_policy_${Date.now().toString(36)}`),
      source: "live",
      detail: {
        allowedProviderCount: policy.allowedProviders.length,
        selectedModelCount: Object.keys(policy.modelSelections).length,
        fallbackProviderCount: policy.fallbackOrder.length,
      },
    });
    return NextResponse.json({ ok: true, data: { policy } });
  } catch {
    return NextResponse.json({ ok: false, error: "provider_policy_unavailable" }, { status: 503 });
  }
}
