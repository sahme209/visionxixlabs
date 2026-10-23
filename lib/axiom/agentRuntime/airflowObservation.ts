import "server-only";
import {loadAirflowClient} from "@/lib/integrations/airflow/connection";
import {hasDesktopCapability,type DesktopWorkspaceRole} from "@/lib/desktop/desktopAuthorization";
import type {CloudObservationContext} from "./cloudObservation";

export type AirflowObservationTool = "list_airflow_dags" | "read_airflow_runs" | "read_airflow_tasks";
type Result = {ok:true;result:Record<string,unknown>} | {ok:false;error:string};
const roles:readonly DesktopWorkspaceRole[]=["owner","admin","operator","security_reviewer","finance_viewer","read_only"];
const validId=(value:unknown):value is string=>typeof value==="string" && value.length>0 && value.length<=250 && value.trim()===value && value!=="~" && !/[\x00-\x1f\x7f]/.test(value);
async function assertAuthority(context:CloudObservationContext) {
  const {principal,repo}=context;
  const [device,member]=await Promise.all([
    repo.desktopSessionRecord.findUnique({where:{id:principal.sessionId}}),
    repo.orgMembership.findUnique({where:{userId_organizationId:{userId:principal.userId,organizationId:principal.organizationId}}}),
  ]);
  if(!device || device.id!==principal.sessionId || device.userId!==principal.userId || device.organizationId!==principal.organizationId || device.revokedAt || device.expiresAt<=new Date() || !member?.acceptedAt || !roles.includes(member.role) || !hasDesktopCapability(member.role,"workspace:read")) throw new Error("authority_unavailable");
}
/** Fixed tenant connection and read-only methods. No URLs, credentials, logs,
 * XCom, configs, trigger, retry or task-state mutation are model-accessible.
 * The decision loop still requires the live identity allowlist for each tool. */
export async function executeAirflowObservationTool(organizationId:string,tool:AirflowObservationTool,args:Record<string,unknown>,context?:CloudObservationContext):Promise<Result> {
  if(!context || context.principal.organizationId!==organizationId) return {ok:false,error:"paired_airflow_observation_required"};
  const keys=tool==="list_airflow_dags"?[]:tool==="read_airflow_runs"?["dagId"]:["dagId","runId"];
  if(!args || typeof args!=="object" || Array.isArray(args) || Object.keys(args).some(key=>!keys.includes(key)) || keys.some(key=>!validId(args[key]))) return {ok:false,error:"invalid_airflow_observation_args"};
  try {
    await assertAuthority(context);
    const connection=await loadAirflowClient(organizationId);
    let data:Record<string,unknown>;
    if(tool==="list_airflow_dags") {
      const dags=await connection.client.listDags();
      data={dags:dags.slice(0,20).map(dag=>({dagId:dag.dagId,displayName:dag.displayName.slice(0,160),paused:dag.paused})),truncated:dags.length>20};
    } else if(tool==="read_airflow_runs") {
      const runs=await connection.client.listDagRuns(args.dagId as string,20);
      data={dagId:args.dagId,runs:runs.slice(0,20).map(run=>({dagId:run.dagId,dagRunId:run.dagRunId,state:run.state,logicalDate:run.logicalDate,startedAt:run.startedAt,endedAt:run.endedAt}))};
    } else {
      const page=await connection.client.listTaskInstances(args.dagId as string,args.runId as string,0);
      data={dagId:args.dagId,runId:args.runId,totalEntries:page.totalEntries,tasks:page.tasks.slice(0,20).map(task=>({taskId:task.taskId,mapIndex:task.mapIndex,tryNumber:task.tryNumber,state:task.state,startedAt:task.startedAt,endedAt:task.endedAt}))};
    }
    await assertAuthority(context);
    // Re-read the same active connection after observation. A replacement or
    // credential rotation invalidates results; never expose old provider data.
    const current=await loadAirflowClient(organizationId);
    if(current.connectionId!==connection.connectionId || current.connectionUpdatedAt.getTime()!==connection.connectionUpdatedAt.getTime()) return {ok:false,error:"airflow_observation_changed"};
    return {ok:true,result:{kind:"airflow_observation",authority:"observation_only",observedAt:new Date().toISOString(),coverage:{complete:false,maximumEntries:20,pagination:"first_page"},...data}};
  } catch {return {ok:false,error:"airflow_observation_unavailable"};}
}
