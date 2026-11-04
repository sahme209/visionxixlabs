import {readGovernanceEnrollmentMetadata} from './enrollmentMetadata';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {GovernanceBaselineStale} from './errors';
import {governanceContextFromReviewedRelease} from './releaseScope';
import type {ProviderMergeScope} from '@/lib/tauri/releaseProviderMergeStore';
import type {ReleaseOperationPlan} from '@/lib/tauri/releaseOperationPlanContract';
import type {ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {createGovernanceSourceDirectory} from './sourceDirectory';
import 'server-only';
import {createGovernanceDocumentStore} from './documentStore';
import type {NextRequest} from 'next/server';
import {z} from 'zod';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {hasDesktopCapability,type DesktopWorkspaceRole} from '@/lib/desktop/desktopAuthorization';
import {createGovernanceEvidenceStore} from './evidenceStore';
import {createGovernanceEvidencePreflight} from './evidencePreflight';
import {createGovernanceRevisionStore,type RevisionScope} from './revisionStore';
import {createGovernanceBaselineService} from './baselineService';
import {createGovernanceDriftReader} from './drift';
import {assertGovernanceEvidenceConnection} from './sourceAuthority';
import {discoverySelectionFromEvidence} from './evidenceSelection';
import {discoverySelectionSchema} from './discovery';
import {compileBaseline,scopeSchema,type EvidenceSnapshot} from './contracts';
import type {createPrivateGovernanceRequestAuthority} from './requestAuthorityCore';
import type {createGovernanceExecutionPolicyRequestServiceCore} from './executionPolicyRequestServiceCore';
import type {createGithubGovernanceCollectionRequestServiceCore} from './githubCollectionRequestServiceCore';
export type GovernanceServiceDeploymentContext={store:ReturnType<typeof createGovernanceRevisionStore>;activeProofs:Map<string,Awaited<ReturnType<ReturnType<typeof createGovernanceEvidencePreflight>['read']>>>;bound:(s:RevisionScope)=>void};
export interface GovernanceRequestDependencies<D extends object>{
 authority:ReturnType<typeof createPrivateGovernanceRequestAuthority>;
 executionPolicies:ReturnType<typeof createGovernanceExecutionPolicyRequestServiceCore>;
 github:(revalidationOnly:boolean)=>ReturnType<typeof createGithubGovernanceCollectionRequestServiceCore>;
 aws:(revalidationOnly:boolean)=>ReturnType<typeof createGithubGovernanceCollectionRequestServiceCore>;
 assertSource:(e:Pick<EvidenceSnapshot,'source'>)=>void;
 now:()=>number;
 deployment:(context:GovernanceServiceDeploymentContext)=>D;
}
/** Local request composition behind default-off, undeployed routes. Reads
 * bind existing paired authority. No executor coverage is invented here. */
export function createGovernanceRequestServiceCore<D extends object>(request:NextRequest,repo:ReleaseOperationPlanRepo,scope:RevisionScope,isEnabled:()=>boolean,dependencies:GovernanceRequestDependencies<D>){
 const authority=dependencies.authority,nonce=z.string().uuid();
 const executionPolicies=dependencies.executionPolicies;
 const enabled=()=>{request.signal.throwIfAborted();if(!isEnabled())throw Error('governance_intelligence_unavailable')};
 const bound=(s:RevisionScope)=>{enabled();if(s.organizationId!==scope.organizationId||s.actorUserId!==scope.actorUserId||s.sessionId!==scope.sessionId)throw Error('governance_request_scope_changed')};
 async function current(s:RevisionScope,signal:AbortSignal){bound(s);signal.throwIfAborted();await repo.$transaction(tx=>authority(tx,s,'reader'));signal.throwIfAborted()}
 // Enrollment metadata is a safety fence even when feature configuration is OFF.
 // This never grants discovery, policy evaluation, approval or execution.
 async function enrollmentReader(){request.signal.throwIfAborted();await repo.$transaction(tx=>authority(tx,scope,'reader'));request.signal.throwIfAborted()}
 const documentArtifacts=createGovernanceEvidenceStore(repo,{now:()=>new Date(dependencies.now()),assertCurrent:async(tx,s,role,evidence)=>{bound(s);await authority(tx,s,role==='collector'?'policy_admin':'reader');if(evidence)await checkedConnection(tx,s,evidence)}});
 const documents=createGovernanceDocumentStore(repo,{now:()=>new Date(dependencies.now()),assertCurrent:async(tx,s,role)=>{bound(s);await authority(tx,s,role==='collector'?'policy_admin':'reader')},recordSnapshot:async(tx,s,snapshot,requestId,phase)=>phase==='recover'?documentArtifacts.read(s,snapshot.digest,tx):documentArtifacts.save(s,snapshot,requestId,tx)});
 const sourceDirectory=createGovernanceSourceDirectory(repo,{assertCurrent:async(tx,s)=>{bound(s);await authority(tx,s,'policy_admin')}});
 const history=createGovernanceEvidenceStore(repo,{now:()=>new Date(dependencies.now()),assertCurrent:async(tx,s,role,evidence)=>{bound(s);if(evidence)dependencies.assertSource(evidence);if(role!=='reader')throw Error('governance_history_read_only');await authority(tx,s,'reader')}});
 const github=dependencies.github(true),aws=dependencies.aws(true);
 async function readHistorical(s:RevisionScope,digest:string,signal:AbortSignal){await current(s,signal);const snapshot=(await history.read(s,digest)).snapshot;dependencies.assertSource(snapshot);return snapshot}
 async function readCurrent(s:RevisionScope,e:EvidenceSnapshot,signal:AbortSignal){await current(s,signal);dependencies.assertSource(e);if(e.source==='document')return documents.observe(s,e);const selection=discoverySelectionFromEvidence(e);return selection.source==='github'?github.observe(selection):aws.observe(selection)}
 const preflight=createGovernanceEvidencePreflight({now:dependencies.now,assertCurrent:current,readHistorical,readCurrent,recheckLocked:async(tx,s,approved)=>{bound(s);await authority(tx,s,'reader');await checkedConnection(tx,s,approved)}});
 async function checkedConnection(tx:ReleaseOperationPlanTransaction,s:RevisionScope,evidence:EvidenceSnapshot){dependencies.assertSource(evidence);await assertGovernanceEvidenceConnection(tx,s,evidence)}
 const activeProofs=new Map<string,Awaited<ReturnType<typeof preflight.read>>>();
 const store=createGovernanceRevisionStore(repo,{
  now:()=>new Date(dependencies.now()),
  assertCurrent:async(tx,s,actor,role)=>{bound(s);
   if(actor===s.actorUserId){await authority(tx,s,role);return}
   // Recheck another recorded principal's CURRENT membership, never adopt their
   // session or claim that the current requester is making their decision.
   await authority(tx,s,'reader');const rows=await tx.$queryRaw<Array<{organizationId:string;userId:string;role:string;acceptedAt:Date|null}>>`SELECT "organizationId","userId","role","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${s.organizationId} AND "userId"=${actor} FOR SHARE`,m=rows[0];
   const capability=role==='policy_admin'?'policy:manage':role==='approver'?'agent:approve':'workspace:read';
   if(rows.length!==1||m.organizationId!==s.organizationId||m.userId!==actor||!m.acceptedAt||!['owner','admin','operator','security_reviewer','finance_viewer','read_only'].includes(m.role)||!hasDesktopCapability(m.role as DesktopWorkspaceRole,capability))throw Error('governance_recorded_principal_unavailable');
  },verifyEvidence:async(tx,s,b)=>{const proof=await preflight.read(tx,s,b);activeProofs.set(b.digest,proof);return true},
  // Deliberately no verifyCoverage port. Unregistered executor seams cannot
  // enroll a scope, even if a baseline has genuine independent approval.
 });
 const baselines=createGovernanceBaselineService({store,preflight}),drift=createGovernanceDriftReader({now:dependencies.now,assertCurrent:current,readHistorical,readCurrent});
 return{
  /** Separate reviewed limits; does not enroll baseline scopes or dispatch. */
  executionPolicies,
  /** Paired source upload; its route is disabled by default and undeployed. */
  async uploadDocument(raw:unknown){enabled();const saved=await documents.upload(scope,raw);if(!saved.artifact)throw Error('governance_document_artifact_unavailable');return{...saved.artifact,headVersion:saved.headVersion}},
  async readDocumentHead(digest:string){
   enabled();return repo.$transaction(async tx=>{
    bound(scope);await authority(tx,scope,'reader');
    const artifact=await history.read(scope,digest,tx),head=await documents.readHeadMetadata(scope,artifact.snapshot,tx);
    bound(scope);await authority(tx,scope,'reader');request.signal.throwIfAborted();
    return{artifactId:artifact.id,artifactDigest:artifact.snapshot.digest,organizationId:scope.organizationId,...head};
   });
  },
  async lookupCollectionRequest(requestId:string){enabled();nonce.parse(requestId);return history.lookupCollectionRequest(scope,requestId)},
  async lookupDocumentUpload(requestId:string){enabled();nonce.parse(requestId);return history.lookupDocumentUpload(scope,requestId)},
  async listCollectionSources(){enabled();return sourceDirectory.list(scope)},
  async hasAnyEnrollment(){
   await enrollmentReader();const present=await readGovernanceEnrollmentMetadata(repo,scope.organizationId,request.signal);await enrollmentReader();return present;
  },
  /** Only a verified absent active pointer means legacy/non-enrolled. Any
   * malformed/inaccessible pointer refuses; never infer absence from failure. */
  async readScopeEnrollment(rawSelection:unknown){
   const selection=scopeSchema.parse(rawSelection);await enrollmentReader();const id='governance_active_'+sha256ContentHash({organizationId:scope.organizationId,scope:selection});
   // Exact tenant-derived primary key; inspect a conflicting malformed row as
   // unavailable rather than masking it as an absent enrollment.
   const row=await repo.durableAgentWorkflow.findFirst({where:{id}});
   if(!row){await enrollmentReader();return{enrolled:false as const}}
   if(row.id!==id||row.organizationId!==scope.organizationId||row.workflowKind!=='governance_baseline_active_v1')throw Error('governance_enrollment_unavailable');enabled();const candidate=await store.readActiveCandidate(scope,selection);await current(scope,request.signal);return{enrolled:true as const,baselineDigest:candidate.baseline.digest};
  },
  /** DB-only organization-wide absence for legacy scopes with no canonical
   * environment mapping. Shares activation's organization lock; no feature
   * enablement, source reads or policy authority is granted by this metadata. */
  async readAnyEnrollmentLocked(tx:ReleaseOperationPlanTransaction){
   request.signal.throwIfAborted();await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(scope.organizationId)}))`;
   await authority(tx,scope,'reader');const present=await readGovernanceEnrollmentMetadata(tx,scope.organizationId,request.signal);await authority(tx,scope,'reader');request.signal.throwIfAborted();return present;
  },
  /** Internal DB-only dispatch check. The organization advisory lock is the
   * same lock used by activation/revocation, so positive absence cannot race a
   * newly created pointer inside this transaction. No source warm-up occurs. */
  async readScopeEnrollmentLocked(tx:ReleaseOperationPlanTransaction,rawSelection:unknown){
   const selection=scopeSchema.parse(rawSelection);request.signal.throwIfAborted();
   await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(scope.organizationId)}))`;
   await authority(tx,scope,'reader');const id='governance_active_'+sha256ContentHash({organizationId:scope.organizationId,scope:selection});
   const row=await tx.durableAgentWorkflow.findFirst({where:{id}});
   if(!row){await authority(tx,scope,'reader');request.signal.throwIfAborted();return{enrolled:false as const}}
   if(row.id!==id||row.organizationId!==scope.organizationId||row.workflowKind!=='governance_baseline_active_v1')throw Error('governance_enrollment_unavailable');
   enabled();const baseline=await store.readActive(scope,selection,tx),proof=activeProofs.get(baseline.digest),at=dependencies.now();
   if(!proof||!Number.isFinite(at)||proof.expiresAt<=at)throw new GovernanceBaselineStale('source_receipt_unavailable');
   request.signal.throwIfAborted();return{enrolled:true as const,baselineDigest:baseline.digest,evidenceExpiresAt:proof.expiresAt};
  },
  /** No complete executor manifest is registered. Limits and exact approval
   * cannot turn an uncovered scope into execution coverage. */
  async readExecutionCoverage(selection:unknown){
   const enrollment=await this.readScopeEnrollment(selection);
   return{enrolled:enrollment.enrolled,coveredActions:[] as string[]};
  },
  async readEvidence(digest:string){enabled();return history.read(scope,digest)},
  async listEvidence(){enabled();const result=await history.list(scope);for(const item of result.items)dependencies.assertSource(item);return result},
  async listRevisions(){
   await current(scope,request.signal);
   const rows=await repo.durableAgentWorkflow.findMany({where:{organizationId:scope.organizationId,workflowKind:'governance_baseline_revision_v1'},orderBy:[{createdAt:'desc'},{id:'desc'}],take:21}),items=[];
   for(const row of rows.slice(0,20)){
    request.signal.throwIfAborted();const saved=await store.readRevision(scope,row.id);
    items.push({id:saved.id,version:saved.version,status:saved.status,digest:saved.baseline.digest,requesterUserId:saved.requesterUserId,createdAt:row.createdAt.toISOString(),scopes:saved.baseline.scopes,ruleCount:saved.baseline.rules.length});
   }
   await current(scope,request.signal);return{items,truncated:rows.length>20};
  },
  async readRevision(id:string){enabled();return store.readRevision(scope,id)},
  async collect(raw:unknown,requestId:string){enabled();nonce.parse(requestId);const s=discoverySelectionSchema.parse(raw);return s.source==='github'?dependencies.github(false).collect(s,requestId):dependencies.aws(false).collect(s,requestId)},
  async propose(raw:unknown,requestId:string){enabled();nonce.parse(requestId);const b=compileBaseline(raw);await repo.$transaction(tx=>authority(tx,scope,'policy_admin'));return baselines.propose(scope,b,requestId,request.signal)},
  async approve(id:string,version:number,digest:string,requestId:string){enabled();nonce.parse(requestId);await repo.$transaction(tx=>authority(tx,scope,'approver'));return baselines.approve(scope,id,version,digest,requestId,request.signal)},
  async revoke(id:string,version:number,requestId:string){enabled();nonce.parse(requestId);return store.revoke(scope,id,version,requestId)},
  async readDrift(id:string){enabled();const saved=await store.readRevision(scope,id);return drift.read(scope,saved.baseline,request.signal)},
  /** Internal composition only; not a public route or permission to execute. */
  async readActiveEvidence(rawSelection:unknown){
   enabled();const selection=scopeSchema.parse(rawSelection),candidate=await store.readActiveCandidate(scope,selection);activeProofs.delete(candidate.baseline.digest);
   await preflight.warm(scope,candidate.baseline,request.signal);
   const baseline=await store.readActive(scope,selection),proof=activeProofs.get(baseline.digest);
   if(baseline.digest!==candidate.baseline.digest||!proof||proof.expiresAt<=dependencies.now())throw Error('governance_active_evidence_unavailable');
   request.signal.throwIfAborted();return{baseline,...structuredClone(proof),executionAuthorized:false as const};
  },
  /** Locked, DB-only verification for a separately reviewed exact merge
   * approval. A prior out-of-lock active evidence warm-up is mandatory. */
  async assertMergeApprovalBaseline(tx:ReleaseOperationPlanTransaction,rawScope:ProviderMergeScope,expectedDigest:string,plan:ReleaseOperationPlan){
   bound(rawScope);if(!/^[a-f0-9]{64}$/.test(expectedDigest)||plan.organizationId!==scope.organizationId)throw Error('governance_merge_baseline_unavailable');
   const rows=await tx.$queryRaw<Array<{id:string;organizationId:string;version:number;status:string;intakeJson:unknown}>>`SELECT "id","organizationId","version","status","intakeJson" FROM "TauriDeploymentRequest" WHERE "id"=${plan.requestId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
   if(rows.length!==1)throw Error('governance_merge_baseline_unavailable');const context=governanceContextFromReviewedRelease({scope,row:rows[0],plan}),baseline=await store.readActive(scope,context.scope,tx);
   if(baseline.digest!==expectedDigest)throw new GovernanceBaselineStale('baseline_changed');bound(rawScope);
  },
  // Legacy deployment composition remains outside the private merge graph.
  ...dependencies.deployment({store,activeProofs,bound}),
  async activate(){enabled();throw Error('governance_execution_coverage_unavailable')},
 };
}
