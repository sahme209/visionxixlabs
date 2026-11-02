import 'server-only';
import type {NextRequest} from 'next/server';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {createAgentActionExecutionStore} from '@/lib/axiom/agentRuntime/agentActionExecutionStore';
import {agentExecutionScopeSchema,type AgentExecutionScope} from '@/lib/axiom/agentRuntime/agentActionExecutionContract';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import {readDesktopCommercialAccess} from './desktopCommercialAccess';
/** Paired request composition only. No provider transport or execute entry point.
 * The store independently validates persisted actor, review and Agent policy. */
export function createAgentActionExecutionRequestService(request:NextRequest,repo:ReleaseOperationPlanRepo,rawScope:AgentExecutionScope){
 const scope=Object.freeze(agentExecutionScopeSchema.parse(rawScope));
 const enabled=()=>process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED==='true';
 function available(){request.signal.throwIfAborted();if(!enabled())throw Error('agent_execution_disabled')}
 const store=createAgentActionExecutionStore(repo,{async assertCurrent(_tx,current,purpose){
  request.signal.throwIfAborted();
  if(current.organizationId!==scope.organizationId||current.actorUserId!==scope.actorUserId||current.sessionId!==scope.sessionId)throw Error('agent_execution_scope_changed');
  if(purpose==='executor')available();
  const actor=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'workspace:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,requireActiveAccess:purpose==='executor',route:'Agent requester execution'});
  if(!actor||actor.credentialKind!=='desktop_session'||actor.organizationId!==scope.organizationId||actor.userId!==scope.actorUserId||actor.id!==scope.sessionId)throw Error('desktop_session_required');
  if(purpose==='executor'){
   const commercial=await readDesktopCommercialAccess(scope.organizationId);
   if(commercial.allowed!==true)throw Error('agent_execution_access_required');
   available();
  }
  request.signal.throwIfAborted();
 }});
 return{
  lookup:(proposalId:string)=>store.lookup(scope,proposalId),
  get:(id:string)=>store.get(scope,id),
  cancel:(id:string)=>store.cancel(scope,id),
  prepare:(proposalId:string)=>{try{available();return store.prepare(scope,proposalId)}catch(error){return Promise.reject(error)}},
 };
}
