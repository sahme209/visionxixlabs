import {agentActionEligibilityDtoSchema as agentActionEligibilitySchema} from '../../../lib/tauri/agentActionEligibilityContract';
import {z} from 'zod';
import {agentActionRequest as request,type AgentActionTransportContext as Context} from './agentActionExecutionTransport';
import {agentActionExecutionRecoverySchema,type AgentActionExecutionRecovery} from './agentActionExecutionRecovery';
const identity=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x1f\x7f]/.test(v)),operationId=z.string().regex(/^agent_execution_[a-f0-9]{64}$/);
export {agentActionEligibilitySchema};
export type AgentActionEligibility=z.infer<typeof agentActionEligibilitySchema>;
export const agentActionMutationSchema=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('prepare'),proposalId:identity}).strict(),
 z.object({operation:z.literal('execute'),id:operationId}).strict(),
 z.object({operation:z.literal('cancel'),id:operationId}).strict(),
]);
export type AgentActionMutation=z.infer<typeof agentActionMutationSchema>;
export type AgentActionEligibilityResult={ok:true;data:AgentActionEligibility}|{ok:false;error:string};
export type AgentActionMutationResult={ok:true;data:AgentActionExecutionRecovery}|{ok:false;error:string;outcomeUnconfirmed:boolean};

/** Readiness is display metadata, never execution authority. No discovery or mutation. */
export async function readAgentActionEligibility(context:Context,proposalId:string,parent?:AbortSignal):Promise<AgentActionEligibilityResult>{
 const failure={ok:false as const,error:'Execution readiness could not be verified. No action was prepared or run.'};
 if(!identity.safeParse(proposalId).success)return failure;
 const result=await request(context,'GET',`/api/desktop/agent/action-executions/eligibility?proposalId=${encodeURIComponent(proposalId)}`,undefined,raw=>z.object({ok:z.literal(true),data:agentActionEligibilitySchema}).strict().parse(raw).data,parent);
 return result.ok&&result.data.proposalId===proposalId?result:failure;
}
/** One explicit command only. Lost responses require read-only reconciliation. */
export async function mutateAgentActionExecution(context:Context,raw:AgentActionMutation,parent?:AbortSignal):Promise<AgentActionMutationResult>{
 const input=agentActionMutationSchema.safeParse(raw);
 const fail=(uncertain:boolean):AgentActionMutationResult=>({ok:false,outcomeUnconfirmed:uncertain,error:uncertain?'Action outcome could not be confirmed. Check saved action history; do not resend.':'The action request was not sent. Check current readiness before trying again.'});
 if(!input.success)return fail(false);
 const result=await request(context,'POST','/api/desktop/agent/action-executions',input.data,raw=>z.object({ok:z.literal(true),data:agentActionExecutionRecoverySchema}).strict().parse(raw).data,parent);
 if(!result.ok)return fail(result.sent);
 if(input.data.operation==='prepare'?result.data.proposalId!==input.data.proposalId:result.data.id!==input.data.id)return fail(true);
 if(input.data.operation==='cancel'&&result.data.state!=='cancelled'||input.data.operation==='execute'&&(result.data.state==='prepared'||result.data.state==='cancelled'))return fail(true);
 return result;
}
