import 'server-only';
import type {NextRequest} from 'next/server';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {createAgentActionExecutionCoordinator} from '@/lib/axiom/agentRuntime/agentActionExecutionCoordinator';
import {assertAgentActionHttpSourceSupported,projectAgentActionEligibility} from './agentActionEligibility';
import {createAgentActionExecutionStore} from '@/lib/axiom/agentRuntime/agentActionExecutionStore';
import {agentExecutionScopeSchema,type AgentExecutionScope} from '@/lib/axiom/agentRuntime/agentActionExecutionContract';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import {readBillingPlanWithAvailability} from '@/lib/billing/tenantBillingStore';
import {decideDesktopCommercialAccess} from './desktopCommercialAccessPolicy';
/** Request-bound fixed execution composition. The store independently validates
 * persisted actor/review/policy; display metadata is never execution authority. */
export type AgentActionExecutionRequestRepo=ReleaseOperationPlanRepo&Parameters<typeof createAgentActionExecutionCoordinator>[2];
export function createAgentActionExecutionRequestService(request:NextRequest,repo:AgentActionExecutionRequestRepo,rawScope:AgentExecutionScope){
 const scope=Object.freeze(agentExecutionScopeSchema.parse(rawScope));
 const enabled=()=>process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED==='true';
 function available(){request.signal.throwIfAborted();if(!enabled())throw Error('agent_execution_disabled')}
 async function currentActor(current:AgentExecutionScope,purpose:'reader'|'executor'){
  request.signal.throwIfAborted();
  if(current.organizationId!==scope.organizationId||current.actorUserId!==scope.actorUserId||current.sessionId!==scope.sessionId)throw Error('agent_execution_scope_changed');
  if(purpose==='executor')available();
  const actor=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'workspace:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,requireActiveAccess:purpose==='executor',route:'Agent requester execution'});
  if(!actor||actor.credentialKind!=='desktop_session'||actor.organizationId!==scope.organizationId||actor.userId!==scope.actorUserId||actor.id!==scope.sessionId)throw Error('desktop_session_required');
  if(purpose==='executor'){
   const billing=await readBillingPlanWithAvailability(scope.organizationId);
   if(billing.available!==true||decideDesktopCommercialAccess(billing.plan).allowed!==true)throw Error('agent_execution_access_required');
   available();
  }
  request.signal.throwIfAborted();return actor;
 }
 const store=createAgentActionExecutionStore(repo,{async assertCurrent(_tx,current,purpose){await currentActor(current,purpose)}});
 return{
  lookup:(proposalId:string)=>store.lookup(scope,proposalId),
  get:(id:string)=>store.get(scope,id),
  cancel:(id:string)=>store.cancel(scope,id),
  async eligibility(proposalId:string){
   await currentActor(scope,'reader');
   if(!enabled())return{proposalId,canPrepare:false,canExecute:false,reason:'execution_disabled' as const};
   try{return projectAgentActionEligibility(proposalId,await store.readExecutionReadiness(scope,proposalId))}
   catch{return{proposalId,canPrepare:false,canExecute:false,reason:'review_unavailable' as const}}
  },
  async prepare(proposalId:string){
   available();const ready=await store.readExecutionReadiness(scope,proposalId);
   assertAgentActionHttpSourceSupported(ready.source);
   if(!ready.sessionMatches||ready.operation&&ready.operation.state!=='prepared')throw Error('agent_execution_unavailable');
   available();const operation=await store.prepare(scope,proposalId);
   if(operation.state!=='prepared')throw Error('agent_execution_consumed');return operation;
  },
  async execute(id:string){
   available();const principal=await currentActor(scope,'executor');
   assertAgentActionHttpSourceSupported(await store.inspectForExecution(scope,id));
   available();return createAgentActionExecutionCoordinator(request,principal,repo,store,scope).execute(id);
  },
 };
}
