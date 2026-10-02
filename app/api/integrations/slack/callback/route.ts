import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
import { consumeTenantIntegrationAuthorization, type TenantConnectionRepo } from "@/lib/integrations/tenantConnectionRepo";
import { encryptScopedCredential } from "@/lib/security/credentialVault";

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

type SlackTokenResponse = { ok?: boolean; access_token?: string; scope?: string; team?: { id?: string } };

function returnToCompanion(request: NextRequest, status: string) {
  return NextResponse.redirect(new URL(`/auth/success?integration=slack&status=${status}`, request.url));
}

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const authorization = await consumeTenantIntegrationAuthorization(
    prisma as unknown as TenantConnectionRepo,
    { state, provider: "slack" },
  );
  if (!authorization.ok) return returnToCompanion(request, "invalid_state");
  if (url.searchParams.get("error")) return returnToCompanion(request, "declined");

  const code = url.searchParams.get("code");
  const clientId = process.env.SLACK_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.SLACK_CLIENT_SECRET?.trim() ?? "";
  if (!code || !clientId || !clientSecret) return returnToCompanion(request, "unavailable");

  let token: SlackTokenResponse;
  try {
    const exchange = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: authorization.attempt.redirectUri }),
      cache: "no-store",
    });
    token = await exchange.json() as SlackTokenResponse;
  } catch {
    return returnToCompanion(request, "exchange_failed");
  }
  if (!token.ok || !token.access_token) return returnToCompanion(request, "exchange_failed");

  const organizationId = authorization.attempt.organizationId;
  const connections = (prisma as unknown as ConnectionRepo).tenantIntegrationConnection;
  try {
    const existing = await connections.findUnique({ where: { organizationId_provider: { organizationId, provider: "slack" } }, select: { id: true } });
    const connectionId = existing?.id ?? randomUUID();
    const encryptedCredential = encryptScopedCredential(token.access_token, connectionCredentialContext({ organizationId, provider: "slack", connectionId }));
    const data = {
      status: "pending",
      encryptedCredential,
      externalAccountId: token.team?.id ?? null,
      scopesJson: (token.scope ?? "").split(/[ ,]+/).filter(Boolean),
      consentedByUserId: authorization.attempt.initiatedByUserId,
    };
    if (existing) {
      await connections.update({ where: { organizationId_provider: { organizationId, provider: "slack" } }, data: { ...data, consentedAt: new Date(), lastValidatedAt: null, revokedAt: null } });
    } else {
      await connections.create({ data: { id: connectionId, organizationId, provider: "slack", ...data } });
    }
    await recordAudit({
      organizationId: idFactory.organization(organizationId), actorUserId: idFactory.user(authorization.attempt.initiatedByUserId), actorKind: "user",
      action: "connector.connect", outcome: "success", entityRef: "connector:slack", correlationId: idFactory.correlation(`slack_consent_${Date.now().toString(36)}`), source: "live",
      detail: { scopeCount: data.scopesJson.length, validationRequired: true },
    });
  } catch {
    return returnToCompanion(request, "record_failed");
  }
  return returnToCompanion(request, "consent_recorded");
}
