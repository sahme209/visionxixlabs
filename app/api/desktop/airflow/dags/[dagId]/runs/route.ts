import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { loadAirflowClient } from "@/lib/integrations/airflow/connection";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ dagId: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", requiredCapability: "workspace:read", route: "GET /api/desktop/airflow/dags/[dagId]/runs", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  try { const { dagId } = await context.params; return NextResponse.json({ ok: true, data: { runs: await (await loadAirflowClient(String(session.organizationId))).client.listDagRuns(dagId) } }); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message.split(":")[0] : "airflow_unavailable" }, { status: 502 }); }
}

export async function POST(request: NextRequest, context: { params: Promise<{ dagId: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:trigger", requiredCapability: "deploy:execute", route: "POST /api/desktop/airflow/dags/[dagId]/runs", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  try {
    const { dagId } = await context.params;
    const body = await request.json().catch(() => ({})) as { conf?: unknown };
    const conf = body.conf && typeof body.conf === "object" && !Array.isArray(body.conf) ? body.conf as Record<string, unknown> : {};
    const organizationId = String(session.organizationId);
    const run = await (await loadAirflowClient(organizationId)).client.triggerDag(dagId, conf);
    await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind: "airflow.dag.triggered", subjectKind: "airflow_dag_run", subjectId: run.dagRunId, summary: `Triggered Airflow DAG ${dagId}`, actorUserId: String(session.userId) });
    return NextResponse.json({ ok: true, data: { run } }, { status: 201 });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message.split(":")[0] : "airflow_trigger_failed" }, { status: 502 }); }
}
