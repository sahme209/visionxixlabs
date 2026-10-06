import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
import { decryptScopedCredential, encryptScopedCredential } from "@/lib/security/credentialVault";
import { microsoftCredentialRefreshDue, parseStoredMicrosoftCredential, type StoredMicrosoftCredential } from "@/lib/integrations/microsoftCredential";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface TeamsConnectionRow { id: string; status: string; encryptedCredential: string }
interface TeamsConnectionRepo {
  tenantIntegrationConnection: {
    findUnique(args: { where: { organizationId_provider: { organizationId: string; provider: string } }; select: { id: true; status: true; encryptedCredential: true } }): Promise<TeamsConnectionRow | null>;
    update(args: { where: { id: string }; data: { status: string; lastValidatedAt?: Date; encryptedCredential?: string } }): Promise<unknown>;
  };
}

type MicrosoftRefreshResponse = { access_token?: string; refresh_token?: string; expires_in?: number };

async function audit(input: { organizationId: string; userId: string; action: "connector.validate.success" | "connector.validate.failure"; connectionId: string }) {
  await recordAudit({
    organizationId: idFactory.organization(input.organizationId), actorUserId: idFactory.user(input.userId), actorKind: "user",
    action: input.action, outcome: input.action.endsWith("success") ? "success" : "failure", entityRef: `connector:teams:${input.connectionId}`,
    correlationId: idFactory.correlation(`teams_validate_${Date.now().toString(36)}`), source: "live", detail: { provider: "teams", validationMode: "identity_read" },
  });
}

/** Verifies the saved Microsoft identity using a minimal Graph read. No team,
 * channel, message, or provider identity data is returned to the desktop. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/integrations/teams/validate",
    allowApiKey: false,
    requireWorkspaceAdmin: true,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const repo = prisma as unknown as TeamsConnectionRepo;
  let connection: TeamsConnectionRow | null;
  try {
    connection = await repo.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId: session.organizationId, provider: "teams" } }, select: { id: true, status: true, encryptedCredential: true } });
  } catch {
    return NextResponse.json({ ok: false, error: "teams_connection_unavailable" }, { status: 503 });
  }
  if (!connection || connection.status === "revoked") return NextResponse.json({ ok: false, error: "teams_not_connected" }, { status: 409 });

  let credential: StoredMicrosoftCredential;
  try {
    const stored = parseStoredMicrosoftCredential(decryptScopedCredential(connection.encryptedCredential, connectionCredentialContext({ organizationId: session.organizationId, provider: "teams", connectionId: connection.id })));
    if (!stored) throw new Error("missing_access_token");
    credential = stored;
  } catch {
    await repo.tenantIntegrationConnection.update({ where: { id: connection.id }, data: { status: "needs_attention" } });
    await audit({ organizationId: session.organizationId, userId: session.userId, action: "connector.validate.failure", connectionId: connection.id });
    return NextResponse.json({ ok: false, error: "teams_credential_unavailable" }, { status: 503 });
  }

  try {
    if (microsoftCredentialRefreshDue(credential)) credential = await refreshMicrosoftCredential(credential);
    let response = await graphIdentityRead(credential.accessToken);
    if (response.status === 401 && credential.refreshToken) {
      credential = await refreshMicrosoftCredential(credential);
      response = await graphIdentityRead(credential.accessToken);
    }
    if (!response.ok) throw new Error("teams_validation_failed");
    const encryptedCredential = encryptScopedCredential(JSON.stringify(credential), connectionCredentialContext({ organizationId: session.organizationId, provider: "teams", connectionId: connection.id }));
    await repo.tenantIntegrationConnection.update({ where: { id: connection.id }, data: { status: "active", lastValidatedAt: new Date(), encryptedCredential } });
    await audit({ organizationId: session.organizationId, userId: session.userId, action: "connector.validate.success", connectionId: connection.id });
    return NextResponse.json({ ok: true, data: { status: "active" } });
  } catch {
    await repo.tenantIntegrationConnection.update({ where: { id: connection.id }, data: { status: "needs_attention" } });
    await audit({ organizationId: session.organizationId, userId: session.userId, action: "connector.validate.failure", connectionId: connection.id });
    return NextResponse.json({ ok: false, error: "teams_validation_failed" }, { status: 503 });
  }
}

async function graphIdentityRead(accessToken: string): Promise<Response> {
  return fetch("https://graph.microsoft.com/v1.0/me?$select=id", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
}

async function refreshMicrosoftCredential(current: StoredMicrosoftCredential): Promise<StoredMicrosoftCredential> {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim() ?? "";
  const tenant = process.env.MICROSOFT_TENANT_ID?.trim() ?? "";
  if (!current.refreshToken || !clientId || !clientSecret || !tenant) throw new Error("teams_refresh_unavailable");
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: current.refreshToken }),
    cache: "no-store",
  });
  const refreshed = await response.json().catch(() => null) as MicrosoftRefreshResponse | null;
  if (!response.ok || !refreshed?.access_token) throw new Error("teams_refresh_failed");
  const expiresAt = typeof refreshed.expires_in === "number" && Number.isFinite(refreshed.expires_in) && refreshed.expires_in > 0
    ? Date.now() + refreshed.expires_in * 1000
    : null;
  return { accessToken: refreshed.access_token, refreshToken: refreshed.refresh_token ?? current.refreshToken, expiresAt };
}
