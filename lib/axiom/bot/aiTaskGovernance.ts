import 'server-only';
import {resolveGovernedAiCall} from '@/lib/axiom/agentRuntime/governedAiCall';
import {governedExtractReservationKey} from '@/lib/billing/governedExtractAdmission';
import {requestReservationCents} from '@/lib/billing/requestReservationCents';
import {AI_TASK_LIMITS,buildAiTaskPrompt,parseAiTaskAnswer,aiTaskSnapshotDigest,aiTaskCorrelationId} from './aiTaskContract';
import {savedBotTaskContentHash} from './savedTaskSchema';
import {readAiTaskAuthority} from './aiTaskAuthority';
import {getAiTaskRun} from './aiTaskLifecycle';
import {verifyAiTaskReceipt,type AiTaskReceiptRepo} from './aiTaskReceipt';
import type {AiTaskRepo,AiTaskRow} from './aiTaskRepo';
import type {AiTaskExecutionRequest} from './aiTaskWorker';
import type {SavedBotTaskScope} from './savedTaskRepo';
function enabled(){if(process.env.AXIOM_BOT_AI_TASKS_ENABLED!=='true'||process.env.AXIOM_BOT_AI_LIVE_CALLS_ENABLED!=='true')throw new Error('bot_ai_execution_disabled')}
/** No routes call this yet. Its caller must freshly authorize the user and bind
 * the fixed worker. This adapter adds no tools or profile authority, never
 * repairs/retries, and never releases uncertain billing holds. */
export async function executeGovernedAiTask(repo:AiTaskRepo,receiptRepo:AiTaskReceiptRepo,scope:SavedBotTaskScope,id:string,request:AiTaskExecutionRequest,assertCurrent?:()=>Promise<boolean>){
 const refuse=():never=>{throw new Error('bot_ai_dispatch_binding_refused')};
 enabled();request.signal.throwIfAborted();
 const check=async():Promise<AiTaskRow>=>{
  enabled();request.signal.throwIfAborted();
  if(assertCurrent&&!await assertCurrent())return refuse();
  const row=await getAiTaskRun(repo,scope,id);request.signal.throwIfAborted();
  if(row.snapshotJson.format===2&&(process.env.AXIOM_BOT_AI_EVIDENCE_CONTEXT_ENABLED!=='true'||!assertCurrent))return refuse();
  const now=Date.now(),reservation=requestReservationCents();
  if(row.status!=='dispatching'||row.attemptCount!==1||row.cancelRequested||!row.dispatchClaimedAt||row.deadlineAt.getTime()<=now||!row.leaseExpiresAt||row.leaseExpiresAt.getTime()<=now||row.organizationId!==scope.organizationId||row.createdByUserId!==scope.userId||row.correlationId!==aiTaskCorrelationId(id)||row.modelId!==request.modelId||row.correlationId!==request.correlationId||aiTaskSnapshotDigest(row.snapshotJson)!==row.snapshotDigest||!Number.isSafeInteger(reservation)||reservation<1||reservation>AI_TASK_LIMITS.maxReservationCents)return refuse();
  const prompt=buildAiTaskPrompt(row.snapshotJson);
  if(request.tools.length!==0||request.prompt.tools.length!==0||request.maxOutputTokens!==AI_TASK_LIMITS.maxOutputTokens||request.prompt.system!==prompt.system||request.prompt.text!==prompt.text||request.prompt.schemaHint!==prompt.schemaHint)return refuse();
  const authority=await readAiTaskAuthority(scope,row.modelId,request.signal);request.signal.throwIfAborted();
  if(authority!==row.snapshotJson.authorityDigest)return refuse();
  const task=await repo.botTaskDraft.findFirst({where:{id:row.taskId,organizationId:scope.organizationId,createdByUserId:scope.userId}});request.signal.throwIfAborted();
  if(!task||task.id!==row.taskId||task.organizationId!==scope.organizationId||task.createdByUserId!==scope.userId||task.version!==row.taskVersion||task.status!=='draft'||task.contentHash!==row.snapshotJson.contentHash||savedBotTaskContentHash({title:task.title,instruction:task.instruction,context:task.context})!==task.contentHash)return refuse();
  const latest=await getAiTaskRun(repo,scope,id);request.signal.throwIfAborted();
  if(latest.revision!==row.revision||latest.status!=='dispatching'||latest.cancelRequested||latest.snapshotDigest!==row.snapshotDigest)return refuse();
  enabled();request.signal.throwIfAborted();
  if(row.deadlineAt.getTime()<=Date.now()||row.leaseExpiresAt!.getTime()<=Date.now())return refuse();
  if(row.snapshotJson.format===2){if(!assertCurrent||!await assertCurrent())return refuse();enabled();if(process.env.AXIOM_BOT_AI_EVIDENCE_CONTEXT_ENABLED!=='true')return refuse();}
  request.signal.throwIfAborted();return row;
 };
 const initial=await check();
 const governed=await resolveGovernedAiCall(scope.organizationId,'vercel_gateway',scope.userId,initial.modelId,{abortSignal:request.signal,onDraft:()=>{},beforeAdmission:async()=>{await check()}});
 if(!governed.ok)throw new Error(governed.error);
 const current=await check();
 if(current.snapshotDigest!==initial.snapshotDigest||current.dispatchClaimedAt?.getTime()!==initial.dispatchClaimedAt?.getTime())return refuse();
 // The existing manager owns the only admission and its normal metering path.
 const result=await governed.extract<unknown>(request.prompt.text,request.prompt.schemaHint,current.correlationId);
 request.signal.throwIfAborted();enabled();
 const answer=parseAiTaskAnswer(result.data);
 const correlationId=current.correlationId;
 const evidence=await verifyAiTaskReceipt(receiptRepo,{...scope,correlationId,modelId:current.modelId,dispatchClaimedAt:current.dispatchClaimedAt!,reservationKey:governedExtractReservationKey({...scope,correlationId})});
 request.signal.throwIfAborted();
 return{answer,evidence};
}
