import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
import { decryptScopedCredential, encryptScopedCredential } from "@/lib/security/credentialVault";
import { linearCredentialRefreshDue, parseStoredLinearCredential, type StoredLinearCredential } from "@/lib/integrations/linearCredential";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ConnectionRow { id: string; status: string; encryptedCredential: string }
interface ConnectionRepo {
  tenantIntegrationConnection: {
    findUnique(args: { where: { organizationId_provider: { organizationId: string; provider: string } }; select: { id: true; status: true; encryptedCredential: true } }): Promise<ConnectionRow | null>;
    update(args: { where: { id: string }; data: { status: string; lastValidatedAt?: Date; encryptedCredential?: string; externalAccountId?: string } }): Promise<unknown>;
  };
}

type LinearRefreshResponse = { access_token?: string; refresh_token?: string; expires_in?: number };

async function audit(input: { organizationId: string; userId: string; action: "connector.validate.success" | "connector.validate.failure"; connectionId: string }) {
  await recordAudit({
    organizationId: idFactory.organization(input.organizationId), actorUserId: idFactory.user(input.userId), actorKind: "user",
    action: input.action, outcome: input.action.endsWith("success") ? "success" : "failure", entityRef: `connector:linear:${input.connectionId}`,
    correlationId: idFactory.correlation(`linear_validate_${Date.now().toString(36)}`), source: "live", detail: { provider: "linear" },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", route: "POST /api/desktop/integrations/linear/validate", allowApiKey: false, requireWorkspaceAdmin: true });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const repo = prisma as unknown as ConnectionRepo;
  const connection = await repo.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId: session.organizationId, provider: "linear" } }, select: { id: true, status: true, encryptedCredential: true } }).catch(() => null);
  if (!connection || connection.status === "revoked") return NextResponse.json({ ok: false, error: "linear_not_connected" }, { status: 409 });

  let credential: StoredLinearCredential;
  try {
    const parsed = parseStoredLinearCredential(decryptScopedCredential(connection.encryptedCredential, connectionCredentialContext({ organizationId: session.organizationId, provider: "linear", connectionId: connection.id })));
    if (!parsed) throw new Error("credential_invalid");
    credential = parsed;
  } catch {
    await repo.tenantIntegrationConnection.update({ where: { id: connection.id }, data: { status: "needs_attention" } });
    await audit({ organizationId: session.organizationId, userId: session.userId, action: "connector.validate.failure", connectionId: connection.id });
    return NextResponse.json({ ok: false, error: "linear_credential_unavailable" }, { status: 503 });
  }

  try {
    if (linearCredentialRefreshDue(credential)) credential = await refreshCredential(credential);
    let identity = await readIdentity(credential.accessToken);
    if (identity.status === 401 && credential.refreshToken) {
      credential = await refreshCredential(credential);
      identity = await readIdentity(credential.accessToken);
    }
    if (!identity.ok) throw new Error("linear_validation_failed");
    const payload = await identity.json() as { data?: { viewer?: { id?: string } }; errors?: unknown[] };
    const externalAccountId = payload.data?.viewer?.id;
    if (!externalAccountId || payload.errors?.length) throw new Error("linear_validation_failed");
    const encryptedCredential = encryptScopedCredential(JSON.stringify(credential), connectionCredentialContext({ organizationId: session.organizationId, provider: "linear", connectionId: connection.id }));
    await repo.tenantIntegrationConnection.update({ where: { id: connection.id }, data: { status: "active", lastValidatedAt: new Date(), encryptedCredential, externalAccountId } });
    await audit({ organizationId: session.organizationId, userId: session.userId, action: "connector.validate.success", connectionId: connection.id });
    return NextResponse.json({ ok: true, data: { status: "active" } });
  } catch {
    await repo.tenantIntegrationConnection.update({ where: { id: connection.id }, data: { status: "needs_attention" } });
    await audit({ organizationId: session.organizationId, userId: session.userId, action: "connector.validate.failure", connectionId: connection.id });
    return NextResponse.json({ ok: false, error: "linear_validation_failed" }, { status: 503 });
  }
}

function readIdentity(accessToken: string) {
  return fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: "query AxiomConnectionIdentity { viewer { id } }" }),
    cache: "no-store",
  });
}

async function refreshCredential(current: StoredLinearCredential): Promise<StoredLinearCredential> {
  const clientId = process.env.LINEAR_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.LINEAR_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret || !current.refreshToken) throw new Error("linear_refresh_unavailable");
  const response = await fetch("https://api.linear.app/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: current.refreshToken, client_id: clientId, client_secret: clientSecret }),
    cache: "no-store",
  });
  const refreshed = await response.json() as LinearRefreshResponse;
  if (!response.ok || !refreshed.access_token) throw new Error("linear_refresh_failed");
  return {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? current.refreshToken,
    expiresAt: typeof refreshed.expires_in === "number" && refreshed.expires_in > 0 ? Date.now() + refreshed.expires_in * 1000 : null,
  };
}
