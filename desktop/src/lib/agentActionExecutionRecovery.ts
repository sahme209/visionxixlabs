import {z} from 'zod';
import {agentActionRequest,type AgentActionTransportContext as Context} from './agentActionExecutionTransport';
const identity=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x1f\x7f]/.test(v));
const receipt=z.object({code:z.enum(['action_completed','pre_dispatch_refused','provider_outcome_unknown']),references:z.array(z.object({kind:z.enum(['github_branch','github_commit','github_pull_request','github_workflow','environment','deployment_target','identity_provider']),id:identity}).strict()).max(16).optional()}).strict();
export const agentActionExecutionRecoverySchema=z.object({
 id:z.string().regex(/^agent_execution_[a-f0-9]{64}$/),proposalId:identity,
 toolName:z.enum(['create_github_branch','commit_github_file','commit_github_files','open_github_pull_request','trigger_aws_deploy','create_environment','configure_deployment_target','connect_identity_provider']),
 state:z.enum(['prepared','dispatching','confirmed','refused','unknown','cancelled']),version:z.number().int().min(0).max(2),attemptCount:z.number().int().min(0).max(1),createdAt:z.string().datetime(),expiresAt:z.string().datetime(),observedAt:z.string().datetime(),
 recoveryState:z.enum(['not_started','dispatch_unconfirmed','lease_elapsed_unconfirmed','confirmed','refused','unknown','cancelled']),receipt:receipt.optional(),
}).strict().refine(v=>Date.parse(v.observedAt)>=Date.parse(v.createdAt)&&Date.parse(v.expiresAt)>Date.parse(v.createdAt)&&v.version===(v.state==='prepared'?0:v.state==='cancelled'||v.state==='dispatching'?1:2)&&v.attemptCount===(v.state==='prepared'||v.state==='cancelled'?0:1)&&v.recoveryState===(v.state==='prepared'?'not_started':v.state==='dispatching'?v.recoveryState:v.state)&&(v.state!=='dispatching'||['dispatch_unconfirmed','lease_elapsed_unconfirmed'].includes(v.recoveryState))).refine(v=>v.state==='confirmed'||v.state==='refused'||v.state==='unknown'?v.receipt?.code===({confirmed:'action_completed',refused:'pre_dispatch_refused',unknown:'provider_outcome_unknown'} as const)[v.state]:v.receipt===undefined);
export type AgentActionExecutionRecovery=z.infer<typeof agentActionExecutionRecoverySchema>;
export type AgentActionRecoveryResult={ok:true;data:AgentActionExecutionRecovery|null}|{ok:false;error:string};
/** One deliberate metadata read. Never prepares, claims, executes or retries. */
export async function readAgentActionExecution(context:Context,proposalId:string,parent?:AbortSignal):Promise<AgentActionRecoveryResult>{
 const fail=():AgentActionRecoveryResult=>({ok:false,error:'Saved action outcome could not be verified. No action was repeated.'});
 if(!identity.safeParse(proposalId).success)return fail();
 const result=await agentActionRequest(context,'GET',`/api/desktop/agent/action-executions?proposalId=${encodeURIComponent(proposalId)}`,undefined,raw=>z.object({ok:z.literal(true),data:agentActionExecutionRecoverySchema.nullable()}).strict().parse(raw).data,parent);
 if(!result.ok||result.data&&result.data.proposalId!==proposalId)return fail();return{ok:true,data:result.data};
}
