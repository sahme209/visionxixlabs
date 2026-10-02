import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
import { decryptScopedCredential } from "@/lib/security/credentialVault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface TeamsConnectionRow { id: string; status: string; encryptedCredential: string }
interface TeamsConnectionRepo {
  tenantIntegrationConnection: {
    findUnique(args: { where: { organizationId_provider: { organizationId: string; provider: string } }; select: { id: true; status: true; encryptedCredential: true } }): Promise<TeamsConnectionRow | null>;
    update(args: { where: { id: string }; data: { status: string; lastValidatedAt?: Date } }): Promise<unknown>;
  };
}

type StoredMicrosoftCredential = { accessToken?: unknown };

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
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", route: "POST /api/desktop/integrations/teams/validate" });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const repo = prisma as unknown as TeamsConnectionRepo;
  let connection: TeamsConnectionRow | null;
  try {
    connection = await repo.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId: session.organizationId, provider: "teams" } }, select: { id: true, status: true, encryptedCredential: true } });
  } catch {
    return NextResponse.json({ ok: false, error: "teams_connection_unavailable" }, { status: 503 });
  }
  if (!connection || connection.status === "revoked") return NextResponse.json({ ok: false, error: "teams_not_connected" }, { status: 409 });

  let accessToken: string;
  try {
    const stored = JSON.parse(decryptScopedCredential(connection.encryptedCredential, connectionCredentialContext({ organizationId: session.organizationId, provider: "teams", connectionId: connection.id }))) as StoredMicrosoftCredential;
    if (typeof stored.accessToken !== "string" || !stored.accessToken) throw new Error("missing_access_token");
    accessToken = stored.accessToken;
  } catch {
    await repo.tenantIntegrationConnection.update({ where: { id: connection.id }, data: { status: "needs_attention" } });
    await audit({ organizationId: session.organizationId, userId: session.userId, action: "connector.validate.failure", connectionId: connection.id });
    return NextResponse.json({ ok: false, error: "teams_credential_unavailable" }, { status: 503 });
  }

  try {
    const response = await fetch("https://graph.microsoft.com/v1.0/me?$select=id", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    if (!response.ok) throw new Error("teams_validation_failed");
    await repo.tenantIntegrationConnection.update({ where: { id: connection.id }, data: { status: "active", lastValidatedAt: new Date() } });
    await audit({ organizationId: session.organizationId, userId: session.userId, action: "connector.validate.success", connectionId: connection.id });
    return NextResponse.json({ ok: true, data: { status: "active" } });
  } catch {
    await repo.tenantIntegrationConnection.update({ where: { id: connection.id }, data: { status: "needs_attention" } });
    await audit({ organizationId: session.organizationId, userId: session.userId, action: "connector.validate.failure", connectionId: connection.id });
    return NextResponse.json({ ok: false, error: "teams_validation_failed" }, { status: 503 });
  }
}
