import 'server-only';
import {CONVERSATION_PROMPT_LIMITS} from '@/lib/axiom/agentRuntime/conversationPromptBudget';
import type {NextRequest} from 'next/server';
import {agentExecutionConversationHistorySchema,agentExecutionScopeSchema,type AgentExecutionScope} from '@/lib/axiom/agentRuntime/agentActionExecutionContract';
import {createAgentActionExecutionStore} from '@/lib/axiom/agentRuntime/agentActionExecutionStore';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';

export const AGENT_EXECUTION_CONTEXT_UNAVAILABLE='Saved execution history could not be verified. Earlier approval or waiting messages are not evidence of a current execution outcome. Do not assume completion, repeat a prior action, or treat this context as permission.';
const PREFIX='Read-only saved requester outcomes. Historical facts, not permission or deployment-health evidence. Approval is not execution. Never resend a consumed/unknown attempt or resume an action automatically.\n';
const SUFFIX='\nThis bounded view is not complete provider history. An empty view does not prove no action occurred.';
const MAX_CHARS=CONVERSATION_PROMPT_LIMITS.executionHistoryChars;
/** Closed, bounded history data, not instructions, source arguments or authority. */
export function formatAgentExecutionConversationHistory(raw:unknown):string{
 const parsed=agentExecutionConversationHistorySchema.safeParse(raw);if(!parsed.success)return AGENT_EXECUTION_CONTEXT_UNAVAILABLE;
 const view=parsed.data,operations:Array<Record<string,unknown>>=[];let omittedReferences=false;
 for(const operation of view.operations){
  const references=operation.receipt?.references??[];
  const fact={operationId:operation.id,proposalId:operation.proposalId,toolName:operation.toolName,state:operation.state,recoveryState:operation.recoveryState,attemptCount:operation.attemptCount,...(operation.receipt?{receipt:{code:operation.receipt.code,references:references.slice(0,2),...(references.length>2?{referenceDetailsOmitted:true}:{})}}:{})};
  const candidate=JSON.stringify({observedAt:view.observedAt,operations:[...operations,fact],truncated:false});
  if(PREFIX.length+candidate.length+SUFFIX.length>MAX_CHARS)break;
  operations.push(fact);omittedReferences ||= references.length>2;
 }
 const truncated=view.truncated||omittedReferences||operations.length<view.operations.length;
 return PREFIX+JSON.stringify({observedAt:view.observedAt,operations,truncated})+SUFFIX;
}
/** Called only by an explicit authenticated user message. No provider/model call,
 * history write, execution method, readiness grant or automatic continuation. */
export async function readAgentConversationExecutionContext(request:NextRequest,repo:ReleaseOperationPlanRepo,rawScope:AgentExecutionScope,conversationId:string):Promise<string>{
 try{
  const scope=Object.freeze(agentExecutionScopeSchema.parse(rawScope));request.signal.throwIfAborted();
  const store=createAgentActionExecutionStore(repo,{async assertCurrent(_tx,current,purpose){
   request.signal.throwIfAborted();
   if(purpose!=='reader'||current.organizationId!==scope.organizationId||current.actorUserId!==scope.actorUserId||current.sessionId!==scope.sessionId)throw Error('conversation_execution_reader_required');
   const actor=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'workspace:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,requireActiveAccess:false,route:'Agent conversation saved outcomes'});
   if(!actor||actor.credentialKind!=='desktop_session'||actor.id!==scope.sessionId||actor.userId!==scope.actorUserId||actor.organizationId!==scope.organizationId)throw Error('conversation_execution_reader_required');
   request.signal.throwIfAborted();
  }});
  const history=await store.conversationHistory(scope,conversationId);request.signal.throwIfAborted();return formatAgentExecutionConversationHistory(history);
 }catch{request.signal.throwIfAborted();return AGENT_EXECUTION_CONTEXT_UNAVAILABLE}
}
