import 'server-only';
import {NextResponse,type NextRequest} from 'next/server';
import {createHash} from 'node:crypto';
import {z,ZodError} from 'zod';
import {prisma} from '@/lib/db';
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {consumeToken} from '@/lib/api/rateLimiter';
import {readBotPullRequestEvidence} from '@/lib/connectors/github/readBotPullRequestEvidence';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {parsePullRequestEvidenceStart,parsePullRequestEvidence,matchPullRequestEvidence} from './pullRequestEvidenceContract';
import {createPullRequestEvidenceRun,cancelPullRequestEvidenceRun,recoverPullRequestEvidenceRun,getPullRequestEvidenceRun,listPullRequestEvidenceRuns,pullRequestEvidenceRunId,PullRequestEvidenceConflict,type PullRequestEvidenceRepo,type PullRequestEvidenceListRepo,type PullRequestEvidenceRow,type PullRequestEvidenceArtifact} from './pullRequestEvidenceRepo';
import {readPullRequestEvidenceBinding} from './pullRequestEvidenceReaders';
import {runPullRequestEvidence} from './pullRequestEvidenceWorker';
import {workspaceReadinessReaders} from './workspaceReadinessReaders';
import type {SavedBotTaskScope} from './savedTaskRepo';
const db=prisma as unknown as PullRequestEvidenceRepo&PullRequestEvidenceListRepo;
const artifacts=prisma as unknown as {botPullRequestEvidenceArtifact:{findFirst(args:{where:{organizationId:string;createdByUserId:string;runId:string;kind:string}}):Promise<PullRequestEvidenceArtifact|null>}};
const enabled=()=>process.env.AXIOM_BOT_PR_EVIDENCE_ENABLED==='true';
class Invalid extends Error {}
const reply=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const fail=(error:string,status:number)=>reply({ok:false,error},status);
async function principal(request:NextRequest,cancel=false):Promise<SavedBotTaskScope|null>{const session=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:cancel?'workspace:read':'github:read',requireWorkspaceMembership:true,allowApiKey:false,route:`${request.method} ${request.nextUrl.pathname}`});return session?.credentialKind==='desktop_session'?{organizationId:String(session.organizationId),userId:String(session.userId)}:null}
async function authority(request:NextRequest,scope:SavedBotTaskScope,signal:AbortSignal){signal.throwIfAborted();const actor=await withGithubAbort(principal(request),signal);if(!actor||actor.organizationId!==scope.organizationId||actor.userId!==scope.userId)return null;const access=await withGithubAbort(workspaceReadinessReaders().readAccess(scope,signal),signal);signal.throwIfAborted();return access.accepted&&access.canRead&&access.commercialCode==='active'?sha256ContentHash([actor.organizationId,actor.userId,access.role,access.commercialCode]):null}
const summary=(row:PullRequestEvidenceRow)=>({id:row.id,taskId:row.taskId,taskVersion:row.taskVersion,releaseId:row.snapshotJson.binding.releaseId,releaseVersion:row.snapshotJson.binding.releaseVersion,status:row.status,revision:row.revision,attemptCount:row.attemptCount,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),deadlineAt:row.deadlineAt.toISOString()});
function query(request:NextRequest,allowed:string[]){if(request.url.length>2048)throw new Invalid();for(const k of request.nextUrl.searchParams.keys())if(!allowed.includes(k)||request.nextUrl.searchParams.getAll(k).length!==1)throw new Invalid();return request.nextUrl.searchParams}
function failure(error:unknown){if(error instanceof Invalid||error instanceof ZodError)return fail('bot_pr_input_invalid',400);if(error instanceof PullRequestEvidenceConflict)return fail('bot_pr_changed_reload',409);return fail('bot_pr_service_unavailable',503)}
function limited(scope:SavedBotTaskScope,write:boolean){return !consumeToken(`bot-pr-evidence:${scope.organizationId}:${scope.userId}:${write?'start':'read'}`,write?{capacity:3,tokensPerSecond:1/60}:{capacity:30,tokensPerSecond:2}).allowed}
async function body(request:NextRequest):Promise<unknown>{
 if(!request.body||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new Invalid();
 const length=request.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>2048))throw new Invalid();
 const reader=request.body.getReader();let timer:ReturnType<typeof setTimeout>|undefined,stop!:()=>void;const chunks:Uint8Array[]=[];let size=0;
 const stopped=new Promise<never>((_r,reject)=>{stop=()=>reject(new Invalid());timer=setTimeout(stop,5000)});request.signal.addEventListener('abort',stop,{once:true});
 try{if(request.signal.aborted)throw new Invalid();while(true){const part=await Promise.race([reader.read(),stopped]);if(part.done)break;size+=part.value.byteLength;if(size>2048)throw new Invalid();chunks.push(part.value)}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)))}catch{throw new Invalid()}finally{clearTimeout(timer);request.signal.removeEventListener('abort',stop);void reader.cancel().catch(()=>{});reader.releaseLock()}
}

