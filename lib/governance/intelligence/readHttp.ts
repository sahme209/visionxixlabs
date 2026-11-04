import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {consumeToken} from '@/lib/api/rateLimiter';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import type {createGovernanceRequestService} from './requestService';
import type {RevisionScope} from './revisionStore';
const revisionId=z.string().regex(/^governance_revision_[a-f0-9]{64}$/),input=z.discriminatedUnion('operation',[z.object({operation:z.literal('read_document_head'),artifactDigest:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),z.object({operation:z.literal('list_evidence')}).strict(),z.object({operation:z.literal('list_collection_sources')}).strict(),z.object({operation:z.literal('list_revisions')}).strict(),z.object({operation:z.literal('read_evidence'),digest:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),z.object({operation:z.literal('lookup_document_upload'),requestId:z.string().uuid()}).strict(),z.object({operation:z.literal('lookup_collection'),requestId:z.string().uuid()}).strict(),z.object({operation:z.literal('read_revision'),id:revisionId}).strict(),z.object({operation:z.literal('read_drift'),id:revisionId}).strict()]);
type Service=Pick<ReturnType<typeof createGovernanceRequestService>,'readDocumentHead'|'lookupCollectionRequest'|'listCollectionSources'|'lookupDocumentUpload'|'readEvidence'|'listEvidence'|'listRevisions'|'readRevision'|'readDrift'>;
/** Read-only endpoint contract. No collect, approve, activate, revoke or provider
 * write is reachable from this dispatcher, even for administrators. */
export function createGovernanceReadHttp(compose:(request:NextRequest,scope:RevisionScope)=>Service,isEnabled:()=>boolean){return async(request:NextRequest)=>{
 const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
 try{
  if(request.method!=='POST'||request.nextUrl.search||request.url.length>2048)return reply({ok:false,error:'invalid_governance_read_request'},400);
  if(!isEnabled())return reply({ok:false,error:'governance_intelligence_disabled'},503);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(30000)]),actor=await withGithubAbort(resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'workspace:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'governance intelligence reads'}),signal);
  if(!actor||actor.credentialKind!=='desktop_session'||!actor.id||!actor.userId||!actor.organizationId)return reply({ok:false,error:'desktop_session_required'},401);
  if(!consumeToken(`governance-read:${actor.organizationId}:${actor.userId}`,{capacity:10,tokensPerSecond:1/6}).allowed)return reply({ok:false,error:'rate_limited'},429);
  if(!request.body||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return reply({ok:false,error:'invalid_governance_read_request'},400);
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;let parsed:unknown;
  try{for(;;){const r=await withGithubAbort(reader.read(),signal);if(r.done)break;size+=r.value.byteLength;if(size>2048)return reply({ok:false,error:'invalid_governance_read_request'},400);chunks.push(r.value)}parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)))}finally{void reader.cancel().catch(()=>{});reader.releaseLock()}
  const selected=input.parse(parsed),scope={organizationId:actor.organizationId,actorUserId:actor.userId,sessionId:actor.id},headers=new Headers(request.headers);headers.delete('content-length');
  const scopedRequest=new NextRequest(request.url,{method:'POST',headers,signal}),service=compose(scopedRequest,scope),data=await withGithubAbort<unknown>(selected.operation==='read_document_head'?service.readDocumentHead(selected.artifactDigest):selected.operation==='lookup_collection'?service.lookupCollectionRequest(selected.requestId):selected.operation==='list_collection_sources'?service.listCollectionSources():selected.operation==='lookup_document_upload'?service.lookupDocumentUpload(selected.requestId):selected.operation==='read_evidence'?service.readEvidence(selected.digest):selected.operation==='list_evidence'?service.listEvidence():selected.operation==='list_revisions'?service.listRevisions():selected.operation==='read_revision'?service.readRevision(selected.id):service.readDrift(selected.id),signal);
  signal.throwIfAborted();if(Buffer.byteLength(JSON.stringify(data))>262144)return reply({ok:false,error:'governance_read_response_limit'},502);return reply({ok:true,data});
 }catch(error){return reply({ok:false,error:error instanceof z.ZodError||error instanceof SyntaxError?'invalid_governance_read_request':'governance_read_unavailable'},error instanceof z.ZodError||error instanceof SyntaxError?400:409)}
}}
