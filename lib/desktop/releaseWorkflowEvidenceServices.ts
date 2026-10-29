import 'server-only';
import type {NextRequest} from 'next/server';
import {createReleaseDeploymentServices} from './releaseDeploymentServices';
import {createReleaseDeploymentExecutionStore,releaseDeploymentExecutionId} from '@/lib/tauri/releaseDeploymentExecutionStore';
import {createReleaseDeploymentEvidenceBridge} from '@/lib/tauri/releaseDeploymentEvidenceBridge';
import {createReleaseWorkflowObservationGithub} from '@/lib/tauri/releaseWorkflowObservationGithub';
import {deploymentPlanSchema,RELEASE_DEPLOYMENT_EXECUTION_KIND,type DeploymentScope} from '@/lib/tauri/releaseDeploymentExecutionContract';
import type {ReleaseOperationPlan} from '@/lib/tauri/releaseOperationPlanContract';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {ReleaseWorkflowEvidenceHttpPorts} from './releaseWorkflowEvidenceHttp';
import {resolveReleaseInstallationToken} from '@/lib/connectors/github/githubAppAuth';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import {sha256ContentHash} from '@/lib/tauri/contentHash';

/** Reuses the accepted-operation ledger and existing observation adapter. This
 * composition has no dispatch/claim/approval-consumption entry point. */
export function createReleaseWorkflowEvidenceServices(request:NextRequest,repo:ReleaseOperationPlanRepo,scope:DeploymentScope,reviewed:ReleaseOperationPlan,options:{requesterUserId:string;isEnabled:()=>boolean;isPlanAllowed:(p:{organizationId:string;repositoryFullName:string})=>boolean;fetch?:typeof fetch}):ReleaseWorkflowEvidenceHttpPorts {
 const enabled=()=>scope.actorUserId===options.requesterUserId&&options.isEnabled()&&!request.signal.aborted&&options.isPlanAllowed({organizationId:scope.organizationId,repositoryFullName:reviewed.pullRequest.repositoryFullName});
 function refuse():never{throw Error('release_workflow_evidence_unavailable')}
 const serverFetch=options.fetch??fetch;
 const services=createReleaseDeploymentServices(request,repo,scope,{observationOnly:true,sourcePolicy:'github_immutable_release_v1',isEnabled:enabled,isPlanAllowed:options.isPlanAllowed,fetch:serverFetch});
 const dependencies=services.ports.dependencies;
 if(!dependencies)return {enabled:()=>false};
 const deploymentStore=createReleaseDeploymentExecutionStore(repo,dependencies);
 const bridge=createReleaseDeploymentEvidenceBridge(repo,{deploymentStore});
 let preparedPlan:ReturnType<typeof deploymentPlanSchema.parse>|undefined;
 const current=async(signal:AbortSignal)=>{
  signal.throwIfAborted();if(!enabled())refuse();
  const p=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'github:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'release workflow evidence observation'});
  if(!p||p.credentialKind!=='desktop_session'||p.id!==scope.sessionId||p.userId!==scope.actorUserId||p.organizationId!==scope.organizationId||!p.capabilities.includes('github:read'))refuse();
  signal.throwIfAborted();if(!enabled())refuse();
 };
 let acceptedOperationId:string|undefined;
 const prepare=async(planId:string,signal:AbortSignal)=>{
  await current(signal);
  const row=await repo.durableAgentWorkflow.findFirst({where:{organizationId:scope.organizationId,workflowKind:RELEASE_DEPLOYMENT_EXECUTION_KIND,id:'release_deployment_'+sha256ContentHash({organizationId:scope.organizationId,releaseId:reviewed.requestId,releaseVersion:reviewed.requestVersion,planId})}});
  const raw=row?.inputJson;if(!raw||typeof raw!=='object'||Array.isArray(raw)||!('plan' in raw))refuse();
  const p=deploymentPlanSchema.parse(raw.plan);
  if(p.planId!==planId||p.organizationId!==scope.organizationId||p.releaseId!==reviewed.requestId||p.releaseVersion!==reviewed.requestVersion||p.intakeDigest!==reviewed.intakeDigest||p.repositoryFullName!==reviewed.pullRequest.repositoryFullName||p.connectionId!==reviewed.connectionId||p.connectionRevision!==reviewed.connectionRevision||p.executorUserId!==scope.actorUserId||!enabled())refuse();
  const saved=await deploymentStore.get(scope,releaseDeploymentExecutionId(p));if(saved.state!=='accepted'||!saved.receipt)refuse();
  if(!services.ports.preflight)refuse();await services.ports.preflight(p,signal);
  acceptedOperationId=releaseDeploymentExecutionId(p);preparedPlan=p;
  await current(signal);
 };
 const observation=createReleaseWorkflowObservationGithub({isEnabled:enabled,fetch:serverFetch,assertCurrent:(_b,s)=>current(s),readTrustedDispatchBinding:(b,s)=>{s.throwIfAborted();return repo.$transaction(tx=>bridge.readCurrentBinding(tx,scope,b))},readCredential:async(b,s)=>{
  await current(s);const p=preparedPlan;if(!p||p.planId!==b.planId||p.connectionId!==b.connectionId||p.connectionRevision!==b.connectionRevision||p.repositoryFullName!==b.repositoryFullName)refuse();
  const c=await resolveReleaseInstallationToken({installationId:p.installationId,repositoryFullName:p.repositoryFullName,purpose:'workflow_read',isEnabled:enabled,assertCurrent:()=>current(s),fetch:serverFetch},s);
  if(!c||Object.keys(c.permissions).sort().join(',')!=='actions,contents,metadata'||c.permissions.actions!=='read'||c.permissions.contents!=='read'||c.permissions.metadata!=='read')refuse();
  return {organizationId:scope.organizationId,connectionId:p.connectionId,connectionRevision:p.connectionRevision,repositoryFullName:p.repositoryFullName,installationId:p.installationId,token:c.token,expiresAt:c.expiresAt,actionsRead:true};
 }});
 return {enabled,preflight:prepare,readCurrentBinding:bridge.readCurrentBinding,verifyObservation:observation,collectAcceptedBinding:async(s,planId,signal)=>{
  if(sha256ContentHash(s)!==sha256ContentHash(scope))refuse();await prepare(planId,signal);if(!acceptedOperationId)refuse();return bridge.readAcceptedBinding(scope,acceptedOperationId);
 }};
}