export async function handlePullRequestEvidenceRuns(request:NextRequest){try{
 if(!['GET','POST'].includes(request.method))return fail('method_not_allowed',405);
 const scope=await principal(request);if(!scope)return fail('desktop_session_required',401);
 if(limited(scope,request.method==='POST'))return fail('bot_pr_rate_limited',429);
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(24000)]),q=query(request,request.method==='GET'?['taskId','clientRequestId']:[]);
 if(!await authority(request,scope,signal))return fail('bot_pr_current_access_required',403);
 if(request.method==='GET'){
  if(q.has('taskId')){if(q.has('clientRequestId')||!/^bot_[a-f0-9]{64}$/.test(q.get('taskId')??''))throw new Invalid();const page=await listPullRequestEvidenceRuns(db,scope,q.get('taskId')!);const runs=[];for(const item of page.runs)runs.push(summary(await withGithubAbort(recoverPullRequestEvidenceRun(db,scope,item.id),signal)));if(!await authority(request,scope,signal))return fail('bot_pr_current_access_required',403);return reply({ok:true,data:{enabled:enabled(),runs,truncated:page.truncated}})}
  if(q.has('clientRequestId')){const clientId=z.string().uuid().parse(q.get('clientRequestId'));const row=await withGithubAbort(recoverPullRequestEvidenceRun(db,scope,pullRequestEvidenceRunId(scope,clientId)),signal);if(!await authority(request,scope,signal))return fail('bot_pr_current_access_required',403);return reply({ok:true,data:{enabled:enabled(),run:summary(row)}})}
  const installation=await withGithubAbort(prisma.gitHubInstallation.findFirst({where:{organizationId:scope.organizationId,status:'active'},orderBy:{installedAt:'desc'},select:{id:true,revokedAt:true,suspendedAt:true}}),signal);
  if(!await authority(request,scope,signal))return fail('bot_pr_current_access_required',403);
  return reply({ok:true,data:{enabled:enabled(),canStart:enabled()&&!!installation&&!installation.revokedAt&&!installation.suspendedAt,recoveryScope:'bot_pr_scope_'+createHash('sha256').update(JSON.stringify(['bot-pr-recovery-v1',scope.organizationId,scope.userId])).digest('hex'),kind:'release_pull_request_evidence_v1',description:'Read the exact pull request stored on a submitted release. Evidence only; no AI calls or changes.'}});
 }
 if(!enabled())return fail('bot_pr_disabled',503);
 const input=parsePullRequestEvidenceStart(await body(request));
 const binding=await readPullRequestEvidenceBinding(scope,input,signal);if(!binding)return fail('bot_pr_stored_target_unavailable',409);
 if(!await authority(request,scope,signal))return fail('bot_pr_current_access_required',403);
 let row=await createPullRequestEvidenceRun(db,scope,{taskId:input.taskId,expectedVersion:input.expectedVersion,clientRequestId:input.clientRequestId},binding);
 if(row.status==='queued')row=await runPullRequestEvidence(db,scope,row.id,{readAuthority:s=>authority(request,scope,AbortSignal.any([s,request.signal])),readBinding:(v,s)=>readPullRequestEvidenceBinding(scope,v,AbortSignal.any([s,request.signal])),readEvidence:async(v,s)=>{const evidence=await readBotPullRequestEvidence({organizationId:scope.organizationId,binding:v,signal:AbortSignal.any([s,request.signal])});if(!evidence.ok)throw Error('read_unavailable');return evidence.observation}});
 if(!await authority(request,scope,signal))return fail('bot_pr_current_access_required',403);
 return reply({ok:true,data:{enabled:true,run:summary(row)}},201);
}catch(error){return failure(error)}}
export async function handlePullRequestEvidenceRun(request:NextRequest,id:string){try{
 if(!['GET','DELETE'].includes(request.method))return fail('method_not_allowed',405);
 const cancel=request.method==='DELETE',scope=await principal(request,cancel);if(!scope)return fail('desktop_session_required',401);query(request,[]);
 if(!/^botpr_[a-f0-9]{64}$/.test(id))throw new Invalid();if(limited(scope,false))return fail('bot_pr_rate_limited',429);
 if(cancel){const value=z.object({expectedRevision:z.number().int().min(0).max(2147483647)}).strict().parse(await body(request));const row=await cancelPullRequestEvidenceRun(db,scope,id,value.expectedRevision);const actor=await principal(request,true);if(!actor||actor.organizationId!==scope.organizationId||actor.userId!==scope.userId)return fail('desktop_session_required',401);return reply({ok:true,data:{enabled:enabled(),run:summary(row)}})}
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(15000)]);if(!await authority(request,scope,signal))return fail('bot_pr_current_access_required',403);
 const row=await recoverPullRequestEvidenceRun(db,scope,id);let evidence:null|{content:string;observedAt:string}=null;let selection:null|{kind:'saved_pr_evidence_v1';runId:string;artifactHash:string}=null;
 if(row.status==='completed'){
  const artifact=await withGithubAbort(artifacts.botPullRequestEvidenceArtifact.findFirst({where:{organizationId:scope.organizationId,createdByUserId:scope.userId,runId:id,kind:'release_pull_request_evidence'}}),signal);
  if(!artifact||artifact.runId!==row.id||artifact.snapshotDigest!==row.snapshotDigest||Buffer.byteLength(artifact.content)>16384||createHash('sha256').update(artifact.content).digest('hex')!==artifact.contentHash)throw Error('artifact_unavailable');
  const facts=parsePullRequestEvidence(JSON.parse(artifact.content));if(!matchPullRequestEvidence(facts,row.snapshotJson.binding)||facts.observedAt!==artifact.observedAt.toISOString()||artifact.observedAt<row.createdAt||artifact.observedAt>row.updatedAt)throw Error('artifact_unavailable');evidence={content:artifact.content,observedAt:artifact.observedAt.toISOString()};if(process.env.AXIOM_BOT_AI_EVIDENCE_CONTEXT_ENABLED==='true')selection={kind:'saved_pr_evidence_v1',runId:row.id,artifactHash:artifact.contentHash};
 }
 if(!await authority(request,scope,signal))return fail('bot_pr_current_access_required',403);
 return reply({ok:true,data:{enabled:enabled(),run:summary(row),evidence,selection}});
}catch(error){return failure(error)}}
