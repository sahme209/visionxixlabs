import {randomUUID} from 'node:crypto';
import {captureCurrentDesktopSessionFreshness} from './currentSessionFreshness';
import {createReleaseCredentialExposureStore,type ReleaseCredentialExposureBinding} from '@/lib/governance/intelligence/releaseCredentialExposureStore';
import {readEnrollmentDrainBarrierLocked} from '@/lib/governance/intelligence/enrollmentDrainStore';
import {createReleaseDeploymentExecutionStore} from '@/lib/tauri/releaseDeploymentExecutionStore';
import {createReleaseDeploymentGovernanceCoordinator} from './releaseDeploymentGovernanceCoordinator';
import {createGovernanceDeploymentApprovalComposition} from '@/lib/governance/intelligence/deploymentApprovalComposition';
import type {AwsConnectionReadRepo} from '@/lib/cloud/aws/enrollment/scopedConnection';
import {createImmutableReleasePolicyReader,IMMUTABLE_RELEASE_POLICY} from '@/lib/tauri/releaseImmutableReleasePolicy';
import {inReleaseVerificationPhase as phase,ReleaseVerificationFailure} from './releaseVerificationPhase';
import 'server-only';
import type {NextRequest} from 'next/server';
import {createReleaseDeploymentAuthority} from './releaseDeploymentAuthority';
import type {ReleaseDeploymentServicePorts} from './releaseDeploymentExecutionHttp';
import {createReleaseDeploymentApprovalStore,RELEASE_DEPLOYMENT_APPROVAL_KIND} from '@/lib/tauri/releaseDeploymentApprovalStore';
import {createProtectedTagPolicyReader} from '@/lib/tauri/releaseProtectedTagPolicy';
import {createReleaseDeploymentGithubReaders} from '@/lib/tauri/releaseDeploymentGithubReaders';
import {createReleaseDeploymentGithubTransport,type ReleaseDeploymentGithubDependencies} from '@/lib/tauri/releaseDeploymentTransportGithub';
import {deploymentPlanSchema,type DeploymentPlan,type DeploymentScope} from '@/lib/tauri/releaseDeploymentExecutionContract';
import {releaseOperationPlanId,type ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {parseReleaseOperationPlanInput,RELEASE_OPERATION_PLAN_KIND} from '@/lib/tauri/releaseOperationPlanContract';
import {parseDeploymentIntake} from '@/lib/tauri/deploymentIntakeSchema';
import {PROTECTED_TAG_POLICY} from '@/lib/tauri/releaseProtectedTagPolicy';
import {resolveReleaseInstallationToken,type ReleaseTokenPurpose} from '@/lib/connectors/github/githubAppAuth';

/** Explicit local composition for review. Existing HTTP routes do not install it.
 * No environment flag alone, owner connector, or ambient installation enables it. */
export function createReleaseDeploymentServices(request:NextRequest,repo:ReleaseOperationPlanRepo,scope:DeploymentScope,options:{observationOnly?:boolean;sourcePolicy?:'github_protected_tag_v1'|'github_immutable_release_v1';allowImmutableTagDispatch?:()=>boolean;actorPurpose?:'approver'|'executor';isEnabled?:()=>boolean;isPlanAllowed?:(plan:Readonly<DeploymentPlan>)=>boolean;fetch?:typeof fetch}={}){
 const serverFetch=options.fetch??fetch;
 const sourcePolicy=options.sourcePolicy??PROTECTED_TAG_POLICY;
 let immutableRequired=false;
 const enabled=()=>options.isEnabled?.()===true&&!request.signal.aborted;
 const authority=createReleaseDeploymentAuthority(request,{isEnabled:enabled,actorPurpose:options.actorPurpose,sourcePolicy,memoizeReadOnlyTransactionPlans:options.observationOnly===true});
 const governance=createGovernanceDeploymentApprovalComposition(request,repo as ReleaseOperationPlanRepo&AwsConnectionReadRepo,scope,enabled);
 const approvals=createReleaseDeploymentApprovalStore(repo,{assertCurrent:authority.assertCurrent,readCurrentPlan:authority.readCurrentPlan,assertGovernanceBaseline:governance.assertBaseline});
 const current=async(p:Readonly<DeploymentPlan>,signal:AbortSignal)=>{
  signal.throwIfAborted();if(!enabled()||options.isPlanAllowed&&!options.isPlanAllowed(p))throw Error('release_deployment_services_unavailable');
  await repo.$transaction(async tx=>{await authority.assertCurrent(tx,scope,p);await authority.readCurrentPlan(tx,scope,p)});
  signal.throwIfAborted();if(!enabled()||options.isPlanAllowed&&!options.isPlanAllowed(p))throw Error('release_deployment_services_unavailable');
 };
 const providerCurrent=async(p:Readonly<DeploymentPlan>,signal:AbortSignal)=>{
  const fresh=await repo.$transaction(async tx=>{signal.throwIfAborted();if(!enabled()||options.isPlanAllowed&&!options.isPlanAllowed(p))throw Error('release_deployment_services_unavailable');await authority.assertCurrent(tx,scope,p);await authority.readCurrentPlan(tx,scope,p);return captureCurrentDesktopSessionFreshness(tx,scope,signal)});fresh();return fresh;
 };
 let credentialStore:ReturnType<typeof createReleaseDeploymentExecutionStore>|undefined;
 const exposureBinding=(p:Readonly<DeploymentPlan>):ReleaseCredentialExposureBinding=>({purpose:'release_dispatch',repositoryFullName:p.repositoryFullName,connectionId:p.connectionId,githubInstallationId:p.installationId,connectionRevision:p.connectionRevision,planDigest:sha256ContentHash(p),sourceDigest:sha256ContentHash({sourcePolicy:p.sourcePolicy,sourceCommitSha:p.sourceCommitSha,workflowPath:p.workflowPath,workflowBlobSha:p.workflowBlobSha,refKind:p.refKind,ref:p.ref,inputsDigest:sha256ContentHash(p.inputs)})});
 async function claimedCurrentLocked(tx:Parameters<NonNullable<typeof credentialStore>['assertClaimedCredentialAuthority']>[0],p:Readonly<DeploymentPlan>,signal:AbortSignal,requireOpen:boolean){
  signal.throwIfAborted();if(!credentialStore||!enabled()||options.observationOnly||options.actorPurpose==='approver'||options.isPlanAllowed&&!options.isPlanAllowed(p))throw Error('release_deployment_credential_unavailable');
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(scope.organizationId)}))`;
  if(requireOpen){const barrier=await readEnrollmentDrainBarrierLocked(tx,scope.organizationId,signal);if(barrier&&barrier.status!=='aborted')throw Error('release_deployment_draining')}
  const claimedFresh=await credentialStore.assertClaimedCredentialAuthority(tx,scope,p),sessionFresh=await captureCurrentDesktopSessionFreshness(tx,scope,signal),cached=proofs.get(sha256ContentHash(p));
  const fresh=()=>{signal.throwIfAborted();if(!enabled()||!cached||cached.expiresAt<=Date.now()||options.isPlanAllowed&&!options.isPlanAllowed(p))throw Error('release_deployment_credential_unavailable');claimedFresh();sessionFresh()};fresh();return fresh;
 }
 async function claimedCurrent(p:Readonly<DeploymentPlan>,signal:AbortSignal){const fresh=await repo.$transaction(tx=>claimedCurrentLocked(tx,p,signal,true));fresh();return fresh}
 const issueCredential=async(raw:Readonly<DeploymentPlan>,signal:AbortSignal,purpose:ReleaseTokenPurpose)=>{
  const p=deploymentPlanSchema.parse(raw);await current(p,signal);
  const exposure=purpose==='dispatch'?createReleaseCredentialExposureStore(repo,{signal,assertCurrent:async(tx,s,b)=>{if(sha256ContentHash(s)!==sha256ContentHash(scope)||sha256ContentHash(b)!==sha256ContentHash(exposureBinding(p)))throw Error('release_deployment_credential_binding_changed');return claimedCurrentLocked(tx,p,signal,false)}}):undefined;
  const pending=exposure?await exposure.reserve(scope,exposureBinding(p),randomUUID()):undefined;
  const token=await resolveReleaseInstallationToken({installationId:p.installationId,repositoryFullName:p.repositoryFullName,purpose,isEnabled:enabled,assertCurrent:()=>purpose==='dispatch'?claimedCurrent(p,signal):providerCurrent(p,signal),fetch:serverFetch},signal);
  if(!token)return null;
  if(exposure&&pending)await exposure.finalize(scope,pending.id,token.expiresAt);
  const fresh=await(purpose==='dispatch'?claimedCurrent(p,signal):providerCurrent(p,signal));fresh();
  return {organizationId:p.organizationId,connectionId:p.connectionId,connectionRevision:p.connectionRevision,repositoryFullName:p.repositoryFullName,installationId:p.installationId,token:token.token,expiresAt:token.expiresAt,permissions:token.permissions};
 };
 // One exact request/operation/profile issuance. Install the private in-flight
 // promise before any work; null, rejection or lost acknowledgement never remints.
 const credentialAttempts=new Map<string,{signal:AbortSignal;promise:ReturnType<typeof issueCredential>}>();
 const credential=async(raw:Readonly<DeploymentPlan>,signal:AbortSignal,purpose:ReleaseTokenPurpose)=>{
  const p=deploymentPlanSchema.parse(raw);if(purpose!=='dispatch')return issueCredential(p,signal,purpose);
  const key=sha256ContentHash({scope,plan:p,purpose});let entry=credentialAttempts.get(key);
  if(!entry){entry={signal,promise:Promise.resolve().then(()=>issueCredential(p,signal,purpose))};credentialAttempts.set(key,entry)}
  const token=await entry.promise;signal.throwIfAborted();entry.signal.throwIfAborted();if(!token)return null;
  const fresh=await claimedCurrent(p,signal);entry.signal.throwIfAborted();if(token.expiresAt<=Date.now()+20000)throw Error('release_deployment_cached_credential_expired');fresh();return structuredClone(token);
 };
 const policy=(sourcePolicy===IMMUTABLE_RELEASE_POLICY?createImmutableReleasePolicyReader:createProtectedTagPolicyReader)({...options.observationOnly&&sourcePolicy===IMMUTABLE_RELEASE_POLICY?{readPurpose:'observation' as const}:{},isEnabled:enabled,assertCurrent:current,readCredential:(p,s)=>credential(p,s,'source_policy_read'),fetch:serverFetch,onRefusal:()=>{immutableRequired=true}});
 const readers=createReleaseDeploymentGithubReaders({isEnabled:enabled,assertCurrent:current,readCredential:(p,s)=>credential(p,s,'workflow_read'),fetch:serverFetch});
 const proofs=new Map<string,{proof:{kind:'verified_release_deployment_source_policy_v1';planDigest:string;sourcePolicy:string};expiresAt:number}>();
 const verifyPolicy=async(p:Readonly<DeploymentPlan>,signal:AbortSignal)=>{
  immutableRequired=false;
  const result=await policy(p,signal),digest=sha256ContentHash(p);if(!result||result.proof.planDigest!==digest||result.proof.sourcePolicy!==p.sourcePolicy)throw new ReleaseVerificationFailure('policy',immutableRequired);const expiresAt=Date.parse(result.evidence.expiresAt);if(!Number.isFinite(expiresAt)||expiresAt<=Date.now()||expiresAt>Date.now()+15000)throw Error('release_source_policy_unavailable');proofs.set(digest,{proof:result.proof,expiresAt});return result.proof;
 };
 const transportDependencies:ReleaseDeploymentGithubDependencies={allowImmutableTagDispatch:options.allowImmutableTagDispatch,isEnabled:()=>enabled()&&!options.observationOnly&&options.actorPurpose!=='approver',fetch:serverFetch,readWorkflowContract:readers.readWorkflowContract,verifyRunReceipt:readers.verifyRunReceipt,verifySourcePolicy:verifyPolicy,readCredential:async(p,signal)=>{
  const c=await credential(p,signal,'dispatch');if(!c)return null;
  const {permissions,...binding}=c;
  if(permissions.actions!=='write'||permissions.contents!=='read'||permissions.metadata!=='read')return null;
  return {...binding,actionsWrite:true,actionsRead:true};
 }};
 const transport=createReleaseDeploymentGithubTransport(transportDependencies);
 const executionGovernance=options.observationOnly||options.actorPurpose==='approver'?undefined:createReleaseDeploymentGovernanceCoordinator(request,repo,scope,{enabled,authority,approvals,service:governance.service,transport:transportDependencies,current,providerCurrent});
 const ports:ReleaseDeploymentServicePorts={enabled,...(executionGovernance?{governance:executionGovernance}:{}),transport:options.observationOnly||sourcePolicy===IMMUTABLE_RELEASE_POLICY&&!options.allowImmutableTagDispatch?.()?undefined:transport,preflight:async(p,signal)=>{await current(p,signal);await verifyPolicy(p,signal);if(!options.observationOnly)await governance.readBaseline(p,signal)},dependencies:{
  assertCurrent:authority.assertCurrent,
  assertCurrentForAdmission:async(tx,s,p,a)=>{
   if(!enabled()||options.observationOnly||options.actorPurpose==='approver'||options.isPlanAllowed&&!options.isPlanAllowed(p))throw Error('release_deployment_services_unavailable');
   const fresh=await authority.assertCurrentForAdmission(tx,s,p,a);
   return()=>{if(!enabled()||options.isPlanAllowed&&!options.isPlanAllowed(p))throw Error('release_deployment_services_unavailable');fresh()};
  },
  readCurrentPlan:authority.readCurrentPlan,
  // The observation store already checks authority and the exact locked plan
  // before/after this pure proof lookup. Repeating both here recursively
  // multiplies provenance reads until the fixed observation budget expires.
  // Execution retains its existing additional checks unchanged.
  verifySupportedSourcePolicy:async(tx,s,p)=>{if(!options.observationOnly){await authority.assertCurrent(tx,s,p);await authority.readCurrentPlan(tx,s,p)}const cached=proofs.get(sha256ContentHash(p));if(!enabled()||!cached||cached.expiresAt<=Date.now())throw Error('release_source_policy_preflight_required');return structuredClone(cached.proof)},
  readIndependentApproval:approvals.readIndependentApproval,
  consumeIndependentApproval:approvals.consumeIndependentApproval,
 },readPlan:async(s,reviewedPlan,signal)=>{
  if(options.observationOnly||options.actorPurpose==='approver'||sha256ContentHash(s)!==sha256ContentHash(scope)||!enabled())throw Error('release_deployment_identity_changed');
  const planId=releaseOperationPlanId(s.organizationId,reviewedPlan.requestId,reviewedPlan.requestVersion,sha256ContentHash(reviewedPlan));
  const selected=await repo.$transaction(async tx=>{
   const rows=await tx.durableAgentWorkflow.findMany({where:{organizationId:s.organizationId,workflowKind:RELEASE_DEPLOYMENT_APPROVAL_KIND,status:'paused_for_input',currentStep:'approved',AND:[{inputJson:{path:['plan','planId'],equals:planId}},{inputJson:{path:['plan','executorUserId'],equals:s.actorUserId}}]},orderBy:[{createdAt:'desc'}],take:2});
   if(rows.length!==1)throw Error('release_deployment_independent_approval_required');
   const raw=rows[0].inputJson;if(!raw||typeof raw!=='object'||Array.isArray(raw)||!('plan'in raw))throw Error('release_deployment_refresh_required');
   const p=deploymentPlanSchema.parse(raw.plan);
   if(p.planId!==planId||p.organizationId!==s.organizationId||p.executorUserId!==s.actorUserId)throw Error('release_deployment_refresh_required');
   signal.throwIfAborted();await authority.readCurrentPlan(tx,s,p);signal.throwIfAborted();return structuredClone(p);
  });
  const baselineDigest=await governance.readBaseline(selected,signal);
  await repo.$transaction(async tx=>{const approval=await approvals.readIndependentApproval(tx,s,selected);if(approval.governanceBaselineDigest!==baselineDigest)throw Error('release_deployment_baseline_review_required');await authority.readCurrentPlan(tx,s,selected)});
  await verifyPolicy(selected,signal);return selected;
 }};
 credentialStore=createReleaseDeploymentExecutionStore(repo,ports.dependencies);
 return {ports,
  async previewIndependentApproval(planId:string){
   if(options.observationOnly||!enabled()||!/^release_plan_[a-f0-9]{64}$/.test(planId))throw Error('release_deployment_refresh_required');
   const seed=await phase('authority',()=>repo.$transaction(async tx=>{
    const parent=await tx.durableAgentWorkflow.findFirst({where:{id:planId,organizationId:scope.organizationId,workflowKind:RELEASE_OPERATION_PLAN_KIND}});if(!parent)throw Error('release_deployment_refresh_required');
    const original=parseReleaseOperationPlanInput(parent.inputJson),merge=original.plan;
    const releases=await tx.$queryRaw<Array<{id:string;requesterUserId:string;intakeJson:unknown}>>`SELECT "id","requesterUserId","intakeJson" FROM "TauriDeploymentRequest" WHERE "id"=${merge.requestId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
    const connections=await tx.$queryRaw<Array<{githubInstallationId:string}>>`SELECT "githubInstallationId" FROM "GitHubInstallation" WHERE "id"=${merge.connectionId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
    if(releases.length!==1||connections.length!==1)throw Error('release_deployment_refresh_required');const release=releases[0],parsed=parseDeploymentIntake(release.intakeJson);if(!parsed.ok||!parsed.intake.workflowSource)throw Error('release_workflow_source_required');const intake=parsed.intake,source=intake.workflowSource!;
    // This placeholder is never approved, persisted or dispatched. The fixed tag
    // reader replaces it, then provider policy and workflow proof verify the result.
    const seed=deploymentPlanSchema.parse({purpose:'release_deployment',organizationId:scope.organizationId,releaseId:release.id,releaseVersion:merge.requestVersion,intakeDigest:merge.intakeDigest,planId,creatorUserId:parent.requestedByUserId,requesterUserId:release.requesterUserId,executorUserId:release.requesterUserId,repositoryFullName:source.repositoryFullName,connectionId:merge.connectionId,connectionRevision:merge.connectionRevision,installationId:connections[0].githubInstallationId,workflowPath:source.path,workflowBlobSha:source.blobSha,sourceCommitSha:'0'.repeat(40),refKind:'tag',ref:source.ref,inputs:intake.workflowInputs,sourcePolicy,windowStart:merge.window.startUtc,expiresAt:merge.window.endUtc});
    if(options.isPlanAllowed&&!options.isPlanAllowed(seed))throw Error('release_deployment_scope_unavailable');
   await authority.readCurrentPlan(tx,scope,seed);return seed;
   }));
   const sha=await phase('source',async()=>{const value=await readers.readSourceTag(seed,request.signal);if(!value)throw Error('unverified');return value});const plan=deploymentPlanSchema.parse({...seed,sourceCommitSha:sha});
   await phase('authority',()=>current(plan,request.signal));await phase('policy',()=>verifyPolicy(plan,request.signal));await phase('workflow',async()=>{if(!await readers.readWorkflowContract(plan,request.signal))throw Error('unverified')});await phase('authority',()=>current(plan,request.signal));
   const governanceBaselineDigest=await governance.readBaseline(plan,request.signal);
   return {...(governanceBaselineDigest?{governanceBaselineDigest}:{}),plan,planDigest:sha256ContentHash(plan),canApprove:![plan.creatorUserId,plan.requesterUserId,plan.executorUserId].includes(scope.actorUserId),executionAvailable:false as const};
  },
  async issueIndependentApproval(p:DeploymentPlan,clientRequestId:string,governanceBaselineDigest?:string){
   if(options.observationOnly)throw Error('release_observation_only');
   if(governanceBaselineDigest!==undefined&&!/^[a-f0-9]{64}$/.test(governanceBaselineDigest))throw Error('release_deployment_baseline_review_required');
   await current(p,request.signal);await verifyPolicy(p,request.signal);const actualBaseline=await governance.readBaseline(p,request.signal);
   if(actualBaseline!==governanceBaselineDigest)throw Error('release_deployment_baseline_review_required');
   return governanceBaselineDigest===undefined?approvals.issue(scope,p,clientRequestId):approvals.issue(scope,p,clientRequestId,governanceBaselineDigest);
  },
  revokeIndependentApproval:async(id:string,version:number)=>{if(options.observationOnly)throw Error('release_observation_only');return approvals.revoke(scope,id,version)},
  observeSourcePolicy:(p:DeploymentPlan)=>policy(p,request.signal),
 };
}
