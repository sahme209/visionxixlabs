import 'server-only';
import {NextResponse,type NextRequest} from 'next/server';
import {randomUUID,createHash} from 'node:crypto';
import {z,ZodError} from 'zod';
import {prisma} from '@/lib/db';
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {consumeToken} from '@/lib/api/rateLimiter';
import {parseReadinessRunStart,readinessRunId,READINESS_LIMITS} from './readonlyRunContract';
import {createReadinessRun,listReadinessReports,ReadinessRunConflict,type ReadinessRunRepo,type ReadinessRunRow,type ReadinessRunSummary,type ReadinessArtifact} from './readonlyRunRepo';
import {recoverReadinessRun,cancelReadinessRun} from './readonlyRunLifecycle';
import {runReadinessReport} from './readonlyRunWorker';
import {workspaceReadinessReaders} from './workspaceReadinessReaders';
import type {SavedBotTaskScope} from './savedTaskRepo';
const db=prisma as unknown as ReadinessRunRepo;
const artifactDb=prisma as unknown as {botTaskArtifact:{findFirst(args:{where:{organizationId:string;createdByUserId:string;runId:string;kind:string};select:{id:true;content:true;contentHash:true;snapshotDigest:true;observedAt:true;createdAt:true}}):Promise<Pick<ReadinessArtifact,'id'|'content'|'contentHash'|'snapshotDigest'|'observedAt'|'createdAt'>|null>}};
class Invalid extends Error {}
const enabled=()=>process.env.AXIOM_BOT_READINESS_REPORTS_ENABLED==='true';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const fail=(error:string,status:number)=>reply({ok:false,error},status);
async function principal(request:NextRequest):Promise<SavedBotTaskScope|null>{
 const session=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'workspace:read',requireWorkspaceMembership:true,allowApiKey:false,route:`${request.method} ${request.nextUrl.pathname}`});
 return session?.credentialKind==='desktop_session'?{organizationId:String(session.organizationId),userId:String(session.userId)}:null;
}
async function current(request:NextRequest,scope:SavedBotTaskScope){if(request.signal.aborted)return false;const next=await principal(request);return next?.organizationId===scope.organizationId&&next?.userId===scope.userId}
function params(request:NextRequest,keys:string[]){for(const key of request.nextUrl.searchParams.keys())if(!keys.includes(key)||request.nextUrl.searchParams.getAll(key).length!==1)throw new Invalid();return request.nextUrl.searchParams}
async function body(request:NextRequest):Promise<unknown>{
 if(!request.body||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new Invalid();
 const length=request.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>2048))throw new Invalid();
 const reader=request.body.getReader();let timer:ReturnType<typeof setTimeout>|undefined,stop!:()=>void;const chunks:Uint8Array[]=[];let size=0;
 const stopped=new Promise<never>((_r,reject)=>{stop=()=>reject(new Invalid());timer=setTimeout(stop,5000)});request.signal.addEventListener('abort',stop,{once:true});
 try{if(request.signal.aborted)throw new Invalid();while(true){const part=await Promise.race([reader.read(),stopped]);if(part.done)break;size+=part.value.byteLength;if(size>2048)throw new Invalid();chunks.push(part.value)}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)))}catch{throw new Invalid()}finally{clearTimeout(timer);request.signal.removeEventListener('abort',stop);void reader.cancel().catch(()=>{});reader.releaseLock()}
}
function summary(row:ReadinessRunSummary){return {id:row.id,taskId:row.taskId,taskVersion:row.taskVersion,status:row.status,revision:row.revision,attemptCount:row.attemptCount,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),deadlineAt:row.deadlineAt.toISOString()}}
function failure(error:unknown){if(error instanceof Invalid||error instanceof ZodError)return fail('readiness_input_invalid',400);if(error instanceof ReadinessRunConflict)return fail('readiness_changed_reload',409);return fail('readiness_service_unavailable',503)}
function rate(scope:SavedBotTaskScope,operation:'start'|'cancel'|'read'){return consumeToken(`bot-readiness:${scope.organizationId}:${scope.userId}:${operation}`,operation==='start'?{capacity:3,tokensPerSecond:1/60}:operation==='cancel'?{capacity:10,tokensPerSecond:1}:{capacity:30,tokensPerSecond:2}).allowed}
export async function handleReadinessRuns(request:NextRequest):Promise<NextResponse>{
 try{
  const scope=await principal(request);if(!scope)return fail('desktop_session_required',401);
  if(!['GET','POST'].includes(request.method))return fail('method_not_allowed',405);
  if(!rate(scope,request.method==='POST'?'start':'read'))return fail('readiness_rate_limited',429);
  const query=params(request,request.method==='GET'?['clientRequestId','taskId']:[]);
  if(request.method==='GET'){
   const taskId=query.get('taskId');
   if(taskId){if(query.has('clientRequestId')||!/^bot_[a-f0-9]{64}$/.test(taskId))throw new Invalid();const page=await listReadinessReports(db,scope,taskId);if(!await current(request,scope))return fail('desktop_session_required',401);return reply({ok:true,data:{enabled:enabled(),runs:page.runs.map(summary),truncated:page.truncated}})}
   const requestId=query.get('clientRequestId');
   if(requestId){z.string().uuid().parse(requestId);const row=await recoverReadinessRun(db,scope,readinessRunId(scope,requestId));if(!await current(request,scope))return fail('desktop_session_required',401);return reply({ok:true,data:{enabled:enabled(),run:summary(row)}})}
   return reply({ok:true,data:{enabled:enabled(),canStart:enabled(),adapter:'workspace_readiness_v1',modelCalls:0,providerRequests:0,description:'Create a report from recorded workspace metadata. This is not a live provider check.'}});
  }
  if(!enabled())return fail('readiness_monitoring_disabled',503);
  const input=parseReadinessRunStart(await body(request));if(!await current(request,scope))return fail('desktop_session_required',401);
  let row=await createReadinessRun(db,scope,input);
  if(row.status==='queued')row=await runReadinessReport(db,scope,row.id,'worker_'+randomUUID().replaceAll('-',''),workspaceReadinessReaders());
  if(!await current(request,scope))return fail('desktop_session_required',401);
  return reply({ok:true,data:{enabled:true,run:summary(row)}},201);
 }catch(error){return failure(error)}
}
export async function handleReadinessRun(request:NextRequest,id:string):Promise<NextResponse>{
 try{
  const scope=await principal(request);if(!scope)return fail('desktop_session_required',401);
  if(!/^botrun_[a-f0-9]{64}$/.test(id))throw new Invalid();params(request,[]);
  if(!['GET','DELETE'].includes(request.method))return fail('method_not_allowed',405);
  if(!rate(scope,request.method==='DELETE'?'cancel':'read'))return fail('readiness_rate_limited',429);
  if(request.method==='DELETE'){
   const input=z.object({expectedRevision:z.number().int().min(0).max(2147483647)}).strict().parse(await body(request));if(!await current(request,scope))return fail('desktop_session_required',401);
   return reply({ok:true,data:{enabled:enabled(),run:summary(await cancelReadinessRun(db,scope,id,input.expectedRevision))}});
  }
  const row=await recoverReadinessRun(db,scope,id);let report:null|{id:string;content:string;observedAt:string}=null;
  if(row.status==='completed'){
   const artifact=await artifactDb.botTaskArtifact.findFirst({where:{organizationId:scope.organizationId,createdByUserId:scope.userId,runId:id,kind:'workspace_readiness_report'},select:{id:true,content:true,contentHash:true,snapshotDigest:true,observedAt:true,createdAt:true}});
   if(!artifact||artifact.snapshotDigest!==row.snapshotDigest||Buffer.byteLength(artifact.content,'utf8')>READINESS_LIMITS.maxArtifactBytes||createHash('sha256').update(artifact.content,'utf8').digest('hex')!==artifact.contentHash)throw new Error('artifact_unavailable');
   report={id:artifact.id,content:artifact.content,observedAt:artifact.observedAt.toISOString()};
  }
  if(!await current(request,scope))return fail('desktop_session_required',401);
  return reply({ok:true,data:{enabled:enabled(),run:summary(row),report}});
 }catch(error){return failure(error)}
}
