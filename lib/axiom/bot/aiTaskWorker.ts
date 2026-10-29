import {z} from 'zod';
import {AI_TASK_LIMITS,buildAiTaskPrompt,parseAiTaskAnswer,parseAiTaskSnapshot,type AiTaskSnapshot} from './aiTaskContract';
import {getAiTaskRun,claimAiTaskRun,claimAiTaskDispatch,completeAiTaskRun,failAiTaskRun,type AiTaskWorkerBinding,type AiTaskFailureReason} from './aiTaskLifecycle';
import type {AiTaskRepo,AiTaskRow} from './aiTaskRepo';
import type {SavedBotTaskScope} from './savedTaskRepo';
const evidenceSchema=z.object({usageReceiptId:z.string().min(1).max(1024).refine(v=>v.trim().length>0),organizationId:z.string().min(1),userId:z.string().min(1),correlationId:z.string().min(1),modelId:z.string().min(1)}).strict();
export interface AiTaskExecutionRequest {readonly prompt:ReturnType<typeof buildAiTaskPrompt>;readonly modelId:string;readonly correlationId:string;readonly tools:readonly never[];readonly maxOutputTokens:4096;readonly signal:AbortSignal}
/** Internal dependency port, not an HTTP-selected adapter. Production wiring must
 * verify linked billing records before returning evidence. No real adapter yet. */
export interface AiTaskWorkerDependencies {
 currentAuthority(scope:SavedBotTaskScope,modelId:string,signal:AbortSignal):Promise<string|null>;
 currentEvidenceAuthority?(scope:SavedBotTaskScope,snapshot:AiTaskSnapshot,signal:AbortSignal):Promise<boolean>;
 execute(request:AiTaskExecutionRequest):Promise<{answer:unknown;evidence:unknown}>;
}
/** One worker call may claim queued work exactly once. Restart only reads an
 * existing dispatch; recovery never grants a second model call or releases holds. */
export async function runAiTask(repo:AiTaskRepo,scope:SavedBotTaskScope,id:string,workerId:string,deps:AiTaskWorkerDependencies,callerSignal?:AbortSignal):Promise<AiTaskRow>{
 let row=await getAiTaskRun(repo,scope,id);
 if(row.status!=='queued'||callerSignal?.aborted)return row;
 if(!/^worker_[a-f0-9]{32}$/.test(workerId))throw new Error('invalid_ai_task_worker');
 const binding=():AiTaskWorkerBinding=>({runId:row.id,expectedRevision:row.revision,snapshotDigest:row.snapshotDigest,workerId});
 let claimed=false,reason:AiTaskFailureReason='model_unavailable';
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 const abort=()=>controller.abort();callerSignal?.addEventListener('abort',abort,{once:true});
 let rejectAborted:(reason:Error)=>void=()=>{};
 const aborted=new Promise<never>((_,reject)=>{rejectAborted=reject});
 const rejectOnAbort=()=>rejectAborted(new Error('ai_task_budget_or_cancel'));
 controller.signal.addEventListener('abort',rejectOnAbort,{once:true});
 // Mark handled even if cancellation occurs between awaited stages.
 void aborted.catch(()=>{});
 const bounded=<T>(operation:()=>Promise<T>):Promise<T>=>{
  if(controller.signal.aborted)return Promise.reject(new Error('ai_task_budget_or_cancel'));
  return Promise.race([Promise.resolve().then(()=>{if(controller.signal.aborted)throw new Error('ai_task_budget_or_cancel');return operation()}),aborted]);
 };
 try{
  row=await claimAiTaskRun(repo,scope,binding());claimed=true;
  const remaining=Math.min(AI_TASK_LIMITS.totalMs,row.deadlineAt.getTime()-Date.now(),(row.leaseExpiresAt?.getTime()??0)-Date.now()-5000);
  if(remaining<=0){reason='execution_budget_expired';throw new Error('ai_task_budget_expired')}
  timer=setTimeout(abort,remaining);
  if(callerSignal?.aborted)controller.abort();
  const snapshot=parseAiTaskSnapshot(row.snapshotJson),owner=Object.freeze({...scope});
  reason='current_access_changed';
  const authority=await bounded(()=>deps.currentAuthority(owner,row.modelId,controller.signal));
  if(authority!==snapshot.authorityDigest)throw new Error('ai_task_current_authority_changed');
  if(snapshot.format===2&&(!deps.currentEvidenceAuthority||!await bounded(()=>deps.currentEvidenceAuthority!(owner,snapshot,controller.signal))))throw new Error('ai_task_evidence_authority_changed');
  reason='stored_task_changed';
  row=await bounded(()=>claimAiTaskDispatch(repo,scope,binding(),authority));
  reason='model_unavailable';
  const prompt=buildAiTaskPrompt(snapshot);
  const result=await bounded(()=>deps.execute(Object.freeze({prompt,modelId:row.modelId,correlationId:row.correlationId,tools:Object.freeze([] as never[]),maxOutputTokens:4096 as const,signal:controller.signal})));
  reason='receipt_unverified';
  const answer=parseAiTaskAnswer(result.answer),evidence=evidenceSchema.parse(result.evidence);
  if(evidence.organizationId!==scope.organizationId||evidence.userId!==scope.userId||evidence.modelId!==row.modelId||evidence.correlationId!==row.correlationId)throw new Error('ai_task_wrong_receipt_binding');
  reason='current_access_changed';
  const current=await bounded(()=>deps.currentAuthority(owner,row.modelId,controller.signal));
  if(current!==snapshot.authorityDigest)throw new Error('ai_task_current_authority_changed');
  if(snapshot.format===2&&(!deps.currentEvidenceAuthority||!await bounded(()=>deps.currentEvidenceAuthority!(owner,snapshot,controller.signal))))throw new Error('ai_task_evidence_authority_changed');
  reason='stored_task_changed';
  return await bounded(()=>completeAiTaskRun(repo,scope,binding(),current,answer,evidence));
 }catch(error){
  if(!claimed)throw error;
  if(controller.signal.aborted)reason='execution_budget_expired';
  // No retry, admission recreation, provider cancellation claim or credit refund.
  return failAiTaskRun(repo,scope,binding(),reason);
 }finally{
  if(timer)clearTimeout(timer);
  callerSignal?.removeEventListener('abort',abort);
  controller.signal.removeEventListener('abort',rejectOnAbort);
 }
}
