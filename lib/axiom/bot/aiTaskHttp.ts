import 'server-only';
import {NextResponse,type NextRequest} from 'next/server';
import {randomUUID,createHash} from 'node:crypto';
import {z,ZodError} from 'zod';
import {prisma} from '@/lib/db';
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {consumeToken} from '@/lib/api/rateLimiter';
import {assertAiTaskEvidenceContextCurrent,AiTaskEvidenceConflict} from './aiTaskEvidenceContext';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import type {AiTaskSnapshot} from './aiTaskContract';
import {parseAiTaskInput,aiTaskRunId,AI_TASK_LIMITS,parseAiTaskAnswer} from './aiTaskContract';
import {createAiTaskRun,listAiTaskRuns,AiTaskConflict,type AiTaskRepo,type AiTaskListRepo,type AiTaskSummary,type AiTaskArtifact} from './aiTaskRepo';
import {recoverAiTaskRun,cancelAiTaskRun} from './aiTaskLifecycle';
import {runAiTask} from './aiTaskWorker';
import {readAiTaskAuthority} from './aiTaskAuthority';
import {executeGovernedAiTask} from './aiTaskGovernance';
import type {AiTaskReceiptRepo} from './aiTaskReceipt';
import type {SavedBotTaskScope} from './savedTaskRepo';
const db=prisma as unknown as AiTaskRepo;
const listDb=prisma as unknown as AiTaskListRepo;
const receiptDb=prisma as unknown as AiTaskReceiptRepo;
const artifactDb=prisma as unknown as {botAiTaskArtifact:{findFirst(args:{where:{organizationId:string;createdByUserId:string;runId:string;kind:string};select:{id:true;content:true;contentHash:true;snapshotDigest:true;usageReceiptId:true;createdAt:true}}):Promise<Pick<AiTaskArtifact,'id'|'content'|'contentHash'|'snapshotDigest'|'usageReceiptId'|'createdAt'>|null>}};
class Invalid extends Error {}
const enabled=()=>process.env.AXIOM_BOT_AI_TASKS_ENABLED==='true'&&process.env.AXIOM_BOT_AI_LIVE_CALLS_ENABLED==='true';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const fail=(error:string,status:number)=>reply({ok:false,error},status);
async function principal(request:NextRequest,evidence=false):Promise<SavedBotTaskScope|null>{
 const session=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:evidence?'github:read':'workspace:read',requireWorkspaceMembership:true,allowApiKey:false,route:`${request.method} ${request.nextUrl.pathname}`});
 return session?.credentialKind==='desktop_session'?{organizationId:String(session.organizationId),userId:String(session.userId)}:null;
}
async function current(request:NextRequest,scope:SavedBotTaskScope,evidence=false){if(request.signal.aborted)return false;const next=await principal(request,evidence);return !request.signal.aborted&&next?.organizationId===scope.organizationId&&next?.userId===scope.userId}
const evidenceEnabled=()=>process.env.AXIOM_BOT_AI_EVIDENCE_CONTEXT_ENABLED==='true';
async function evidenceCurrent(request:NextRequest,scope:SavedBotTaskScope,snapshot:AiTaskSnapshot,signal:AbortSignal){
 if(snapshot.format===1)return true;
 try{signal.throwIfAborted();if(!evidenceEnabled()||!await withGithubAbort(current(request,scope,true),signal))return false;await withGithubAbort(assertAiTaskEvidenceContextCurrent(db,scope,snapshot),signal);signal.throwIfAborted();const paired=await withGithubAbort(current(request,scope,true),signal);signal.throwIfAborted();return evidenceEnabled()&&paired}catch{return false}
}
function params(request:NextRequest,keys:string[]){for(const key of request.nextUrl.searchParams.keys())if(!keys.includes(key)||request.nextUrl.searchParams.getAll(key).length!==1)throw new Invalid();return request.nextUrl.searchParams}
async function body(request:NextRequest):Promise<unknown>{
 if(!request.body||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new Invalid();
 const length=request.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>2048))throw new Invalid();
 const reader=request.body.getReader();let timer:ReturnType<typeof setTimeout>|undefined,stop!:()=>void;const chunks:Uint8Array[]=[];let size=0;
 const stopped=new Promise<never>((_r,reject)=>{stop=()=>reject(new Invalid());timer=setTimeout(stop,5000)});request.signal.addEventListener('abort',stop,{once:true});
 try{if(request.signal.aborted)throw new Invalid();while(true){const part=await Promise.race([reader.read(),stopped]);if(part.done)break;size+=part.value.byteLength;if(size>2048)throw new Invalid();chunks.push(part.value)}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)))}catch{throw new Invalid()}finally{clearTimeout(timer);request.signal.removeEventListener('abort',stop);void reader.cancel().catch(()=>{});reader.releaseLock()}
}
function summary(row:AiTaskSummary){return{id:row.id,taskId:row.taskId,taskVersion:row.taskVersion,modelId:row.modelId,status:row.status,revision:row.revision,attemptCount:row.attemptCount,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),deadlineAt:row.deadlineAt.toISOString()}}
function failure(error:unknown){if(error instanceof AiTaskEvidenceConflict)return fail('bot_ai_evidence_changed_reload',409);if(error instanceof Invalid||error instanceof ZodError)return fail('bot_ai_input_invalid',400);if(error instanceof AiTaskConflict)return fail('bot_ai_changed_reload',409);return fail('bot_ai_service_unavailable',503)}
function rate(scope:SavedBotTaskScope,operation:'start'|'cancel'|'read'){return consumeToken(`bot-ai:${scope.organizationId}:${scope.userId}:${operation}`,operation==='start'?{capacity:3,tokensPerSecond:1/60}:operation==='cancel'?{capacity:10,tokensPerSecond:1}:{capacity:30,tokensPerSecond:2}).allowed}
export async function handleAiTasks(request:NextRequest):Promise<NextResponse>{
 try{
  const scope=await principal(request);if(!scope)return fail('desktop_session_required',401);
  if(!['GET','POST'].includes(request.method))return fail('method_not_allowed',405);
  if(!rate(scope,request.method==='POST'?'start':'read'))return fail('bot_ai_rate_limited',429);
  const query=params(request,request.method==='GET'?['clientRequestId','taskId']:[]);
  if(request.method==='GET'){
   const taskId=query.get('taskId');
   if(taskId){if(query.has('clientRequestId')||!/^bot_[a-f0-9]{64}$/.test(taskId))throw new Invalid();const page=await listAiTaskRuns(listDb,scope,taskId);if(!await current(request,scope))return fail('desktop_session_required',401);return reply({ok:true,data:{enabled:enabled(),runs:page.runs.map(summary),truncated:page.truncated}})}
   const requestId=query.get('clientRequestId');
   if(requestId){z.string().uuid().parse(requestId);const row=await recoverAiTaskRun(db,scope,aiTaskRunId(scope,requestId));if(!await current(request,scope))return fail('desktop_session_required',401);return reply({ok:true,data:{enabled:enabled(),run:summary(row)}})}
   if(!await current(request,scope))return fail('desktop_session_required',401);
   return reply({ok:true,data:{enabled:enabled(),canSend:enabled(),recoveryScope:'bot_scope_'+createHash('sha256').update(JSON.stringify(['bot-ai-recovery-v1',scope.organizationId,scope.userId])).digest('hex'),kind:'ai_task_response_v1',toolAccess:false,description:'Send an explicit saved task to an approved AI model. No tools, connected apps or computer actions.'}});
  }
  if(!enabled())return fail('bot_ai_execution_disabled',503);
  const input=parseAiTaskInput(await body(request));if(input.evidenceContext&&!evidenceEnabled())return fail('bot_ai_evidence_context_unavailable',503);if(input.evidenceContext&&!await current(request,scope,true))return fail('bot_ai_evidence_access_required',403);if(!await current(request,scope))return fail('desktop_session_required',401);
  const authority=await readAiTaskAuthority(scope,input.modelId,request.signal);if(!authority)return fail('bot_ai_permission_changed',403);
  if(!await current(request,scope))return fail('desktop_session_required',401);
  let row=await createAiTaskRun(db,scope,input,authority);
  if(row.status==='queued'){const snapshotForRun=row.snapshotJson;row=await runAiTask(db,scope,row.id,'worker_'+randomUUID().replaceAll('-',''),{
   currentEvidenceAuthority:async(owner,snapshot,signal)=>owner.organizationId===scope.organizationId&&owner.userId===scope.userId&&await evidenceCurrent(request,scope,snapshot,signal),
   currentAuthority:async(owner,model,signal)=>await current(request,scope)?readAiTaskAuthority(owner,model,signal):null,
   execute:async execution=>{const assertCurrent=async()=>await current(request,scope)&&await evidenceCurrent(request,scope,snapshotForRun,execution.signal);if(!await assertCurrent())throw new Error('desktop_session_changed');return executeGovernedAiTask(db,receiptDb,scope,row.id,execution,assertCurrent)},
  },request.signal);}
  if(!await current(request,scope))return fail('desktop_session_required',401);
  return reply({ok:true,data:{enabled:enabled(),run:summary(row)}},201);
 }catch(error){return failure(error)}
}
export async function handleAiTask(request:NextRequest,id:string):Promise<NextResponse>{
 try{
  const scope=await principal(request);if(!scope)return fail('desktop_session_required',401);
  if(!/^botai_[a-f0-9]{64}$/.test(id))throw new Invalid();params(request,[]);
  if(!['GET','DELETE'].includes(request.method))return fail('method_not_allowed',405);
  if(!rate(scope,request.method==='DELETE'?'cancel':'read'))return fail('bot_ai_rate_limited',429);
  if(request.method==='DELETE'){
   const input=z.object({expectedRevision:z.number().int().min(0).max(2147483647)}).strict().parse(await body(request));if(!await current(request,scope))return fail('desktop_session_required',401);
   const row=await cancelAiTaskRun(db,scope,id,input.expectedRevision);
   if(!await current(request,scope))return fail('desktop_session_required',401);
   return reply({ok:true,data:{enabled:enabled(),run:summary(row)}});
  }
  const row=await recoverAiTaskRun(db,scope,id);let result:null|{kind:'answer'|'needs_input';message:string;createdAt:string}=null;
  if(row.status==='completed'||row.status==='needs_input'){
   const artifact=await artifactDb.botAiTaskArtifact.findFirst({where:{organizationId:scope.organizationId,createdByUserId:scope.userId,runId:id,kind:row.status==='completed'?'ai_task_answer':'ai_task_clarification'},select:{id:true,content:true,contentHash:true,snapshotDigest:true,usageReceiptId:true,createdAt:true}});
   if(!artifact||artifact.snapshotDigest!==row.snapshotDigest||!row.usageReceiptId||artifact.usageReceiptId!==row.usageReceiptId||artifact.createdAt<row.createdAt||artifact.createdAt>row.updatedAt||Buffer.byteLength(artifact.content,'utf8')>AI_TASK_LIMITS.maxArtifactBytes||createHash('sha256').update(artifact.content,'utf8').digest('hex')!==artifact.contentHash)throw new Error('artifact_unavailable');
   const answer=parseAiTaskAnswer(JSON.parse(artifact.content));
   if((answer.kind==='answer')!==(row.status==='completed'))throw new Error('artifact_wrong_kind');
   result={...answer,createdAt:artifact.createdAt.toISOString()};
  }
  if(!await current(request,scope))return fail('desktop_session_required',401);
  return reply({ok:true,data:{enabled:enabled(),run:summary(row),result}});
 }catch(error){return failure(error)}
}
