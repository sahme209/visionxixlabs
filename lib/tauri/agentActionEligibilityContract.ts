import {z} from 'zod';
const identity=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x1f\x7f]/.test(v)),operationId=z.string().regex(/^agent_execution_[a-f0-9]{64}$/);
export const agentActionEligibilityDtoSchema=z.object({
 proposalId:identity,canPrepare:z.boolean(),canExecute:z.boolean(),operationId:operationId.optional(),
 reason:z.enum(['ready_to_prepare','ready_to_execute','execution_disabled','requester_required','review_unavailable','review_expired','current_access_required','tool_unsupported','governance_coverage_unavailable','operation_consumed','operation_session_changed','workflow_incomplete','unavailable']),
 expiresAt:z.string().datetime().optional(),effect:z.string().min(1).max(500).refine(v=>!/[\x00-\x1f\x7f]/.test(v)).optional(),
}).strict().refine(v=>v.canPrepare?v.canExecute===false&&v.operationId===undefined&&v.reason==='ready_to_prepare'&&Boolean(v.expiresAt&&v.effect):v.canExecute?v.reason==='ready_to_execute'&&Boolean(v.operationId&&v.expiresAt&&v.effect):v.reason!=='ready_to_prepare'&&v.reason!=='ready_to_execute');
export type AgentActionEligibilityDto=z.infer<typeof agentActionEligibilityDtoSchema>;
