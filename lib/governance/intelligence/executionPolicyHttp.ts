import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {consumeToken} from '@/lib/api/rateLimiter';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {compileExecutionPolicy} from './executionPolicyStore';
import type {createGovernanceExecutionPolicyRequestService} from './executionPolicyRequestService';
import type {RevisionScope} from './revisionStore';
const id=z.string().regex(/^governance_execution_policy_[a-f0-9]{64}$/),digest=z.string().regex(/^[a-f0-9]{64}$/),requestId=z.string().uuid(),version=z.number().int().min(0).max(999);
const input=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('read'),id}).strict(),
 z.object({operation:z.literal('propose'),policy:z.record(z.string(),z.unknown()),requestId}).strict(),
 z.object({operation:z.literal('approve'),id,version,digest,requestId}).strict(),
 z.object({operation:z.literal('activate'),id,pointerVersion:version.nullable(),parentDigest:digest.nullable(),requestId}).strict(),
 z.object({operation:z.literal('revoke'),id,version,requestId}).strict(),
]);
type Service=Pick<ReturnType<typeof createGovernanceExecutionPolicyRequestService>,'propose'|'readRevision'|'approve'|'activate'|'revoke'>;
/** Manages numeric execution ceilings only. An active ceiling is not baseline
 * enrollment, execution coverage, provider access or a provider-action approval.
 * Paired durable services recheck principals/independence and CAS under locks. */
export function createGovernanceExecutionPolicyHttp(compose:(request:NextRequest,scope:RevisionScope)=>Service,isEnabled:()=>boolean){return async(request:NextRequest)=>{
 const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
 let mutationStarted=false;
 try{
  if(request.method!=='POST'||request.nextUrl.search||request.url.length>2048)return reply({ok:false,error:'invalid_governance_execution_policy_request'},400);
  if(!isEnabled())return reply({ok:false,error:'governance_intelligence_disabled'},503);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(30000)]);
  signal.throwIfAborted();
  const actor=await withGithubAbort(resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'workspace:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'governance execution policy'}),signal);
  if(!actor||actor.credentialKind!=='desktop_session'||!actor.id||!actor.userId||!actor.organizationId)return reply({ok:false,error:'desktop_session_required'},401);
  if(!consumeToken(`governance-execution-policy:${actor.organizationId}:${actor.userId}`,{capacity:6,tokensPerSecond:1/10}).allowed)return reply({ok:false,error:'rate_limited'},429);
  if(!request.body||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return reply({ok:false,error:'invalid_governance_execution_policy_request'},400);
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0,raw:unknown;
  try{
   for(;;){const r=await withGithubAbort(reader.read(),signal);if(r.done)break;size+=r.value.byteLength;if(size>65536)return reply({ok:false,error:'invalid_governance_execution_policy_request'},400);chunks.push(r.value)}
   try{raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)))}catch{signal.throwIfAborted();return reply({ok:false,error:'invalid_governance_execution_policy_request'},400)}
  }finally{void reader.cancel().catch(()=>{});reader.releaseLock()}
  const selected=input.parse(raw),required=selected.operation==='read'?'workspace:read':selected.operation==='approve'?'agent:approve':'policy:manage';
  if(!actor.capabilities?.includes(required))return reply({ok:false,error:'governance_execution_policy_permission_required'},403);
  let policy:unknown;
  if(selected.operation==='propose'){
   if(Object.hasOwn(selected.policy,'organizationId'))return reply({ok:false,error:'invalid_governance_execution_policy_request'},400);
   const{digest:compiledDigest,...canonical}=compileExecutionPolicy({...selected.policy,organizationId:actor.organizationId});policy=canonical;
  }
  const scope={organizationId:actor.organizationId,actorUserId:actor.userId,sessionId:actor.id},headers=new Headers(request.headers);headers.delete('content-length');
  const service=compose(new NextRequest(request.url,{method:'POST',headers,signal}),scope);signal.throwIfAborted();mutationStarted=selected.operation!=='read';
  const pending=selected.operation==='read'?service.readRevision(selected.id):selected.operation==='propose'?service.propose(policy,selected.requestId):selected.operation==='approve'?service.approve(selected.id,selected.version,selected.digest,selected.requestId):selected.operation==='activate'?service.activate(selected.id,selected.pointerVersion,selected.parentDigest,selected.requestId):service.revoke(selected.id,selected.version,selected.requestId);
  const data=await withGithubAbort<unknown>(pending,signal);signal.throwIfAborted();
  if(Buffer.byteLength(JSON.stringify(data))>262144)throw Error('governance_execution_policy_response_unavailable');
  return reply({ok:true,data});
 }catch(error){const invalid=!mutationStarted&&(error instanceof z.ZodError||error instanceof SyntaxError);return reply({ok:false,error:invalid?'invalid_governance_execution_policy_request':mutationStarted?'governance_execution_policy_outcome_unavailable':'governance_execution_policy_unavailable'},invalid?400:409)}
}}
