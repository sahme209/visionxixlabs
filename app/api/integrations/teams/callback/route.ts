import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { authorizationCredentialContext, connectionCredentialContext, digestAuthorizationState } from "@/lib/integrations/tenantAuthorization";
import { consumeTenantIntegrationAuthorization, type TenantConnectionRepo } from "@/lib/integrations/tenantConnectionRepo";
import { decryptScopedCredential, encryptScopedCredential } from "@/lib/security/credentialVault";
import { trustedAxiomUrl } from "@/lib/integrations/trustedCallbackUrl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ConnectionRow { id: string }
interface ConnectionRepo {
  tenantIntegrationConnection: {
    findUnique(args: { where: { organizationId_provider: { organizationId: string; provider: string } }; select: { id: true } }): Promise<ConnectionRow | null>;
    create(args: { data: { id: string; organizationId: string; provider: string; status: string; encryptedCredential: string; externalAccountId: string | null; scopesJson: string[]; consentedByUserId: string } }): Promise<unknown>;
    update(args: { where: { organizationId_provider: { organizationId: string; provider: string } }; data: { status: string; encryptedCredential: string; externalAccountId: string | null; scopesJson: string[]; consentedByUserId: string; consentedAt: Date; lastValidatedAt: null; revokedAt: null } }): Promise<unknown>;
  };
}

type MicrosoftTokenResponse = { access_token?: string; refresh_token?: string; scope?: string; expires_in?: number };

function returnToCompanion(status: string) {
  const destination = trustedAxiomUrl(`/auth/success?integration=teams&status=${encodeURIComponent(status)}`);
  return destination
    ? NextResponse.redirect(destination)
    : NextResponse.json({ ok: false, error: "trusted_return_url_unavailable" }, { status: 503 });
}

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const authorization = await consumeTenantIntegrationAuthorization(
    prisma as unknown as TenantConnectionRepo,
    { state, provider: "teams" },
  );
  if (!authorization.ok) return returnToCompanion("invalid_state");
  if (url.searchParams.get("error")) return returnToCompanion("declined");
  const code = url.searchParams.get("code");
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim() ?? "";
  const tenant = process.env.MICROSOFT_TENANT_ID?.trim() ?? "";
  if (!code || !clientId || !clientSecret || !tenant || !authorization.attempt.encryptedPkceVerifier) return returnToCompanion("unavailable");

  let verifier: string;
  try {
    verifier = decryptScopedCredential(
      authorization.attempt.encryptedPkceVerifier,
      authorizationCredentialContext({ organizationId: authorization.attempt.organizationId, provider: "teams", stateDigest: digestAuthorizationState(state) }),
    );
  } catch {
    return returnToCompanion("invalid_state");
  }

  let token: MicrosoftTokenResponse;
  try {
    const exchange = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code, redirect_uri: authorization.attempt.redirectUri, code_verifier: verifier }),
      cache: "no-store",
    });
    token = await exchange.json() as MicrosoftTokenResponse;
  } catch {
    return returnToCompanion("exchange_failed");
  }
  if (!token.access_token) return returnToCompanion("exchange_failed");

  const organizationId = authorization.attempt.organizationId;
  const connections = (prisma as unknown as ConnectionRepo).tenantIntegrationConnection;
  try {
    const existing = await connections.findUnique({ where: { organizationId_provider: { organizationId, provider: "teams" } }, select: { id: true } });
    const connectionId = existing?.id ?? randomUUID();
    const encryptedCredential = encryptScopedCredential(JSON.stringify({ accessToken: token.access_token, refreshToken: token.refresh_token ?? null, expiresIn: token.expires_in ?? null }), connectionCredentialContext({ organizationId, provider: "teams", connectionId }));
    const data = { status: "pending", encryptedCredential, externalAccountId: tenant, scopesJson: (token.scope ?? "").split(" ").filter(Boolean), consentedByUserId: authorization.attempt.initiatedByUserId };
    if (existing) await connections.update({ where: { organizationId_provider: { organizationId, provider: "teams" } }, data: { ...data, consentedAt: new Date(), lastValidatedAt: null, revokedAt: null } });
    else await connections.create({ data: { id: connectionId, organizationId, provider: "teams", ...data } });
    await recordAudit({
      organizationId: idFactory.organization(organizationId), actorUserId: idFactory.user(authorization.attempt.initiatedByUserId), actorKind: "user",
      action: "connector.connect", outcome: "success", entityRef: "connector:teams", correlationId: idFactory.correlation(`teams_consent_${Date.now().toString(36)}`), source: "live",
      detail: { scopeCount: data.scopesJson.length, validationRequired: true },
    });
  } catch {
    return returnToCompanion("record_failed");
  }
  return returnToCompanion("consent_recorded");
}
