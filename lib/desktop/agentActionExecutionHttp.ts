import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {consumeToken} from '@/lib/api/rateLimiter';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {agentActionExecutionDtoSchema,agentExecutionScopeSchema,type AgentExecutionScope} from '@/lib/axiom/agentRuntime/agentActionExecutionContract';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import type {createAgentActionExecutionRequestService} from './agentActionExecutionRequestService';
const identity=z.string().min(1).max(240).refine(v=>v.trim()===v&&!/[\x00-\x1f\x7f]/.test(v));
const operationId=z.string().regex(/^agent_execution_[a-f0-9]{64}$/);
const mutation=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('prepare'),proposalId:identity}).strict(),
 z.object({operation:z.literal('cancel'),id:operationId}).strict(),
]);
class Refusal extends Error{constructor(readonly code:string,readonly status:number){super(code)}}
/** No execute dispatch here until fixed stored-operation transport composition is complete. */
export function createAgentActionExecutionHttp(compose:(request:NextRequest,scope:AgentExecutionScope)=>ReturnType<typeof createAgentActionExecutionRequestService>){
 return async(request:NextRequest)=>{
  const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(15000)]);
  try{
   if(request.url.length>2048||!['GET','POST'].includes(request.method))throw new Refusal('invalid_agent_execution_request',400);
   let query:{id?:string;proposalId?:string}|undefined,input:z.infer<typeof mutation>|undefined;
   if(request.method==='GET'){
    const entries=[...request.nextUrl.searchParams.entries()];
    if(entries.length!==1||!['id','proposalId'].includes(entries[0][0]))throw new Refusal('invalid_agent_execution_request',400);
    query=entries[0][0]==='id'?{id:operationId.parse(entries[0][1])}:{proposalId:identity.parse(entries[0][1])};
   }else{
    if(request.nextUrl.search||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||!request.body)throw new Refusal('invalid_agent_execution_request',400);
    const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
    try{for(;;){const part=await withGithubAbort(reader.read(),signal);if(part.done)break;size+=part.value.byteLength;if(size>2048)throw new Refusal('invalid_agent_execution_request',400);chunks.push(part.value)}
     input=mutation.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))));
    }finally{void reader.cancel().catch(()=>{});try{reader.releaseLock()}catch{}}
    if(input.operation==='prepare'&&process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED!=='true')throw new Refusal('agent_execution_disabled',503);
   }
   const actor=await withGithubAbort(resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'workspace:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,requireActiveAccess:input?.operation==='prepare',route:'Agent requester operation'}),signal);
   if(!actor||actor.credentialKind!=='desktop_session')throw new Refusal('desktop_session_required',401);
   const scope=agentExecutionScopeSchema.parse({organizationId:actor.organizationId,actorUserId:actor.userId,sessionId:actor.id});
   if(!consumeToken(`agent-execution:${scope.organizationId}:${scope.actorUserId}`,{capacity:12,tokensPerSecond:1/5}).allowed)throw new Refusal('rate_limited',429);
   signal.throwIfAborted();const service=compose(request,scope);
   const value=await withGithubAbort(query?.id?service.get(query.id):query?.proposalId?service.lookup(query.proposalId):input?.operation==='prepare'?service.prepare(input.proposalId):service.cancel(input!.id),signal);
   signal.throwIfAborted();const parsed=agentActionExecutionDtoSchema.safeParse(value);
   if(!(value===null&&query?.proposalId)&&!parsed.success)throw new Refusal('agent_execution_unavailable',409);
   const data=value===null&&query?.proposalId?null:parsed.success?parsed.data:null;
   return reply({ok:true,data},input?.operation==='prepare'?201:200);
  }catch(error){const invalid=error instanceof z.ZodError||error instanceof SyntaxError;return reply({ok:false,error:error instanceof Refusal?error.code:invalid?'invalid_agent_execution_request':'agent_execution_unavailable',retryAllowed:false,recovery:'read_original_operation'},error instanceof Refusal?error.status:invalid?400:409)}
 };
}
