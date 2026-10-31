import 'server-only';
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
import {compileBaseline,type EvidenceSnapshot} from './contracts';
/** Local request composition; no route or production flag activates it. Reads
 * bind existing paired authority. No executor coverage is invented here. */
export function createGovernanceRequestService(request:NextRequest,repo:ReleaseOperationPlanRepo&AwsConnectionReadRepo,scope:RevisionScope,isEnabled:()=>boolean){
 const authority=createGovernanceRequestAuthority(request),nonce=z.string().uuid();
 const enabled=()=>{request.signal.throwIfAborted();if(!isEnabled())throw Error('governance_intelligence_unavailable')};
 const bound=(s:RevisionScope)=>{enabled();if(s.organizationId!==scope.organizationId||s.actorUserId!==scope.actorUserId||s.sessionId!==scope.sessionId)throw Error('governance_request_scope_changed')};
 async function current(s:RevisionScope,signal:AbortSignal){bound(s);signal.throwIfAborted();await repo.$transaction(tx=>authority(tx,s,'reader'));signal.throwIfAborted()}
 const history=createGovernanceEvidenceStore(repo,{assertCurrent:async(tx,s,role)=>{bound(s);if(role!=='reader')throw Error('governance_history_read_only');await authority(tx,s,'reader')}});
 const github=createGithubGovernanceCollectionRequestService(request,repo,scope,isEnabled,{revalidationOnly:true}),aws=createAwsGovernanceCollectionRequestService(request,repo,scope,isEnabled,{revalidationOnly:true});
 async function readHistorical(s:RevisionScope,digest:string,signal:AbortSignal){await current(s,signal);return(await history.read(s,digest)).snapshot}
 async function readCurrent(s:RevisionScope,e:EvidenceSnapshot,signal:AbortSignal){await current(s,signal);const selection=discoverySelectionFromEvidence(e);return selection.source==='github'?github.observe(selection):aws.observe(selection)}
 const preflight=createGovernanceEvidencePreflight({assertCurrent:current,readHistorical,readCurrent,recheckLocked:async(tx,s,approved)=>{bound(s);await authority(tx,s,'reader');await assertGovernanceEvidenceConnection(tx,s,approved)}});
 const store=createGovernanceRevisionStore(repo,{
  assertCurrent:async(tx,s,actor,role)=>{bound(s);
   if(actor===s.actorUserId){await authority(tx,s,role);return}
   // Recheck another recorded principal's CURRENT membership, never adopt their
   // session or claim that the current requester is making their decision.
   await authority(tx,s,'reader');const rows=await tx.$queryRaw<Array<{organizationId:string;userId:string;role:string;acceptedAt:Date|null}>>`SELECT "organizationId","userId","role","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${s.organizationId} AND "userId"=${actor} FOR SHARE`,m=rows[0];
   const capability=role==='policy_admin'?'policy:manage':role==='approver'?'agent:approve':'workspace:read';
   if(rows.length!==1||m.organizationId!==s.organizationId||m.userId!==actor||!m.acceptedAt||!['owner','admin','operator','security_reviewer','finance_viewer','read_only'].includes(m.role)||!hasDesktopCapability(m.role as DesktopWorkspaceRole,capability))throw Error('governance_recorded_principal_unavailable');
  },verifyEvidence:async(tx,s,b)=>{await preflight.read(tx,s,b);return true},
  // Deliberately no verifyCoverage port. Unregistered executor seams cannot
  // enroll a scope, even if a baseline has genuine independent approval.
 });
 const baselines=createGovernanceBaselineService({store,preflight}),drift=createGovernanceDriftReader({assertCurrent:current,readHistorical,readCurrent});
 return{
  async listEvidence(){enabled();return history.list(scope)},
  async readRevision(id:string){enabled();return store.readRevision(scope,id)},
  async collect(raw:unknown,requestId:string){enabled();nonce.parse(requestId);const s=discoverySelectionSchema.parse(raw);return s.source==='github'?createGithubGovernanceCollectionRequestService(request,repo,scope,isEnabled).collect(s,requestId):createAwsGovernanceCollectionRequestService(request,repo,scope,isEnabled).collect(s,requestId)},
  async propose(raw:unknown,requestId:string){enabled();nonce.parse(requestId);const b=compileBaseline(raw);await repo.$transaction(tx=>authority(tx,scope,'policy_admin'));return baselines.propose(scope,b,requestId,request.signal)},
  async approve(id:string,version:number,digest:string,requestId:string){enabled();nonce.parse(requestId);await repo.$transaction(tx=>authority(tx,scope,'approver'));return baselines.approve(scope,id,version,digest,requestId,request.signal)},
  async revoke(id:string,version:number,requestId:string){enabled();nonce.parse(requestId);return store.revoke(scope,id,version,requestId)},
  async readDrift(id:string){enabled();const saved=await store.readRevision(scope,id);return drift.read(scope,saved.baseline,request.signal)},
  async activate(){enabled();throw Error('governance_execution_coverage_unavailable')},
 };
}
