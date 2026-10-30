import {serviceNowTerminalPolicyRequestSchema} from '@/lib/releaseops/serviceNowTerminalPolicyRequest';
import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import {consumeToken} from '@/lib/api/rateLimiter';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {ticketGovernanceBindingSchema,type TicketReviewScope} from '@/lib/releaseops/ticketGovernanceReviewContract';
import {ticketAssociationRequestSchema} from './ticketAssociationProposal';
import type {createTicketGovernanceService} from './ticketGovernanceService';
type Service=ReturnType<typeof createTicketGovernanceService>;
const id=z.string().regex(/^ticket_review_[a-f0-9]{64}$/),nonce=z.string().uuid(),action=z.object({expectedVersion:z.number().int().min(0).max(2),clientRequestId:nonce}).strict(),prepare=z.object({binding:z.union([ticketGovernanceBindingSchema,ticketAssociationRequestSchema,serviceNowTerminalPolicyRequestSchema]),clientRequestId:nonce}).strict();
class Refusal extends Error{constructor(readonly code:string,readonly status=409){super(code)}}
/** Installed only by trusted request-bound server composition. Does not dispatch
 * ticket writes; policy/association reviews are separate from execution authority. */
export function createTicketGovernanceHttp(createService:(request:NextRequest,scope:TicketReviewScope)=>Service){
 return async(request:NextRequest,mode:'prepare'|'get'|'approve'|'cancel'|'lookup',reviewId?:string)=>{
  const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
  try{
   if(request.nextUrl.search||request.url.length>2048||(mode==='get'?request.method!=='GET':request.method!=='POST'))throw new Refusal('invalid_ticket_governance_request',400);
   if(mode==='prepare'||mode==='lookup'?reviewId!==undefined:!id.safeParse(reviewId).success)throw new Refusal('invalid_ticket_governance_request',400);
   const signal=AbortSignal.any([request.signal,AbortSignal.timeout(60000)]);
   const actor=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:mode==='approve'?'agent:approve':'workspace:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'ticket governance reviews'});
   if(!actor||actor.credentialKind!=='desktop_session'||!actor.userId||!actor.organizationId)throw new Refusal('desktop_session_required',401);
   const scope={organizationId:actor.organizationId,actorUserId:actor.userId,sessionId:actor.id};
   if(!consumeToken(`ticket-governance:${scope.organizationId}:${scope.actorUserId}`,{capacity:20,tokensPerSecond:1/3}).allowed)throw new Refusal('rate_limited',429);
   const service=createService(request,scope);let input:unknown;
   if(mode!=='get'){
    if(!request.body||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new Refusal('invalid_ticket_governance_request',400);
    const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
    try{for(;;){const result=await withGithubAbort(reader.read(),signal);if(result.done)break;size+=result.value.byteLength;if(size>24576)throw new Refusal('invalid_ticket_governance_request',400);chunks.push(result.value)}input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)))}finally{void reader.cancel().catch(()=>{});reader.releaseLock()}
   }
   const data=mode==='lookup'?await service.lookup(scope,z.object({clientRequestId:nonce}).strict().parse(input).clientRequestId,signal):mode==='prepare'?await service.prepare(scope,prepare.parse(input).binding,prepare.parse(input).clientRequestId,signal):mode==='get'?await service.get(scope,reviewId!,signal):mode==='approve'?await service.approve(scope,{id:reviewId!,...action.parse(input)},signal):await service.cancel(scope,{id:reviewId!,...action.parse(input)},signal);
   signal.throwIfAborted();if(Buffer.byteLength(JSON.stringify(data),'utf8')>262144)throw new Refusal('ticket_governance_response_too_large',502);
   return reply({ok:true,data},mode==='prepare'?201:200);
  }catch(error){return reply({ok:false,error:error instanceof Refusal?error.code:error instanceof z.ZodError||error instanceof SyntaxError?'invalid_ticket_governance_request':'ticket_governance_unavailable',retryAllowed:false},error instanceof Refusal?error.status:error instanceof z.ZodError||error instanceof SyntaxError?400:409)}
 };
}
