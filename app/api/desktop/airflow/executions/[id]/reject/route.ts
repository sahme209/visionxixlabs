import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:trigger", requiredCapability: "agent:approve", route: "POST /api/desktop/airflow/executions/[id]/reject", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const { id } = await context.params;
  const organizationId = String(session.organizationId);
  const updated = await prisma.airflowAutomationExecution.updateMany({ where: { id, organizationId, status: "pending_approval" }, data: { status: "rejected", decidedByUserId: String(session.userId), decidedAt: new Date(), completedAt: new Date() } });
  if (!updated.count) return NextResponse.json({ ok: false, error: "execution_not_awaiting_approval" }, { status: 409 });
  await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind: "airflow.action.rejected", subjectKind: "automation", subjectId: id, outcome: "rejected", summary: "Rejected an Airflow automation action", actorUserId: String(session.userId) });
  return NextResponse.json({ ok: true, data: { rejected: true } });
}
