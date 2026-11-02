import {z} from 'zod';
import {assertDesktopNotAborted} from './abortSignal';
const identity=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x1f\x7f]/.test(v));
const receipt=z.object({code:z.enum(['action_completed','pre_dispatch_refused','provider_outcome_unknown']),references:z.array(z.object({kind:z.enum(['github_branch','github_commit','github_pull_request','github_workflow','environment','deployment_target','identity_provider']),id:identity}).strict()).max(16).optional()}).strict();
export const agentActionExecutionRecoverySchema=z.object({
 id:z.string().regex(/^agent_execution_[a-f0-9]{64}$/),proposalId:identity,
 toolName:z.enum(['create_github_branch','commit_github_file','commit_github_files','open_github_pull_request','trigger_aws_deploy','create_environment','configure_deployment_target','connect_identity_provider']),
 state:z.enum(['prepared','dispatching','confirmed','refused','unknown','cancelled']),version:z.number().int().min(0).max(2),attemptCount:z.number().int().min(0).max(1),createdAt:z.string().datetime(),expiresAt:z.string().datetime(),observedAt:z.string().datetime(),
 recoveryState:z.enum(['not_started','dispatch_unconfirmed','lease_elapsed_unconfirmed','confirmed','refused','unknown','cancelled']),receipt:receipt.optional(),
}).strict().refine(v=>Date.parse(v.observedAt)>=Date.parse(v.createdAt)&&Date.parse(v.expiresAt)>Date.parse(v.createdAt)&&v.version===(v.state==='prepared'?0:v.state==='cancelled'||v.state==='dispatching'?1:2)&&v.attemptCount===(v.state==='prepared'||v.state==='cancelled'?0:1)&&v.recoveryState===(v.state==='prepared'?'not_started':v.state==='dispatching'?v.recoveryState:v.state)&&(v.state!=='dispatching'||['dispatch_unconfirmed','lease_elapsed_unconfirmed'].includes(v.recoveryState))).refine(v=>v.state==='confirmed'||v.state==='refused'||v.state==='unknown'?v.receipt?.code===({confirmed:'action_completed',refused:'pre_dispatch_refused',unknown:'provider_outcome_unknown'} as const)[v.state]:v.receipt===undefined);
export type AgentActionExecutionRecovery=z.infer<typeof agentActionExecutionRecoverySchema>;
interface Context{getConfig:()=>{apiBase:string;sessionToken?:string};getRevision:()=>number;subscribe:(listener:()=>void)=>()=>void}
export type AgentActionRecoveryResult={ok:true;data:AgentActionExecutionRecovery|null}|{ok:false;error:string};
/** One deliberate metadata read. Never prepares, claims, executes or retries. */
export async function readAgentActionExecution(context:Context,proposalId:string,parent?:AbortSignal):Promise<AgentActionRecoveryResult>{
 const fail=():AgentActionRecoveryResult=>({ok:false,error:'Saved action outcome could not be verified. No action was repeated.'});
 const config=context.getConfig(),revision=context.getRevision(),token=config.sessionToken;
 if(!identity.safeParse(proposalId).success||!token?.startsWith('axm.desk.')||parent?.aborted)return fail();
 const base=config.apiBase,abort=new AbortController(),cancel=()=>abort.abort(),unsubscribe=context.subscribe(cancel),timer=setTimeout(cancel,15000);
 parent?.addEventListener('abort',cancel,{once:true});
 const owned=()=>{assertDesktopNotAborted(abort.signal);if(context.getConfig()!==config||context.getRevision()!==revision||config.apiBase!==base||config.sessionToken!==token)throw Error('request_context_changed')};
 try{
  owned();const response=await fetch(`${base}/api/desktop/agent/action-executions?proposalId=${encodeURIComponent(proposalId)}`,{method:'GET',credentials:'omit',redirect:'error',cache:'no-store',headers:{Accept:'application/json',Authorization:`Bearer ${token}`},signal:abort.signal});owned();
  if(!response.ok||!response.body) return fail();
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const next=await reader.read();owned();if(next.done)break;size+=next.value.byteLength;if(size>16384)throw Error('response_too_large');chunks.push(next.value)}}finally{void reader.cancel().catch(()=>{});reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  const body=z.object({ok:z.literal(true),data:agentActionExecutionRecoverySchema.nullable()}).strict().parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));owned();
  if(body.data&&body.data.proposalId!==proposalId)return fail();return{ok:true,data:body.data};
 }catch{return fail()}finally{clearTimeout(timer);parent?.removeEventListener('abort',cancel);unsubscribe();abort.abort()}
}
