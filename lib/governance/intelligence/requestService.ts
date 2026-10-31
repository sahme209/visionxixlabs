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
import type {AwsConnectionReadRepo} from '@/lib/cloud/aws/enrollment/scopedConnection';
import {hasDesktopCapability,type DesktopWorkspaceRole} from '@/lib/desktop/desktopAuthorization';
import {createGovernanceRequestAuthority} from './requestAuthority';
import {createGovernanceEvidenceStore} from './evidenceStore';
import {createGovernanceEvidencePreflight} from './evidencePreflight';
import {createGovernanceRevisionStore,type RevisionScope} from './revisionStore';
import {createGovernanceBaselineService} from './baselineService';
import {createGovernanceDriftReader} from './drift';
import {createGithubGovernanceCollectionRequestService} from './githubCollectionRequestService';
import {createAwsGovernanceCollectionRequestService} from './awsCollectionRequestService';
import {assertGovernanceEvidenceConnection} from './sourceAuthority';
import {discoverySelectionFromEvidence} from './evidenceSelection';
import {discoverySelectionSchema} from './discovery';
import {compileBaseline,scopeSchema,type EvidenceSnapshot} from './contracts';
/** Local request composition behind default-off, undeployed routes. Reads
 * bind existing paired authority. No executor coverage is invented here. */
