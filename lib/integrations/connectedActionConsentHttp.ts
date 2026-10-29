import 'server-only';
import {NextResponse,type NextRequest} from 'next/server';
import {z} from 'zod';
import {isSameOriginRequest} from '@/lib/auth/requestOrigin';
import {trustedAxiomUrl,trustedIntegrationCallbackUrl} from './trustedCallbackUrl';
import {consumeToken} from '@/lib/api/rateLimiter';
import {readBoundedGithubBody} from '@/lib/connectors/github/boundedGithubRead';
import {connectedActionConsentEnabled,connectedActionConsentFlow,readConnectedActionAdministrator} from './connectedActionConsentRuntime';
export const isActionConsentState=(v:unknown):v is string=>typeof v==='string'&&/^ca1_[A-Za-z0-9_-]{43}$/.test(v);
const providerSchema=z.enum(['teams','linear']),hint=z.string().regex(/^[A-Za-z0-9_-]{1,240}$/),hints=z.object({expectedOrganizationId:hint,expectedUserId:hint}).strict();
const reply=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
export async function startConnectedActionConsent(request:NextRequest,rawProvider:string){try{
 const provider=providerSchema.parse(rawProvider);if(!isSameOriginRequest(request)||request.nextUrl.search||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return reply({ok:false,error:'invalid_request_origin'},403);const actor=await readConnectedActionAdministrator();if(!actor)return reply({ok:false,error:'workspace_owner_required'},401);if(!connectedActionConsentEnabled())return reply({ok:false,error:'connected_action_consent_disabled'},503);
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(15000)]),input=hints.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readBoundedGithubBody(new Response(request.body),signal,1024))));
 if(input.expectedOrganizationId!==actor.organizationId||input.expectedUserId!==actor.userId)return reply({ok:false,error:'connected_action_workspace_changed'},409);
 if(!consumeToken(`action-consent:${provider}:${actor.organizationId}:${actor.userId}`,{capacity:3,tokensPerSecond:1/60}).allowed)return reply({ok:false,error:'connected_action_consent_rate_limited'},429);
 return reply({ok:true,data:await connectedActionConsentFlow(provider).start(signal)});
 }catch{return reply({ok:false,error:'connected_action_consent_unavailable'},409)}}
export async function completeConnectedActionConsent(request:NextRequest,rawProvider:string){
 const provider=providerSchema.parse(rawProvider),query=request.nextUrl.searchParams,states=query.getAll('state'),codes=query.getAll('code');let status='invalid_state';
 if(states.length===1&&isActionConsentState(states[0])&&codes.length<=1&&request.nextUrl.origin+request.nextUrl.pathname===trustedIntegrationCallbackUrl(`/api/integrations/${provider}/callback`))status=(await connectedActionConsentFlow(provider).complete({state:states[0],code:codes[0],declined:query.has('error'),provider,signal:request.signal})).status;
 const destination=trustedAxiomUrl(`/account/integrations/${provider}/action-access?status=${encodeURIComponent(status)}`);return destination?NextResponse.redirect(destination,303):reply({ok:false,error:'trusted_return_unavailable'},503);
}
