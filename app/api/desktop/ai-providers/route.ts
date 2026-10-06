import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import { listModels } from "@/lib/ai/AIModelRegistry";
import {
  loadWorkspaceAIProviderPolicyWithState,
  normalizeWorkspaceAIProviderPolicy,
  resolveWorkspaceAIProviderPolicy,
  saveWorkspaceAIProviderPolicy,
  workspaceAIProviderPolicyStorageState,
} from "@/lib/ai/workspaceProviderPolicy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function serviceEnabledProviders() {
  return getAIProviderManager().status()
    .filter((provider) => provider.provider !== "mock" && provider.configured)
    .map((provider) => provider.provider);
}

async function sessionFor(request: NextRequest, write: boolean) {
  return resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: `${write ? "PUT" : "GET"} /api/desktop/ai-providers`,
    allowApiKey: false,
    ...(write ? { requireWorkspaceAdmin: true } : {}),
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await sessionFor(request, false);
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const availableProviders = serviceEnabledProviders();
  const loaded = await loadWorkspaceAIProviderPolicyWithState(String(session.organizationId));
  if (loaded.storageState !== "ready") {
    return NextResponse.json({ ok: false, error: loaded.storageState === "migration_pending" ? "provider_policy_migration_pending" : "provider_policy_unavailable" }, { status: 503 });
  }
  const policy = resolveWorkspaceAIProviderPolicy({ stored: loaded.policy, serviceEnabled: availableProviders });
  const providers = availableProviders.map((provider) => ({
    provider,
    models: listModels(provider).map((model) => ({ id: model.id, label: model.label, tier: model.tier })),
  }));
  return NextResponse.json({ ok: true, data: { policy, providers } });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const session = await sessionFor(request, true);
  if (!session) return NextResponse.json({ ok: false, error: "workspace_admin_required" }, { status: 403 });
  const body = await request.json().catch(() => null) as { enabled?: unknown; allowedProviders?: unknown; modelSelections?: unknown; fallbackOrder?: unknown } | null;
  const policy = body ? normalizeWorkspaceAIProviderPolicy(body) : null;
  if (!policy) return NextResponse.json({ ok: false, error: "invalid_provider_policy" }, { status: 422 });
  const availableProviders = serviceEnabledProviders();
  if (policy.allowedProviders.some((provider) => !availableProviders.includes(provider))) {
    return NextResponse.json({ ok: false, error: "provider_unavailable" }, { status: 422 });
  }
  try {
    await saveWorkspaceAIProviderPolicy({
      organizationId: String(session.organizationId),
      policy,
      updatedBy: String(session.userId),
    });
    return NextResponse.json({ ok: true, data: { policy } });
  } catch (error) {
    const state = workspaceAIProviderPolicyStorageState(error);
    return NextResponse.json({ ok: false, error: state === "migration_pending" ? "provider_policy_migration_pending" : "provider_policy_unavailable" }, { status: 503 });
  }
}
