import { publicAirflowError } from "@/lib/integrations/airflow/publicError";
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
  catch (error) { return NextResponse.json({ ok: false, error: publicAirflowError(error, "airflow_unavailable") }, { status: 502 }); }
}

export async function POST(request: NextRequest, context: { params: Promise<{ dagId: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:trigger", requiredCapability: "deploy:execute", route: "POST /api/desktop/airflow/dags/[dagId]/runs", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const identity=Object.freeze({id:session.id,userId:session.userId,organizationId:session.organizationId});
  try {
    const { dagId } = await context.params;
    const body = await request.json().catch(() => ({})) as { conf?: unknown };
    const conf = body.conf && typeof body.conf === "object" && !Array.isArray(body.conf) ? body.conf as Record<string, unknown> : {};
    const organizationId = String(identity.organizationId);
    const beforeWrite=async(signal:AbortSignal)=>{
      signal.throwIfAborted();const current=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:trigger',requiredCapability:'deploy:execute',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'Airflow DAG trigger current authority'});
      if(!current||current.credentialKind!=='desktop_session'||current.id!==identity.id||current.userId!==identity.userId||current.organizationId!==identity.organizationId||!current.capabilities.includes('deploy:execute'))throw Error('airflow_mutation_authority_unavailable');signal.throwIfAborted();
      const persisted=await prisma.desktopSessionRecord.findUnique({where:{id:identity.id},select:{id:true,userId:true,organizationId:true,expiresAt:true,revokedAt:true}});
      if(!persisted||persisted.id!==identity.id||persisted.userId!==identity.userId||persisted.organizationId!==identity.organizationId||persisted.revokedAt!==null||!(persisted.expiresAt instanceof Date)||!Number.isFinite(persisted.expiresAt.getTime()))throw Error('airflow_mutation_authority_unavailable');
      const expiresAt=persisted.expiresAt.getTime();
      const assertFresh=()=>{signal.throwIfAborted();if(Date.now()>=expiresAt)throw Error('airflow_mutation_authority_unavailable')};
      assertFresh();return assertFresh;
    };
    const run = await (await loadAirflowClient(organizationId,{beforeWrite,signal:request.signal})).client.triggerDag(dagId, conf);
    await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind: "airflow.dag.triggered", subjectKind: "airflow_dag_run", subjectId: run.dagRunId, summary: `Triggered Airflow DAG ${dagId}`, actorUserId: String(identity.userId) });
    return NextResponse.json({ ok: true, data: { run } }, { status: 201 });
  } catch (error) { return NextResponse.json({ ok: false, error: publicAirflowError(error, "airflow_trigger_failed") }, { status: error instanceof Error&&['governance_execution_coverage_unavailable','airflow_mutation_authority_unavailable','airflow_connection_changed'].includes(error.message)?409:502 }); }
}
