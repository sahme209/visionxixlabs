import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import {
  loadWorkspaceAIProviderPolicy,
  normalizeWorkspaceAIProviderPolicy,
  saveWorkspaceAIProviderPolicy,
} from "@/lib/ai/workspaceProviderPolicy";

export const dynamic = "force-dynamic";

async function ownerContext(): Promise<{ organizationId: string; userId: string } | null> {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId || !isAdminOrOwner({ email: ctx.email, roles: ctx.roles })) return null;
  return { organizationId: ctx.organizationId, userId: ctx.userId };
}

export async function GET(): Promise<NextResponse> {
  const ctx = await ownerContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "workspace_owner_required" }, { status: 403 });
  const policy = await loadWorkspaceAIProviderPolicy(ctx.organizationId);
  return NextResponse.json({ ok: true, data: { policy } });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const ctx = await ownerContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "workspace_owner_required" }, { status: 403 });
  const body = await request.json().catch(() => null) as { allowedProviders?: unknown; fallbackOrder?: unknown } | null;
  const policy = body ? normalizeWorkspaceAIProviderPolicy(body) : null;
  if (!policy) return NextResponse.json({ ok: false, error: "invalid_provider_policy" }, { status: 422 });
  try {
    await saveWorkspaceAIProviderPolicy({ organizationId: ctx.organizationId, policy, updatedBy: ctx.userId });
    return NextResponse.json({ ok: true, data: { policy } });
  } catch {
    return NextResponse.json({ ok: false, error: "provider_policy_unavailable" }, { status: 503 });
  }
}
