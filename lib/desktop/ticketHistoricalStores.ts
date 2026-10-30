import 'server-only';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {createJiraTicketLifecycleStore} from '@/lib/releaseops/jiraTicketLifecycleStore';
import {createServiceNowTicketLifecycleStore} from '@/lib/releaseops/serviceNowTicketLifecycleStore';
import {createReleaseDeploymentExecutionStore} from '@/lib/tauri/releaseDeploymentExecutionStore';
import {createReleaseWorkflowEvidenceStore} from '@/lib/tauri/releaseWorkflowEvidenceStore';
import {createReleaseDeploymentEvidenceBridge} from '@/lib/tauri/releaseDeploymentEvidenceBridge';
import type {TicketReviewScope} from '@/lib/releaseops/ticketGovernanceReviewContract';
import type {JiraTicketActionCandidate} from '@/lib/releaseops/jiraTicketLifecycleContract';
import type {ServiceNowTicketActionCandidate} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
import type {TicketAssociationSourcePorts} from './ticketGovernanceSource';
/** Read-only composition of EXISTING audited stores. No claim, dispatch, finish,
 * credential provider or write-capable lifecycle store is exposed to callers. */
export function createTicketHistoricalStores(repo:ReleaseOperationPlanRepo,ports:{
 assertDeploymentReader:(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,source:unknown)=>Promise<void>;
 assertTicketReader:(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,candidate:Readonly<JiraTicketActionCandidate|ServiceNowTicketActionCandidate>)=>Promise<void>;
}):Required<Pick<TicketAssociationSourcePorts,'readOriginal'|'readAccepted'|'readReviewedBinding'|'readEvidence'>>&{readUnknownLink:(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,id:string,version:number)=>ReturnType<ReturnType<typeof createServiceNowTicketLifecycleStore>['readUnknownLinkHistory']>}{
 const jira=createJiraTicketLifecycleStore(repo,{transportMode:'provider',assertCurrent:async(tx,input)=>{if(input.role!=='read'||input.actorUserId!==input.scope.actorUserId||!input.candidate)throw Error('ticket_archive_read_only');await ports.assertTicketReader(tx,input.scope,input.candidate)}});
 const sn=createServiceNowTicketLifecycleStore(repo,{transportMode:'provider',assertCurrent:async(tx,input)=>{if(input.role!=='read'||input.actorUserId!==input.scope.actorUserId||!input.candidate)throw Error('ticket_archive_read_only');await ports.assertTicketReader(tx,input.scope,input.candidate)}});
 const deployments=createReleaseDeploymentExecutionStore(repo,{assertHistoricalReader:(tx,scope,plan)=>ports.assertDeploymentReader(tx,scope,plan)});
 const evidence=createReleaseWorkflowEvidenceStore(repo,{assertHistoricalReader:async(tx,scope,binding)=>{
  // Evidence bindings retain their original revision and omit installation ID.
  // Derive that identity only from the audited accepted deployment, never from
  // today's mutable connection or a browser-supplied claim.
  const operationId='release_deployment_'+sha256ContentHash({organizationId:binding.organizationId,releaseId:binding.releaseId,releaseVersion:binding.releaseVersion,planId:binding.planId});
  const accepted=await deployments.readHistoricalAcceptedSource(scope,operationId,tx);
  await bridge.readHistoricalBinding(tx,scope,binding);
  await ports.assertDeploymentReader(tx,scope,{...binding,installationId:accepted.plan.installationId});
 }});
 const bridge=createReleaseDeploymentEvidenceBridge(repo,{historicalDeploymentStore:deployments});
 return{
  readUnknownLink:(tx,scope,id,version)=>sn.readUnknownLinkHistory(scope,id,version,tx),
  readOriginal:(tx,scope,id,provider)=>provider==='jira'?jira.readPublishedProvenance(scope,id,tx):sn.readPublishedProvenance(scope,id,tx),
  readAccepted:(tx,scope,id)=>deployments.readHistoricalAcceptedSource(scope,id,tx),
  readReviewedBinding:(tx,scope,binding)=>bridge.readHistoricalBinding(tx,scope,binding),
  readEvidence:(tx,scope,id)=>evidence.readHistorical(scope,id,tx),
 };
}
