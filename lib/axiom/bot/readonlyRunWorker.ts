import {READINESS_LIMITS,READINESS_ADAPTER,parseReadinessFacts,readinessSnapshotDigest,type ReadinessFacts} from './readonlyRunContract';
import {claimReadinessRun,completeReadinessRun,getReadinessRun,acknowledgeReadinessCancellation,failReadinessRun,type ReadinessFailureReason} from './readonlyRunLifecycle';
import {ReadinessRunConflict,type ReadinessRunRepo,type ReadinessRunRow} from './readonlyRunRepo';
import {savedBotTaskContentHash} from './savedTaskSchema';
import type {SavedBotTaskScope} from './savedTaskRepo';
export interface ReadinessAccess {accepted:boolean;canRead:boolean;role:ReadinessFacts['access']['role'];commercialCode:ReadinessFacts['access']['code']}
/** Implementations must use narrow, tenant-scoped local database selects only.
 * No integration-health aggregate, credential reader, model or provider adapter. */
export interface ReadinessReaders {
 readAccess(scope:SavedBotTaskScope,signal:AbortSignal):Promise<ReadinessAccess>;
 readIntegrations(scope:SavedBotTaskScope,signal:AbortSignal):Promise<ReadinessFacts['integrations']>;
 readReleases(scope:SavedBotTaskScope,signal:AbortSignal):Promise<ReadinessFacts['releases']>;
}
class ReadinessReadRefused extends Error {constructor(readonly reason:ReadinessFailureReason){super(reason)}}
const allowed=(a:ReadinessAccess)=>a.accepted&&a.canRead&&a.commercialCode==='active';
async function checkStoredTask(repo:ReadinessRunRepo,scope:SavedBotTaskScope,row:ReadinessRunRow){
 const task=await repo.botTaskDraft.findFirst({where:{id:row.taskId,organizationId:scope.organizationId,createdByUserId:scope.userId}});
 if(!task||task.organizationId!==scope.organizationId||task.createdByUserId!==scope.userId||task.id!==row.taskId||task.status!=='draft'||task.version!==row.taskVersion||task.contentHash!==savedBotTaskContentHash(row.snapshotJson)||savedBotTaskContentHash({title:task.title,instruction:task.instruction,context:task.context})!==task.contentHash)throw new ReadinessReadRefused('stored_task_changed');
}
/** Internal fixed-adapter worker. An authenticated route is still required.
 * There is deliberately no scheduler, arbitrary tool payload or retry loop. */
export async function runReadinessReport(repo:ReadinessRunRepo,scope:SavedBotTaskScope,id:string,workerId:string,readers:ReadinessReaders):Promise<ReadinessRunRow>{
 const original=await getReadinessRun(repo,scope,id);
 const input={taskId:original.taskId,expectedVersion:original.taskVersion,adapter:READINESS_ADAPTER,clientRequestId:original.clientRequestId,confirmRecordedMetadata:true as const};
 if(original.adapter!==READINESS_ADAPTER||readinessSnapshotDigest(scope,input,original.snapshotJson)!==original.snapshotDigest)throw new ReadinessRunConflict();
 const claimed=await claimReadinessRun(repo,scope,{runId:id,expectedRevision:original.revision,snapshotDigest:original.snapshotDigest,workerId});
 const binding={runId:id,expectedRevision:claimed.revision,snapshotDigest:claimed.snapshotDigest,workerId};
 const budget=Math.min(READINESS_LIMITS.totalMs,claimed.deadlineAt.getTime()-Date.now(),(claimed.leaseExpiresAt?.getTime()??0)-Date.now()-5000);
 const controller=new AbortController();let settled=false;let expired=false;let timer:ReturnType<typeof setTimeout>|undefined;
 const check=()=>{if(controller.signal.aborted)throw new ReadinessReadRefused('read_budget_expired')};
 const phase=async()=>{
  try{
   check();const before=await readers.readAccess(scope,controller.signal);check();
   if(!allowed(before))throw new ReadinessReadRefused('current_access_changed');
   await checkStoredTask(repo,scope,claimed);check();
   const integrations=await readers.readIntegrations(scope,controller.signal);check();
   const releases=await readers.readReleases(scope,controller.signal);check();
   const after=await readers.readAccess(scope,controller.signal);check();
   if(!allowed(after)||JSON.stringify(before)!==JSON.stringify(after))throw new ReadinessReadRefused('current_access_changed');
   await checkStoredTask(repo,scope,claimed);check();
   return parseReadinessFacts({checkedAt:new Date().toISOString(),access:{role:after.role,code:after.commercialCode},integrations,releases});
  }finally{settled=true}
 };
 try{
  if(budget<=0)throw new ReadinessReadRefused('read_budget_expired');
  const timeout=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{expired=true;controller.abort();reject(new ReadinessReadRefused('read_budget_expired'))},budget)});
  const facts=await Promise.race([phase(),timeout]);check();
  const current=await getReadinessRun(repo,scope,id);check();
  if(current.status==='cancel_requested')return await acknowledgeReadinessCancellation(repo,scope,binding);
  return await completeReadinessRun(repo,scope,binding,facts);
 }catch(error){
  controller.abort();const reason=error instanceof ReadinessReadRefused?error.reason:'read_unavailable';
  const current=await getReadinessRun(repo,scope,id);
  if(current.status==='cancel_requested'&&settled&&!expired)return acknowledgeReadinessCancellation(repo,scope,binding);
  return failReadinessRun(repo,scope,binding,reason,expired||!settled);
 }finally{if(timer!==undefined)clearTimeout(timer);controller.abort()}
}
