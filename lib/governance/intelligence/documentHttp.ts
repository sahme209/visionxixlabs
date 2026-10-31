import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {consumeToken} from '@/lib/api/rateLimiter';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {parseUploadedPolicy} from './documentRequirements';
import {scopeSchema} from './contracts';
import {validateEvidenceEnvelope} from './freshness';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import type {createGovernanceRequestService} from './requestService';
import type {RevisionScope} from './revisionStore';
const input=z.object({operation:z.literal('upload_document'),name:z.string().max(124),selection:scopeSchema,base64:z.string().min(1).max(87384),expectedVersion:z.number().int().min(0).max(998).nullable(),requestId:z.string().uuid()}).strict();
type Service=Pick<ReturnType<typeof createGovernanceRequestService>,'uploadDocument'>;
/** Bounded inert source storage only; no URL reads, approval or activation. */
export function createGovernanceDocumentHttp(compose:(r:NextRequest,s:RevisionScope)=>Service,isEnabled:()=>boolean){return async(request:NextRequest)=>{
 const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});let storageStarted=false,inputStarted=false;
 try{
  if(request.method!=='POST'||request.nextUrl.search||request.url.length>2048)return reply({ok:false,error:'invalid_governance_document'},400);
  if(!isEnabled())return reply({ok:false,error:'governance_intelligence_disabled'},503);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(30000)]),actor=await withGithubAbort(resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'workspace:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'governance document upload'}),signal);
  if(!actor||actor.credentialKind!=='desktop_session'||!actor.id||!actor.organizationId||!actor.userId)return reply({ok:false,error:'desktop_session_required'},401);
  if(!actor.capabilities?.includes('policy:manage'))return reply({ok:false,error:'governance_document_permission_required'},403);
  if(!consumeToken(`governance-document:${actor.organizationId}:${actor.userId}`,{capacity:4,tokensPerSecond:1/15}).allowed)return reply({ok:false,error:'rate_limited'},429);
  inputStarted=true;
  if(!request.body||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return reply({ok:false,error:'invalid_governance_document'},400);
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0,raw:unknown;
  try{for(;;){const r=await withGithubAbort(reader.read(),signal);if(r.done)break;size+=r.value.byteLength;if(size>98304)return reply({ok:false,error:'invalid_governance_document'},400);chunks.push(r.value)}raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)))}finally{void reader.cancel().catch(()=>{});reader.releaseLock()}
  const selected=input.parse(raw),bytes=Buffer.from(selected.base64,'base64');if(bytes.toString('base64')!==selected.base64||bytes.byteLength>65536)return reply({ok:false,error:'invalid_governance_document'},400);
  // Reject malformed UTF-8, filenames, binary/credential patterns before storage.
  const parsed=parseUploadedPolicy({organizationId:actor.organizationId,name:selected.name,selection:selected.selection,utf8Bytes:new Uint8Array(bytes),now:Date.now()}),scope={organizationId:actor.organizationId,actorUserId:actor.userId,sessionId:actor.id},headers=new Headers(request.headers);headers.delete('content-length');
  const service=compose(new NextRequest(request.url,{method:'POST',headers,signal}),scope);signal.throwIfAborted();storageStarted=true;
  const saved=await withGithubAbort(service.uploadDocument({name:selected.name,selection:selected.selection,utf8Bytes:new Uint8Array(bytes),expectedVersion:selected.expectedVersion,requestId:selected.requestId}),signal),snapshot=validateEvidenceEnvelope(saved.snapshot);signal.throwIfAborted();
  if(snapshot.organizationId!==scope.organizationId||snapshot.source!=='document'||snapshot.connectionId!=='upload:'+selected.name||snapshot.connectionRevision!==snapshot.sourceDigest||snapshot.sourceDigest!==parsed.snapshot.sourceDigest||hash(snapshot.selection)!==hash(selected.selection)||hash(snapshot.facts)!==hash(parsed.snapshot.facts)||snapshot.completeness!==parsed.snapshot.completeness||snapshot.collectorVersion!=='governance-document-v2'||saved.headVersion!==(selected.expectedVersion===null?0:selected.expectedVersion+1))throw Error('document_response_unavailable');
  return reply({ok:true,data:{id:saved.id,digest:snapshot.digest,sourceDigest:snapshot.sourceDigest,name:selected.name,selection:snapshot.selection,headVersion:saved.headVersion,completeness:snapshot.completeness,createdAt:saved.createdAt}});
 }catch{return reply({ok:false,error:storageStarted?'governance_document_outcome_unavailable':inputStarted?'invalid_governance_document':'governance_document_unavailable'},storageStarted||!inputStarted?409:400)}
}}
