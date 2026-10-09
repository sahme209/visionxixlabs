import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:trigger", requiredCapability: "policy:manage", route: "PATCH /api/desktop/airflow/automations/[id]", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== "boolean") return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  const existing = await prisma.airflowAutomation.findFirst({ where: { id, organizationId: String(session.organizationId) } });
  if (!existing) return NextResponse.json({ ok: false, error: "automation_not_found" }, { status: 404 });
  const automation = await prisma.airflowAutomation.update({ where: { id }, data: { enabled: body.enabled } });
  await appendAuditEvent(prisma as unknown as AuditEventRepo, {
    organizationId: String(session.organizationId),
    kind: body.enabled ? "airflow.automation.enabled" : "airflow.automation.paused",
    subjectKind: "automation",
    subjectId: automation.id,
    summary: `${body.enabled ? "Enabled" : "Paused"} Airflow automation ${automation.name}`,
    actorUserId: String(session.userId),
  });
  return NextResponse.json({ ok: true, data: { automation } });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:trigger", requiredCapability: "policy:manage", route: "DELETE /api/desktop/airflow/automations/[id]", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const { id } = await context.params;
  const organizationId = String(session.organizationId);
  const existing = await prisma.airflowAutomation.findFirst({ where: { id, organizationId }, select: { id: true, name: true, _count: { select: { executions: true } } } });
  if (!existing) return NextResponse.json({ ok: false, error: "automation_not_found" }, { status: 404 });
  if (existing._count.executions > 0) return NextResponse.json({ ok: false, error: "automation_has_audit_history_pause_instead" }, { status: 409 });
  await prisma.airflowAutomation.delete({ where: { id } });
  await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind: "airflow.automation.deleted", subjectKind: "automation", subjectId: id, summary: `Deleted unused Airflow automation ${existing.name}`, actorUserId: String(session.userId) });
  return NextResponse.json({ ok: true, data: { deleted: true } });
}
