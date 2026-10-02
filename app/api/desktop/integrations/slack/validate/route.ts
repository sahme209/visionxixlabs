import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
import { decryptScopedCredential } from "@/lib/security/credentialVault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SlackConnectionRow { id: string; status: string; encryptedCredential: string }
interface SlackConnectionRepo {
  tenantIntegrationConnection: {
    findUnique(args: { where: { organizationId_provider: { organizationId: string; provider: string } }; select: { id: true; status: true; encryptedCredential: true } }): Promise<SlackConnectionRow | null>;
    update(args: { where: { id: string }; data: { status: string; lastValidatedAt?: Date } }): Promise<unknown>;
  };
}

async function audit(input: { organizationId: string; userId: string; action: "connector.validate.success" | "connector.validate.failure"; connectionId: string }) {
  await recordAudit({
    organizationId: idFactory.organization(input.organizationId), actorUserId: idFactory.user(input.userId), actorKind: "user",
    action: input.action, outcome: input.action.endsWith("success") ? "success" : "failure", entityRef: `connector:slack:${input.connectionId}`,
    correlationId: idFactory.correlation(`slack_validate_${Date.now().toString(36)}`), source: "live", detail: { provider: "slack" },
  });
}

/** Validates only that Slack accepts the stored tenant-bound token. It sends
 * no message, returns no provider data, and is the sole active-state transition. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", route: "POST /api/desktop/integrations/slack/validate" });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const repo = prisma as unknown as SlackConnectionRepo;
  let connection: SlackConnectionRow | null;
  try {
    connection = await repo.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId: session.organizationId, provider: "slack" } }, select: { id: true, status: true, encryptedCredential: true } });
  } catch {
    return NextResponse.json({ ok: false, error: "slack_connection_unavailable" }, { status: 503 });
  }
  if (!connection || connection.status === "revoked") return NextResponse.json({ ok: false, error: "slack_not_connected" }, { status: 409 });

  let token: string;
  try {
    token = decryptScopedCredential(connection.encryptedCredential, connectionCredentialContext({ organizationId: session.organizationId, provider: "slack", connectionId: connection.id }));
  } catch {
    await repo.tenantIntegrationConnection.update({ where: { id: connection.id }, data: { status: "needs_attention" } });
    await audit({ organizationId: session.organizationId, userId: session.userId, action: "connector.validate.failure", connectionId: connection.id });
    return NextResponse.json({ ok: false, error: "slack_credential_unavailable" }, { status: 503 });
  }

  try {
    const response = await fetch("https://slack.com/api/auth.test", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const result = await response.json().catch(() => null) as { ok?: boolean } | null;
    if (!response.ok || !result?.ok) throw new Error("slack_validation_failed");
    await repo.tenantIntegrationConnection.update({ where: { id: connection.id }, data: { status: "active", lastValidatedAt: new Date() } });
    await audit({ organizationId: session.organizationId, userId: session.userId, action: "connector.validate.success", connectionId: connection.id });
    return NextResponse.json({ ok: true, data: { status: "active" } });
  } catch {
    await repo.tenantIntegrationConnection.update({ where: { id: connection.id }, data: { status: "needs_attention" } });
    await audit({ organizationId: session.organizationId, userId: session.userId, action: "connector.validate.failure", connectionId: connection.id });
    return NextResponse.json({ ok: false, error: "slack_validation_failed" }, { status: 503 });
  }
}
