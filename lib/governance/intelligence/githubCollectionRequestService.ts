import 'server-only';
import type {NextRequest} from 'next/server';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction as Tx} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {createGovernanceRequestAuthority} from './requestAuthority';
import {createGovernanceEvidenceStore,type EvidenceStoreScope} from './evidenceStore';
import {createGithubGovernanceDiscovery} from './githubDiscovery';
import {createGovernanceCollectionService} from './collectionService';
import {discoverEvidence,discoverySelectionSchema} from './discovery';
import {assertGovernanceEvidenceConnection} from './sourceAuthority';
/** Request composition, deliberately not mounted or enabled by local approval.
 * Principal must come from the existing paired-session resolver, not JSON. */
export function createGithubGovernanceCollectionRequestService(request:NextRequest,repo:ReleaseOperationPlanRepo,scope:EvidenceStoreScope,isEnabled:()=>boolean,options:{revalidationOnly?:boolean}={}){
 const authority=createGovernanceRequestAuthority(request);
 async function actor(s:EvidenceStoreScope,signal:AbortSignal){if(!isEnabled()||s.organizationId!==scope.organizationId||s.actorUserId!==scope.actorUserId||s.sessionId!==scope.sessionId)throw Error('governance_collection_unavailable');signal.throwIfAborted();await repo.$transaction(tx=>authority(tx,s,options.revalidationOnly?'github_reader':'collector'));signal.throwIfAborted()}
 async function installation(tx:Tx,s:EvidenceStoreScope,id:string){const rows=await tx.$queryRaw<Array<{id:string;organizationId:string;githubInstallationId:string;updatedAt:Date;status:string;revokedAt:Date|null;suspendedAt:Date|null}>>`SELECT "id","organizationId","githubInstallationId","updatedAt","status","revokedAt","suspendedAt" FROM "GitHubInstallation" WHERE "id"=${id} AND "organizationId"=${s.organizationId} FOR SHARE`;if(rows.length!==1)throw Error('governance_connection_unavailable');return rows[0]}

 const store=createGovernanceEvidenceStore(repo,{assertCurrent:async(tx,s,role,snapshot)=>{if(!isEnabled())throw Error('governance_collection_unavailable');await authority(tx,s,role);if(role==='collector'){if(!snapshot)throw Error('governance_source_required');await assertGovernanceEvidenceConnection(tx,s,snapshot)}}});
 const source=(s:EvidenceStoreScope)=>createGithubGovernanceDiscovery({scope:s,isEnabled,assertActor:actor,readInstallation:(principal,id,signal)=>{signal.throwIfAborted();return repo.$transaction(tx=>installation(tx,principal,id))}});
 const service=createGovernanceCollectionService({store,assertCurrent:actor,source});
 return{async observe(raw:unknown){const selection=discoverySelectionSchema.parse(raw);if(selection.source!=='github')throw Error('governance_github_source_required');await actor(scope,request.signal);return discoverEvidence(selection,source(scope),request.signal)},async collect(raw:unknown,nonce:string){if(options.revalidationOnly)throw Error('governance_collection_requires_administrator');const selection=discoverySelectionSchema.parse(raw);if(selection.source!=='github')throw Error('governance_github_source_required');return service.collect(scope,selection,nonce,request.signal)}};
}
