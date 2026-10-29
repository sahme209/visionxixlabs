import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { encryptScopedCredential } from "@/lib/security/credentialVault";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
import { AirflowClient, validateAirflowBaseUrl, type AirflowCredential } from "@/lib/integrations/airflow/airflowClient";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const mutationSelect = { id: true, organizationId: true, provider: true, status: true, updatedAt: true, encryptedCredential: true, revokedAt: true } as const;
class ConnectionChanged extends Error { constructor(){super("airflow_connection_changed");} }
async function currentAuthority(request: NextRequest, initial: { id: string; organizationId: string; userId: string }, method: string) {
  request.signal.throwIfAborted();
  const current = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:trigger", requiredCapability: "connections:manage", route: `${method} /api/desktop/airflow/connection`, allowApiKey: false });
  if (!current || current.credentialKind !== "desktop_session" || current.id !== initial.id || current.organizationId !== initial.organizationId || current.userId !== initial.userId) throw new ConnectionChanged();
  request.signal.throwIfAborted();
}
const observedWhere = (row: { id: string; organizationId: string; provider: string; status: string; updatedAt: Date; encryptedCredential: string; revokedAt: Date | null }) => ({
  id: row.id, organizationId: row.organizationId, provider: row.provider, status: row.status,
  updatedAt: new Date(row.updatedAt.getTime()), encryptedCredential: row.encryptedCredential, revokedAt: row.revokedAt,
});

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", requiredCapability: "workspace:read", route: "GET /api/desktop/airflow/connection", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const connection = await prisma.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId: String(session.organizationId), provider: "airflow" } }, select: { id: true, status: true, externalAccountId: true, scopesJson: true, lastValidatedAt: true, updatedAt: true, revokedAt: true } });
  const metadata = connection?.scopesJson as { baseUrl?: unknown; version?: unknown; dagCount?: unknown; authMode?: unknown } | null;
  return NextResponse.json({ ok: true, data: connection ? { connectionId: connection.id, connectionUpdatedAt: connection.updatedAt.toISOString(), connected: connection.status === "active" && !connection.revokedAt, status: connection.revokedAt ? "revoked" : connection.status, baseUrl: metadata?.baseUrl ?? connection.externalAccountId, version: metadata?.version ?? null, dagCount: metadata?.dagCount ?? null, authMode: metadata?.authMode ?? null, lastValidatedAt: connection.lastValidatedAt } : { connected: false, status: "not_connected" } }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:trigger", requiredCapability: "connections:manage", route: "PUT /api/desktop/airflow/connection", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { baseUrl?: unknown; authMode?: unknown; username?: unknown; password?: unknown; token?: unknown } | null;
  try {
    const baseUrl = await validateAirflowBaseUrl(typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "");
    const credential: AirflowCredential = body?.authMode === "username_password"
      ? { authMode: "username_password", username: typeof body.username === "string" ? body.username.trim() : "", password: typeof body.password === "string" ? body.password : "" }
      : { authMode: "token", token: typeof body?.token === "string" ? body.token : "" };
    if (credential.authMode === "username_password" ? (!credential.username || !credential.password) : !credential.token) return NextResponse.json({ ok: false, error: "credentials_required" }, { status: 400 });
    const organizationId = String(session.organizationId);
    // Capture before provider I/O: an older validation cannot undo a later disconnect or consent.
    const existing = await prisma.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId, provider: "airflow" } }, select: mutationSelect });
    const expected = existing ? observedWhere(existing) : null;
    const validation = await new AirflowClient(baseUrl, credential).validate();
    await currentAuthority(request, session, "PUT");
    const connectionId = existing?.id ?? randomUUID();
    const encryptedCredential = encryptScopedCredential(JSON.stringify(credential), connectionCredentialContext({ organizationId, provider: "airflow", connectionId }));
    const metadata = { baseUrl, version: validation.version, dagCount: validation.dagCount, authMode: credential.authMode, apiVersion: "v2" };
    const validatedAt = new Date();
    const connection = await prisma.$transaction(async tx => {
      await currentAuthority(request, session, "PUT");
      if (expected) {
        const saved = await tx.tenantIntegrationConnection.updateMany({ where: expected,
          data: { status: "active", encryptedCredential, externalAccountId: baseUrl, scopesJson: metadata, consentedByUserId: String(session.userId), consentedAt: validatedAt, lastValidatedAt: validatedAt, revokedAt: null } });
        if (saved.count !== 1) throw new ConnectionChanged();
      } else {
        // Unique organization/provider create refuses a concurrent new connection; no upsert fallback.
        await tx.tenantIntegrationConnection.create({ data: { id: connectionId, organizationId, provider: "airflow", status: "active", encryptedCredential, externalAccountId: baseUrl, scopesJson: metadata, consentedByUserId: String(session.userId), lastValidatedAt: validatedAt } });
      }
      await currentAuthority(request, session, "PUT");
      return { id: connectionId, status: "active", lastValidatedAt: validatedAt };
    });
    await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind: "airflow.connection.validated", subjectKind: "integration", subjectId: connection.id, summary: `Validated Apache Airflow ${validation.version ?? "3.x"} connection`, actorUserId: String(session.userId) });
    return NextResponse.json({ ok: true, data: { ...connection, baseUrl, ...validation } });
  } catch (error) {
    if (error instanceof ConnectionChanged) return NextResponse.json({ ok: false, error: "airflow_connection_changed" }, { status: 409 });
    return NextResponse.json({ ok: false, error: error instanceof Error && new Set(["airflow_url_invalid", "airflow_https_url_required", "airflow_origin_only_required", "airflow_private_host_blocked", "airflow_host_not_allowed", "airflow_auth_failed", "airflow_auth_response_invalid", "airflow_api_failed"]).has(error.message.split(":")[0]) ? error.message.split(":")[0] : "airflow_connection_failed" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:trigger", requiredCapability: "connections:manage", route: "DELETE /api/desktop/airflow/connection", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const organizationId = String(session.organizationId);
  try {
    const connection = await prisma.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId, provider: "airflow" } }, select: mutationSelect });
    const expected = connection ? observedWhere(connection) : null;
    await currentAuthority(request, session, "DELETE");
    if (connection && expected) {
      await prisma.$transaction(async tx => {
        await currentAuthority(request, session, "DELETE");
        const saved = await tx.tenantIntegrationConnection.updateMany({ where: expected, data: { status: "revoked", revokedAt: new Date() } });
        if (saved.count !== 1) throw new ConnectionChanged();
        await tx.airflowAutomation.updateMany({ where: { organizationId }, data: { enabled: false } });
        await currentAuthority(request, session, "DELETE");
      });
      await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind: "airflow.connection.revoked", subjectKind: "integration", subjectId: connection.id, summary: "Revoked Apache Airflow access and disabled its automations", actorUserId: String(session.userId) });
    }
    return NextResponse.json({ ok: true, data: { disconnected: true } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof ConnectionChanged ? "airflow_connection_changed" : "airflow_connection_failed" }, { status: error instanceof ConnectionChanged ? 409 : 503 });
  }
}
