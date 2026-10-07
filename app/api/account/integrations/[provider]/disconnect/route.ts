import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROVIDERS = new Set(["slack", "teams", "linear"]);

interface DisconnectRepo {
  tenantIntegrationConnection: {
    updateMany(args: {
      where: { organizationId: string; provider: string; status: { not: string } };
      data: { status: string; encryptedCredential: string; externalAccountId: null; scopesJson: string[]; lastValidatedAt: null; revokedAt: Date };
    }): Promise<{ count: number }>;
  };
}

/**
 * Revokes Axiom's local authority over a tenant OAuth connection. The secret
 * is erased before the browser receives a response; the provider's separate
 * account-side app management remains available as an additional safeguard.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ provider: string }> }): Promise<Response> {
  if (!isSameOriginRequest(_request)) {
    return NextResponse.json({ ok: false, error: "invalid_request_origin" }, { status: 403 });
  }
  const context = await currentContext();
  if (!context.isAuthenticated || !context.organizationId || !context.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!isAdminOrOwner({ email: context.email, roles: context.roles })) {
    return NextResponse.json({ ok: false, error: "workspace_owner_required" }, { status: 403 });
  }
  const { provider } = await params;
  if (!PROVIDERS.has(provider)) return NextResponse.json({ ok: false, error: "unsupported_provider" }, { status: 404 });

  try {
    const result = await (prisma as unknown as DisconnectRepo).tenantIntegrationConnection.updateMany({
      where: { organizationId: context.organizationId, provider, status: { not: "revoked" } },
      data: { status: "revoked", encryptedCredential: "", externalAccountId: null, scopesJson: [], lastValidatedAt: null, revokedAt: new Date() },
    });
    if (result.count === 0) return NextResponse.json({ ok: false, error: "connection_not_active" }, { status: 409 });
    await recordAudit({
      organizationId: idFactory.organization(context.organizationId), actorUserId: idFactory.user(context.userId), actorKind: "user",
      action: "connector.disconnect", outcome: "success", entityRef: `connector:${provider}`,
      correlationId: idFactory.correlation(`connector_disconnect_${Date.now().toString(36)}`), source: "live",
      detail: { credentialErased: true },
    });
    return NextResponse.json({ ok: true, data: { provider, status: "revoked" } });
  } catch {
    return NextResponse.json({ ok: false, error: "disconnect_unavailable" }, { status: 503 });
  }
}
