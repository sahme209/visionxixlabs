import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '@/lib/db';
import {z} from 'zod';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {consumeToken} from '@/lib/api/rateLimiter';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import {createAssociatedTicketRequestService} from './associatedTicketRequestService';
import {associatedTicketActionsRequestSchema} from './associatedTicketActionsContract';
export async function handleAssociatedTicketActions(request:NextRequest,reviewId:string){
 const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
 if(process.env.AXIOM_TICKET_GOVERNANCE_REVIEWS_ENABLED!=='true')return reply({ok:false,error:'ticket_governance_disabled',retryAllowed:false},503);
 let dispatchAttempt=false;
 try{
  if(request.method!=='POST'||request.nextUrl.search||request.url.length>2048||!/^ticket_review_[a-f0-9]{64}$/.test(reviewId)||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||!request.body)return reply({ok:false,error:'invalid_ticket_action',retryAllowed:false},400);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(25000)]),reader=request.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
  try{for(;;){const part=await withGithubAbort(reader.read(),signal);if(part.done)break;bytes+=part.value.byteLength;if(bytes>12288)return reply({ok:false,error:'invalid_ticket_action',retryAllowed:false},400);chunks.push(part.value)}}finally{void reader.cancel().catch(()=>{});reader.releaseLock()}
  const input=associatedTicketActionsRequestSchema.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))));
  const read=input.action==='list'||input.action==='load'||input.action==='recover'||input.action==='cancel',actor=await resolveRequestDesktopSession(request,{requiredScope:read||input.action==='approve'?'pipeline:read':'pipeline:trigger',requiredCapability:input.action==='approve'?'agent:approve':read?'workspace:read':'deploy:execute',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'ticket deployment evidence action'});
  if(!actor||actor.credentialKind!=='desktop_session'||!actor.organizationId||!actor.userId)return reply({ok:false,error:'desktop_session_required',retryAllowed:false},401);
  const scope={organizationId:actor.organizationId,actorUserId:actor.userId,sessionId:actor.id};
  if(!consumeToken(`ticket-associated-actions:${scope.organizationId}:${scope.actorUserId}`,{capacity:8,tokensPerSecond:0.1}).allowed)return reply({ok:false,error:'rate_limited',retryAllowed:false},429);
  const service=createAssociatedTicketRequestService(request,prisma as unknown as ReleaseOperationPlanRepo,scope,{reviewId,bindingDigest:input.bindingDigest});
  if(input.action==='list')return reply({ok:true,data:await service.list(scope,signal)});
  if(input.action==='close_options')return reply({ok:true,data:{provider:'jira',closeOptions:await service.closeOptions(scope,input.actionId,signal)}});
  if(input.action==='servicenow_close_options')return reply({ok:true,data:{provider:'servicenow',closeOptions:await service.serviceNowCloseOptions(scope,input.actionId,input.terminalPolicy,signal)}});
  if(input.action==='prepare_servicenow_close'){const action=await service.prepareServiceNowClose(scope,input.actionId,input.expectedLinkVersion,input.terminalPolicy,{transitionId:input.transitionId,clientRequestId:input.clientRequestId,...(input.closeCode===undefined?{}:{closeCode:input.closeCode}),...(input.closeNotes===undefined?{}:{closeNotes:input.closeNotes})},signal,input.amendment);return reply({ok:true,data:{provider:'servicenow',action}})}
  const action=input.action==='prepare_link'?await service.prepareLink(scope,input.clientRequestId,signal,input.amendment):input.action==='load'?await service.get(scope,input.actionId,signal):input.action==='prepare_close'?await service.prepareClose(scope,input.actionId,input.expectedLinkVersion,input.transitionId,input.clientRequestId,signal,input.amendment):await service.mutate(scope,{actionId:input.actionId,expectedVersion:input.expectedVersion,clientRequestId:input.clientRequestId},input.action,signal,()=>{dispatchAttempt=true});
  signal.throwIfAborted();const provider=action.id.startsWith('jira_action_')?'jira':'servicenow';if(Buffer.byteLength(JSON.stringify(action),'utf8')>65536)throw Error('ticket_action_too_large');return reply({ok:true,data:{provider,action}});
 }catch(error){return reply({ok:false,error:error instanceof z.ZodError||error instanceof SyntaxError?'invalid_ticket_action':'ticket_action_unavailable',retryAllowed:false},error instanceof z.ZodError||error instanceof SyntaxError?400:dispatchAttempt?502:409)}
}
