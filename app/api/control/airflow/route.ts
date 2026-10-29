import { NextResponse, type NextRequest } from 'next/server';
import { currentContext } from '@/lib/auth/currentContext';
import { prisma } from '@/lib/db';
import { readDesktopCommercialAccess } from '@/lib/desktop/desktopCommercialAccess';
import { hasDesktopCapability, type DesktopWorkspaceRole } from '@/lib/desktop/desktopAuthorization';
import { loadAirflowClient } from '@/lib/integrations/airflow/connection';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store'};
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers});
const error=(message:string,status:number)=>reply({ok:false,error:message},status);
const roles:readonly string[]=['owner','admin','operator','security_reviewer','finance_viewer','read_only'];
const selection=(value:string|null)=>Boolean(value?.trim()) && value !== '~' && value!.length <= 512;

/** Browser monitoring only. Credential changes and execution authority retain
 * their existing paired-desktop routes; no browser token is minted or reused. */
export async function GET(request:NextRequest) {
 try {
  const context=await currentContext();
  if(!context.isAuthenticated || !context.organizationId || !context.userId) return error('Sign in to view Airflow.',401);
  const role=context.roles.find(value=>roles.includes(value)) as DesktopWorkspaceRole | undefined;
  if(!hasDesktopCapability(role,'workspace:read')) return error('A current workspace membership is required.',403);
  const organizationId=String(context.organizationId);
  if(!(await readDesktopCommercialAccess(organizationId)).allowed) return error('Workspace access must be verified before reading Airflow.',403);
  const query=request.nextUrl.searchParams;
  const view=query.get('view') ?? 'overview';
  const dag=query.get('dag');const run=query.get('run');const rawOffset=query.get('offset');const offset=rawOffset===null ? 0:Number(rawOffset);
  if(!['overview','dags','runs','tasks'].includes(view) || (['runs','tasks'].includes(view) && !selection(dag)) || (view==='tasks' && (!selection(run) || !Number.isSafeInteger(offset) || offset<0))) return error('Choose a valid DAG, run, and task page.',400);
  const connection=await prisma.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId,provider:'airflow'}},select:{status:true,scopesJson:true,lastValidatedAt:true}});
  const metadata=connection?.scopesJson && typeof connection.scopesJson==='object' && !Array.isArray(connection.scopesJson) ? connection.scopesJson as Record<string,unknown> : {};
  const status={status:connection?.status ?? 'not_connected',lastValidatedAt:connection?.lastValidatedAt ?? null,version:typeof metadata.version==='string'?metadata.version:null,dagCount:typeof metadata.dagCount==='number' && Number.isSafeInteger(metadata.dagCount) && metadata.dagCount>=0 ? metadata.dagCount:null};
  if(view==='overview') {
   const [automations,executions]=await Promise.all([
    prisma.airflowAutomation.findMany({where:{organizationId},orderBy:{createdAt:'desc'},take:50,select:{id:true,name:true,dagId:true,enabled:true,triggerMode:true,scheduleCron:true,actionType:true,approvalRequired:true,nextScheduledAt:true}}),
    prisma.airflowAutomationExecution.findMany({where:{organizationId},orderBy:{createdAt:'desc'},take:50,select:{id:true,sourceDagId:true,sourceDagRunId:true,status:true,attempt:true,createdAt:true}}),
   ]);
   return reply({ok:true,data:{connection:status,automations,executions}});
  }
  if(connection?.status!=='active') return error('Airflow is not connected. Configure and validate it in the paired Agent.',409);
  const {client}=await loadAirflowClient(organizationId);
  const observedAt=new Date().toISOString();
  if(view==='dags') return reply({ok:true,data:{dags:await client.listDags(),observedAt}});
  if(view==='runs') return reply({ok:true,data:{runs:await client.listDagRuns(dag!,50),observedAt}});
  return reply({ok:true,data:{...await client.listTaskInstances(dag!,run!,offset),observedAt}});
 } catch { return error('Airflow information could not be verified. Refresh or check the connection in Axiom Agent.',502); }
}
