import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {consumeToken} from '@/lib/api/rateLimiter';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {discoverySelectionSchema} from './discovery';
import {validateEvidenceEnvelope} from './freshness';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import type {RevisionScope} from './revisionStore';
import type {createGovernanceRequestService} from './requestService';
const input=z.object({operation:z.literal('collect'),selection:z.record(z.string(),z.unknown()),requestId:z.string().uuid()}).strict();
/** Deliberate fixed-profile reads + immutable observation. Never provider writes. */
export function createGovernanceCollectHttp(compose:(r:NextRequest,s:RevisionScope)=>Pick<ReturnType<typeof createGovernanceRequestService>,'collect'>,enabled:()=>boolean){return async(request:NextRequest)=>{
 const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});let started=false,readingInput=false;
 try{
  if(request.method!=='POST'||request.nextUrl.search||request.url.length>2048)return reply({ok:false,error:'invalid_governance_collection'},400);
  if(!enabled())return reply({ok:false,error:'governance_intelligence_disabled'},503);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(30000)]),actor=await withGithubAbort(resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'workspace:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'governance bounded collection'}),signal);
  if(!actor||actor.credentialKind!=='desktop_session'||!actor.id||!actor.organizationId||!actor.userId)return reply({ok:false,error:'desktop_session_required'},401);
  if(!actor.capabilities?.includes('policy:manage'))return reply({ok:false,error:'governance_collection_permission_required'},403);
  if(!consumeToken(`governance-collect:${actor.organizationId}:${actor.userId}`,{capacity:4,tokensPerSecond:1/15}).allowed)return reply({ok:false,error:'rate_limited'},429);
  readingInput=true;if(!request.body||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return reply({ok:false,error:'invalid_governance_collection'},400);
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let bytes=0,raw:unknown;
  try{for(;;){const r=await withGithubAbort(reader.read(),signal);if(r.done)break;bytes+=r.value.byteLength;if(bytes>8192)return reply({ok:false,error:'invalid_governance_collection'},400);chunks.push(r.value)}raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)))}finally{void reader.cancel().catch(()=>{});reader.releaseLock()}
  const selected=input.parse(raw);if(Object.hasOwn(selected.selection,'organizationId'))return reply({ok:false,error:'invalid_governance_collection'},400);
  const selection=discoverySelectionSchema.parse({...selected.selection,organizationId:actor.organizationId}),scope={organizationId:actor.organizationId,actorUserId:actor.userId,sessionId:actor.id},headers=new Headers(request.headers);headers.delete('content-length');
  const service=compose(new NextRequest(request.url,{method:'POST',headers,signal}),scope);signal.throwIfAborted();started=true;
  const saved=await withGithubAbort(service.collect(selection,selected.requestId),signal),e=validateEvidenceEnvelope(saved.snapshot);signal.throwIfAborted();
  if(e.organizationId!==scope.organizationId||e.source!==selection.source||e.connectionId!==selection.connectionId||e.connectionRevision!==selection.connectionRevision||hash(e.selection)!==hash(selection.selection)||hash(e.collectionOperations)!==hash(selection.operations)||e.collectorVersion!=='governance-discovery-read-v1'||Date.parse(e.observedAt)>Date.now()||Date.parse(e.expiresAt)<=Date.now()||Buffer.byteLength(JSON.stringify(saved))>262144)throw Error('collection_response_unavailable');
  return reply({ok:true,data:saved});
 }catch{return reply({ok:false,error:started?'governance_collection_outcome_unavailable':readingInput?'invalid_governance_collection':'governance_collection_unavailable'},started||!readingInput?409:400)}
}}
