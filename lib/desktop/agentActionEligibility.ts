import 'server-only';
import {agentActionEligibilityDtoSchema,type AgentActionEligibilityDto} from '@/lib/tauri/agentActionEligibilityContract';
import {validateAgentActionExecutionInput} from '@/lib/axiom/agentRuntime/agentActionExecutionCoordinator';
import {restartWorkflowSourceFromArgs} from '@/lib/tauri/agentRestartWorkflowSource';
import {AGENT_RESTART_WORKFLOW_CONTENT_SHA256} from '@/lib/axiom/agentRuntime/agentRestartWorkflowSource';
import type {createAgentActionExecutionStore} from '@/lib/axiom/agentRuntime/agentActionExecutionStore';
export {agentActionEligibilityDtoSchema};
type Readiness=Awaited<ReturnType<ReturnType<typeof createAgentActionExecutionStore>['readExecutionReadiness']>>;
type Source=Readiness['source'];
/** Qualify only fixed reviewed source profiles. This is not execution authority:
 * the store, current guard and transport independently validate before action. */
export function assertAgentActionHttpSourceSupported(source:Source){
 if(source.toolName==='trigger_aws_deploy'){
  const workflow=restartWorkflowSourceFromArgs(source.args);
  if(!workflow||workflow.workflowContentSha256!==AGENT_RESTART_WORKFLOW_CONTENT_SHA256)throw Error('agent_execution_workflow_incomplete');
 }
 validateAgentActionExecutionInput(source);
}
const effects:Record<string,string>={trigger_aws_deploy:'Dispatch the exact reviewed restart workflow tag for the reviewed ECS target. Mutable image tags and application health are not verified.',open_github_pull_request:"Open the reviewed pull request after checking its captured head and base commits.",create_github_branch:"Create the reviewed branch at its exact approved base commit.",create_environment:'Create the reviewed environment configuration.',configure_deployment_target:'Apply the reviewed AWS deployment target configuration.',connect_identity_provider:'Create the reviewed pending identity-provider configuration.',commit_github_file:'Commit the exact reviewed file change on its reviewed branch.',commit_github_files:'Commit the exact reviewed file changes on their reviewed branch.'};
/** Project actual stored authority to display metadata only. Raw source, roles,
 * approval proofs and provider credentials never enter this public object. */
export function projectAgentActionEligibility(proposalId:string,ready:Readiness):AgentActionEligibilityDto{
 const base={proposalId,canPrepare:false,canExecute:false};
 try{assertAgentActionHttpSourceSupported(ready.source)}catch{return agentActionEligibilityDtoSchema.parse({...base,reason:'workflow_incomplete'})}
 if(ready.operation?.state!=='prepared'&&ready.operation!==null)return agentActionEligibilityDtoSchema.parse({...base,reason:'operation_consumed'});
 if(!ready.sessionMatches)return agentActionEligibilityDtoSchema.parse({...base,reason:'operation_session_changed'});
 const common={proposalId,expiresAt:ready.expiresAt,effect:effects[ready.source.toolName]};
 return agentActionEligibilityDtoSchema.parse(ready.operation?{...common,canPrepare:false,canExecute:true,reason:'ready_to_execute',operationId:ready.operation.id}:{...common,canPrepare:true,canExecute:false,reason:'ready_to_prepare'});
}