export function createGovernanceRequestService(request:NextRequest,repo:ReleaseOperationPlanRepo&AwsConnectionReadRepo,scope:RevisionScope,isEnabled:()=>boolean){
 const authority=createGovernanceRequestAuthority(request),nonce=z.string().uuid();
 const enabled=()=>{request.signal.throwIfAborted();if(!isEnabled())throw Error('governance_intelligence_unavailable')};
 const bound=(s:RevisionScope)=>{enabled();if(s.organizationId!==scope.organizationId||s.actorUserId!==scope.actorUserId||s.sessionId!==scope.sessionId)throw Error('governance_request_scope_changed')};
 async function current(s:RevisionScope,signal:AbortSignal){bound(s);signal.throwIfAborted();await repo.$transaction(tx=>authority(tx,s,'reader'));signal.throwIfAborted()}
 // Enrollment metadata is a safety fence even when feature configuration is OFF.
 // This never grants discovery, policy evaluation, approval or execution.
 async function enrollmentReader(){request.signal.throwIfAborted();await repo.$transaction(tx=>authority(tx,scope,'reader'));request.signal.throwIfAborted()}
 const documentArtifacts=createGovernanceEvidenceStore(repo,{assertCurrent:async(tx,s,role,evidence)=>{bound(s);await authority(tx,s,role==='collector'?'policy_admin':'reader');if(evidence)await assertGovernanceEvidenceConnection(tx,s,evidence)}});
 const documents=createGovernanceDocumentStore(repo,{assertCurrent:async(tx,s,role)=>{bound(s);await authority(tx,s,role==='collector'?'policy_admin':'reader')},recordSnapshot:async(tx,s,snapshot,requestId,phase)=>phase==='recover'?documentArtifacts.read(s,snapshot.digest,tx):documentArtifacts.save(s,snapshot,requestId,tx)});
 const sourceDirectory=createGovernanceSourceDirectory(repo,{assertCurrent:async(tx,s)=>{bound(s);await authority(tx,s,'policy_admin')}});
 const history=createGovernanceEvidenceStore(repo,{assertCurrent:async(tx,s,role)=>{bound(s);if(role!=='reader')throw Error('governance_history_read_only');await authority(tx,s,'reader')}});
 const github=createGithubGovernanceCollectionRequestService(request,repo,scope,isEnabled,{revalidationOnly:true}),aws=createAwsGovernanceCollectionRequestService(request,repo,scope,isEnabled,{revalidationOnly:true});
 async function readHistorical(s:RevisionScope,digest:string,signal:AbortSignal){await current(s,signal);return(await history.read(s,digest)).snapshot}
 async function readCurrent(s:RevisionScope,e:EvidenceSnapshot,signal:AbortSignal){await current(s,signal);if(e.source==='document')return documents.observe(s,e);const selection=discoverySelectionFromEvidence(e);return selection.source==='github'?github.observe(selection):aws.observe(selection)}
 const preflight=createGovernanceEvidencePreflight({assertCurrent:current,readHistorical,readCurrent,recheckLocked:async(tx,s,approved)=>{bound(s);await authority(tx,s,'reader');await assertGovernanceEvidenceConnection(tx,s,approved)}});
 const activeProofs=new Map<string,Awaited<ReturnType<typeof preflight.read>>>();
 const store=createGovernanceRevisionStore(repo,{
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
 const baselines=createGovernanceBaselineService({store,preflight}),drift=createGovernanceDriftReader({assertCurrent:current,readHistorical,readCurrent});
 return{
  /** Paired source upload; its route is disabled by default and undeployed. */
  async uploadDocument(raw:unknown){enabled();const saved=await documents.upload(scope,raw);if(!saved.artifact)throw Error('governance_document_artifact_unavailable');return{...saved.artifact,headVersion:saved.headVersion}},
  async lookupCollectionRequest(requestId:string){enabled();nonce.parse(requestId);return history.lookupCollectionRequest(scope,requestId)},
  async lookupDocumentUpload(requestId:string){enabled();nonce.parse(requestId);return history.lookupDocumentUpload(scope,requestId)},
  async listCollectionSources(){enabled();return sourceDirectory.list(scope)},
  async hasAnyEnrollment(){
   await enrollmentReader();const rows=await repo.durableAgentWorkflow.findMany({where:{organizationId:scope.organizationId,OR:[{workflowKind:'governance_baseline_active_v1'},{id:{startsWith:'governance_active_'}}]},orderBy:[{id:'asc'}],take:1});
   if(rows.length>1||rows.some(row=>row.organizationId!==scope.organizationId||row.workflowKind!=='governance_baseline_active_v1'&&!row.id.startsWith('governance_active_')))throw Error('governance_enrollment_unavailable');await enrollmentReader();return rows.length===1;
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
  async readEvidence(digest:string){enabled();return history.read(scope,digest)},
  async listEvidence(){enabled();return history.list(scope)},
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
  async collect(raw:unknown,requestId:string){enabled();nonce.parse(requestId);const s=discoverySelectionSchema.parse(raw);return s.source==='github'?createGithubGovernanceCollectionRequestService(request,repo,scope,isEnabled).collect(s,requestId):createAwsGovernanceCollectionRequestService(request,repo,scope,isEnabled).collect(s,requestId)},
  async propose(raw:unknown,requestId:string){enabled();nonce.parse(requestId);const b=compileBaseline(raw);await repo.$transaction(tx=>authority(tx,scope,'policy_admin'));return baselines.propose(scope,b,requestId,request.signal)},
  async approve(id:string,version:number,digest:string,requestId:string){enabled();nonce.parse(requestId);await repo.$transaction(tx=>authority(tx,scope,'approver'));return baselines.approve(scope,id,version,digest,requestId,request.signal)},
  async revoke(id:string,version:number,requestId:string){enabled();nonce.parse(requestId);return store.revoke(scope,id,version,requestId)},
  async readDrift(id:string){enabled();const saved=await store.readRevision(scope,id);return drift.read(scope,saved.baseline,request.signal)},
  /** Internal composition only; not a public route or permission to execute. */
  async readActiveEvidence(rawSelection:unknown){
   enabled();const selection=scopeSchema.parse(rawSelection),candidate=await store.readActiveCandidate(scope,selection);activeProofs.delete(candidate.baseline.digest);
   await preflight.warm(scope,candidate.baseline,request.signal);
   const baseline=await store.readActive(scope,selection),proof=activeProofs.get(baseline.digest);
   if(baseline.digest!==candidate.baseline.digest||!proof||proof.expiresAt<=Date.now())throw Error('governance_active_evidence_unavailable');
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
  async activate(){enabled();throw Error('governance_execution_coverage_unavailable')},
 };
}
