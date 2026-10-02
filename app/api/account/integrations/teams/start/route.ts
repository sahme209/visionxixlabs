import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import { startTenantIntegrationAuthorization, type TenantConnectionRepo } from "@/lib/integrations/tenantConnectionRepo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Starts a Microsoft authorization-code flow with PKCE. Initial scope only
 * verifies the signed-in Microsoft identity; Teams message permissions remain
 * unavailable until separately reviewed and approved. */
export async function POST(request: NextRequest): Promise<Response> {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.organizationId || !context.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!isAdminOrOwner({ email: context.email, roles: context.roles })) {
    return NextResponse.json({ ok: false, error: "workspace_owner_required" }, { status: 403 });
  }
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim() ?? "";
  const tenant = process.env.MICROSOFT_TENANT_ID?.trim() ?? "";
  if (!clientId || !clientSecret || !tenant) {
    return NextResponse.json({ ok: false, error: "teams_not_configured" }, { status: 503 });
  }

  const redirectUri = new URL("/api/integrations/teams/callback", request.url).toString();
  const verifier = randomBytes(48).toString("base64url");
  try {
    const authorization = await startTenantIntegrationAuthorization(
      prisma as unknown as TenantConnectionRepo,
      { organizationId: context.organizationId, provider: "teams", redirectUri, initiatedByUserId: context.userId, pkceVerifier: verifier },
    );
    const consentUrl = new URL(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`);
    consentUrl.search = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: "openid offline_access User.Read",
      code_challenge: pkceChallenge(verifier),
      code_challenge_method: "S256",
      state: authorization.state,
    }).toString();
    return NextResponse.json({ ok: true, data: { consentUrl: consentUrl.toString() } });
  } catch {
    return NextResponse.json({ ok: false, error: "authorization_unavailable" }, { status: 503 });
  }
}
