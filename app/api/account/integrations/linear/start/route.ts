import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { trustedIntegrationCallbackUrl } from "@/lib/integrations/trustedCallbackUrl";
import { prisma } from "@/lib/db";
import { startTenantIntegrationAuthorization, type TenantConnectionRepo } from "@/lib/integrations/tenantConnectionRepo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false, error: "invalid_request_origin" }, { status: 403 });
  const context = await currentContext();
  if (!context.isAuthenticated || !context.organizationId || !context.userId) return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  if (!isAdminOrOwner({ email: context.email, roles: context.roles })) return NextResponse.json({ ok: false, error: "workspace_owner_required" }, { status: 403 });

  const clientId = process.env.LINEAR_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.LINEAR_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = trustedIntegrationCallbackUrl("/api/integrations/linear/callback");
  if (!clientId || !clientSecret || !redirectUri) return NextResponse.json({ ok: false, error: "linear_not_configured" }, { status: 503 });

  const verifier = randomBytes(48).toString("base64url");
  try {
    const authorization = await startTenantIntegrationAuthorization(
      prisma as unknown as TenantConnectionRepo,
      { organizationId: context.organizationId, provider: "linear", redirectUri, initiatedByUserId: context.userId, pkceVerifier: verifier },
    );
    const consentUrl = new URL("https://linear.app/oauth/authorize");
    consentUrl.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "read,issues:create",
      state: authorization.state,
      actor: "app",
      prompt: "consent",
      code_challenge: pkceChallenge(verifier),
      code_challenge_method: "S256",
    }).toString();
    return NextResponse.json({ ok: true, data: { consentUrl: consentUrl.toString() } });
  } catch {
    return NextResponse.json({ ok: false, error: "authorization_unavailable" }, { status: 503 });
  }
}
