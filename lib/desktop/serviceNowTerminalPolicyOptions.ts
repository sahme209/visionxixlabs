import 'server-only';
import type {NextRequest} from 'next/server';import {NextResponse} from 'next/server';
import {prisma} from '@/lib/db';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {readServiceNowModels} from '@/lib/integrations/servicenow/serviceNowReadAccess';
import {serviceNowTerminalPolicyOptionsSchema} from '@/lib/releaseops/serviceNowTerminalPolicyRequest';
import type {TicketReviewScope} from '@/lib/releaseops/ticketGovernanceReviewContract';
import {createServiceNowTicketConnectionReader,type ServiceNowTicketConnectionRepository} from './serviceNowTicketConnection';
import {readServiceNowTicketCredential} from './serviceNowTicketCredential';
import {serviceNowConnectionSchema} from './serviceNowTicketLifecyclePreparation';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import {consumeToken} from '@/lib/api/rateLimiter';
export function createServiceNowTerminalPolicyOptions(request:NextRequest){
 const connection=createServiceNowTicketConnectionReader(prisma as unknown as ServiceNowTicketConnectionRepository);
 async function administrator(scope:TicketReviewScope,signal:AbortSignal){signal.throwIfAborted();const actor=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'connections:manage',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'ServiceNow terminal policy discovery'});if(!actor||actor.credentialKind!=='desktop_session'||actor.id!==scope.sessionId||actor.userId!==scope.actorUserId||actor.organizationId!==scope.organizationId||!['owner','admin'].includes(String(actor.role)))throw Error('servicenow_policy_administrator_required');signal.throwIfAborted()}
 return{assertAdministrator:administrator,readOptions:async(scope:TicketReviewScope,parent:AbortSignal)=>{
  const signal=AbortSignal.any([parent,AbortSignal.timeout(15000)]);await administrator(scope,signal);const c=serviceNowConnectionSchema.parse(await connection.readConnection(scope,signal));if(c.consentedByUserId!==scope.actorUserId)throw Error('servicenow_connection_owner_required');
  const current=async()=>{await administrator(scope,signal);const value=serviceNowConnectionSchema.parse(await connection.readConnection(scope,signal));if(sha256ContentHash(value)!==sha256ContentHash(c))throw Error('servicenow_connection_changed')};
  const auth=await readServiceNowTicketCredential(connection.readCatalogCredential,scope,c,current,signal);const catalog=await readServiceNowModels({instanceOrigin:c.instanceOrigin,token:{accessToken:auth.accessToken,refreshToken:null,expiresAt:auth.expiresAt,scopes:['axiom.change_management']},signal});await current();
  const models=catalog.models.filter(m=>m.active).sort((a,b)=>a.sysId.localeCompare(b.sysId));if(new Set(models.map(m=>m.sysId)).size!==models.length)throw Error('servicenow_model_ambiguous');
  return serviceNowTerminalPolicyOptionsSchema.parse({connectionId:c.connectionId,connectionRevision:c.connectionRevision,instanceOrigin:c.instanceOrigin,expiresAt:new Date(Math.min(Date.now()+60000,auth.expiresAt)).toISOString(),models:models.slice(0,50).map(m=>({id:m.sysId,label:m.name,modelDigest:sha256ContentHash({instanceOrigin:c.instanceOrigin,model:m})})),truncated:models.length>50});
 }};
}
export async function handleServiceNowTerminalPolicyOptions(request:NextRequest){const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});if(process.env.AXIOM_TICKET_GOVERNANCE_REVIEWS_ENABLED!=='true')return reply({ok:false,error:'ticket_governance_disabled'},503);try{if(request.method!=='GET'||request.nextUrl.search||request.url.length>2048)return reply({ok:false,error:'invalid_ticket_policy_request'},400);const actor=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'connections:manage',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'ServiceNow terminal policy options'});if(!actor||actor.credentialKind!=='desktop_session'||!actor.userId||!actor.organizationId)return reply({ok:false,error:'desktop_session_required'},401);if(!consumeToken(`servicenow-policy:${actor.organizationId}:${actor.userId}`,{capacity:4,tokensPerSecond:1/15}).allowed)return reply({ok:false,error:'rate_limited'},429);const options=await createServiceNowTerminalPolicyOptions(request).readOptions({organizationId:actor.organizationId,actorUserId:actor.userId,sessionId:actor.id},AbortSignal.any([request.signal,AbortSignal.timeout(20000)]));return reply({ok:true,data:options})}catch{return reply({ok:false,error:'servicenow_policy_options_unavailable',retryAllowed:false},409)}}
