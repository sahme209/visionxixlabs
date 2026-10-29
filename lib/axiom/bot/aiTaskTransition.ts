import type {AiTaskStatus} from './aiTaskContract';
/** Pure decision only. Callers must enforce the same predicates in a database CAS. */
export type AiTaskFence={status:AiTaskStatus;attemptCount:number;deadline:number;leaseExpiresAt:number;cancelRequested:boolean;sourceCurrent:boolean;authorityCurrent:boolean;receiptVerified:boolean};
export type AiTaskTransition='dispatch'|'cancel'|'recover'|'answer'|'clarification';
export function decideAiTaskTransition(state:AiTaskFence,action:AiTaskTransition,now:number):{status:AiTaskStatus;attemptCount:number}{
 const refuse=():never=>{throw new Error('ai_task_transition_refused')};
 if(![now,state.deadline,state.leaseExpiresAt].every(Number.isFinite)||!Number.isInteger(state.attemptCount)||state.attemptCount<0||state.attemptCount>1)return refuse();
 const pre=state.status==='queued'||state.status==='preparing';
 const sent=state.status==='dispatching'||state.status==='cancel_requested';
 if((pre&&state.attemptCount!==0)||(sent&&state.attemptCount!==1))return refuse();
 const live=now<state.deadline&&now<state.leaseExpiresAt;
 if(action==='cancel'){
  if(pre)return{status:'canceled',attemptCount:0};
  if(sent)return{status:'cancel_requested',attemptCount:1};
  return refuse();
 }
 if(action==='recover'){
  if(live||(!pre&&!sent))return refuse();
  return{status:sent?'outcome_unknown':'failed',attemptCount:state.attemptCount};
 }
 if(!live||state.cancelRequested||!state.sourceCurrent||!state.authorityCurrent)return refuse();
 if(action==='dispatch'){
  if(state.status!=='preparing'||state.attemptCount!==0)return refuse();
  return{status:'dispatching',attemptCount:1};
 }
 if((action==='answer'||action==='clarification')&&state.status==='dispatching'&&state.attemptCount===1&&state.receiptVerified)return{status:action==='answer'?'completed':'needs_input',attemptCount:1};
 return refuse();
}
