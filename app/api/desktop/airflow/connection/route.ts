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

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", requiredCapability: "workspace:read", route: "GET /api/desktop/airflow/connection", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const connection = await prisma.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId: String(session.organizationId), provider: "airflow" } }, select: { id: true, status: true, externalAccountId: true, scopesJson: true, lastValidatedAt: true, updatedAt: true } });
  const metadata = connection?.scopesJson as { baseUrl?: unknown; version?: unknown; dagCount?: unknown; authMode?: unknown } | null;
  return NextResponse.json({ ok: true, data: connection ? { connected: connection.status === "active", status: connection.status, baseUrl: metadata?.baseUrl ?? connection.externalAccountId, version: metadata?.version ?? null, dagCount: metadata?.dagCount ?? null, authMode: metadata?.authMode ?? null, lastValidatedAt: connection.lastValidatedAt } : { connected: false, status: "not_connected" } });
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
    const validation = await new AirflowClient(baseUrl, credential).validate();
    const organizationId = String(session.organizationId);
    const existing = await prisma.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId, provider: "airflow" } }, select: { id: true } });
    const connectionId = existing?.id ?? randomUUID();
    const encryptedCredential = encryptScopedCredential(JSON.stringify(credential), connectionCredentialContext({ organizationId, provider: "airflow", connectionId }));
    const metadata = { baseUrl, version: validation.version, dagCount: validation.dagCount, authMode: credential.authMode, apiVersion: "v2" };
    const connection = await prisma.tenantIntegrationConnection.upsert({
      where: { organizationId_provider: { organizationId, provider: "airflow" } },
      create: { id: connectionId, organizationId, provider: "airflow", status: "active", encryptedCredential, externalAccountId: baseUrl, scopesJson: metadata, consentedByUserId: String(session.userId), lastValidatedAt: new Date() },
      update: { status: "active", encryptedCredential, externalAccountId: baseUrl, scopesJson: metadata, consentedByUserId: String(session.userId), consentedAt: new Date(), lastValidatedAt: new Date(), revokedAt: null },
      select: { id: true, status: true, lastValidatedAt: true },
    });
    await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind: "airflow.connection.validated", subjectKind: "integration", subjectId: connection.id, summary: `Validated Apache Airflow ${validation.version ?? "3.x"} connection`, actorUserId: String(session.userId) });
    return NextResponse.json({ ok: true, data: { ...connection, baseUrl, ...validation } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message.split(":")[0] : "airflow_connection_failed" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:trigger", requiredCapability: "connections:manage", route: "DELETE /api/desktop/airflow/connection", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const organizationId = String(session.organizationId);
  const connection = await prisma.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId, provider: "airflow" } }, select: { id: true } });
  if (connection) {
    await prisma.$transaction([
      prisma.airflowAutomation.updateMany({ where: { organizationId }, data: { enabled: false } }),
      prisma.tenantIntegrationConnection.update({ where: { id: connection.id }, data: { status: "revoked", revokedAt: new Date() } }),
    ]);
    await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind: "airflow.connection.revoked", subjectKind: "integration", subjectId: connection.id, summary: "Revoked Apache Airflow access and disabled its automations", actorUserId: String(session.userId) });
  }
  return NextResponse.json({ ok: true, data: { disconnected: true } });
}
