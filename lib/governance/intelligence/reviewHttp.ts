import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {consumeToken} from '@/lib/api/rateLimiter';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {compileBaseline} from './contracts';
import type {createGovernanceRequestService} from './requestService';
import type {RevisionScope} from './revisionStore';
const id=z.string().regex(/^governance_revision_[a-f0-9]{64}$/),digest=z.string().regex(/^[a-f0-9]{64}$/),requestId=z.string().uuid(),version=z.number().int().min(0).max(2);
const input=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('propose'),baseline:z.record(z.string(),z.unknown()),requestId}).strict(),
 z.object({operation:z.literal('approve'),id,version,digest,requestId}).strict(),
 z.object({operation:z.literal('revoke'),id,version,requestId}).strict(),
]);
type Service=Pick<ReturnType<typeof createGovernanceRequestService>,'propose'|'approve'|'revoke'>;
/** Exact durable decisions only. No activation, collector, provider write, or
 * caller-supplied authority is reachable. Stores still recheck current roles,
 * evidence freshness, independent actors and optimistic versions under locks. */
export function createGovernanceReviewHttp(compose:(request:NextRequest,scope:RevisionScope)=>Service,isEnabled:()=>boolean){return async(request:NextRequest)=>{
 const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
 let decisionStarted=false;
 try{
  if(request.method!=='POST'||request.nextUrl.search||request.url.length>2048)return reply({ok:false,error:'invalid_governance_review_request'},400);
  if(!isEnabled())return reply({ok:false,error:'governance_intelligence_disabled'},503);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(30000)]),actor=await withGithubAbort(resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'workspace:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'governance intelligence review'}),signal);
  if(!actor||actor.credentialKind!=='desktop_session'||!actor.id||!actor.userId||!actor.organizationId)return reply({ok:false,error:'desktop_session_required'},401);
  if(!consumeToken(`governance-review:${actor.organizationId}:${actor.userId}`,{capacity:6,tokensPerSecond:1/10}).allowed)return reply({ok:false,error:'rate_limited'},429);
  if(!request.body||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return reply({ok:false,error:'invalid_governance_review_request'},400);
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0,raw:unknown;
  try{for(;;){const r=await withGithubAbort(reader.read(),signal);if(r.done)break;size+=r.value.byteLength;if(size>65536)return reply({ok:false,error:'invalid_governance_review_request'},400);chunks.push(r.value)}raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)))}finally{void reader.cancel().catch(()=>{});reader.releaseLock()}
  const selected=input.parse(raw),required=selected.operation==='approve'?'agent:approve':'policy:manage';
  if(!actor.capabilities?.includes(required))return reply({ok:false,error:'governance_review_permission_required'},403);
  let baseline:unknown;
  if(selected.operation==='propose'){
   if(Object.hasOwn(selected.baseline,'organizationId'))return reply({ok:false,error:'invalid_governance_review_request'},400);
   // Compile before touching the service, then pass only canonical typed input.
   const{digest:compiledDigest,compilerVersion,...canonical}=compileBaseline({...selected.baseline,organizationId:actor.organizationId});baseline=canonical;
  }
  const scope={organizationId:actor.organizationId,actorUserId:actor.userId,sessionId:actor.id},headers=new Headers(request.headers);headers.delete('content-length');
  const service=compose(new NextRequest(request.url,{method:'POST',headers,signal}),scope);signal.throwIfAborted();decisionStarted=true;
  const data=await withGithubAbort<unknown>(selected.operation==='propose'?service.propose(baseline,selected.requestId):selected.operation==='approve'?service.approve(selected.id,selected.version,selected.digest,selected.requestId):service.revoke(selected.id,selected.version,selected.requestId),signal);
  signal.throwIfAborted();if(Buffer.byteLength(JSON.stringify(data))>262144)return reply({ok:false,error:'governance_review_outcome_unavailable'},409);
  return reply({ok:true,data});
 }catch(error){const invalid=!decisionStarted&&(error instanceof z.ZodError||error instanceof SyntaxError);return reply({ok:false,error:invalid?'invalid_governance_review_request':decisionStarted?'governance_review_outcome_unavailable':'governance_review_unavailable'},invalid?400:409)}
}}
