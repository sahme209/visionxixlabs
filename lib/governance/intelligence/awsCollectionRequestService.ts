import 'server-only';
import type {NextRequest} from 'next/server';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {AwsConnectionReadRepo} from '@/lib/cloud/aws/enrollment/scopedConnection';
import {assertGovernanceEvidenceConnection} from './sourceAuthority';
import {createGovernanceRequestAuthority} from './requestAuthority';
import {createGovernanceEvidenceStore,type EvidenceStoreScope} from './evidenceStore';
import {createAwsGovernanceDiscovery} from './awsDiscovery';
import {createGovernanceCollectionService} from './collectionService';
import {discoverEvidence,discoverySelectionSchema} from './discovery';
/** Local request composition. No route mounts it or enables discovery. The
 * principal comes only from the existing paired-session resolver. */
export function createAwsGovernanceCollectionRequestService(request:NextRequest,repo:ReleaseOperationPlanRepo&AwsConnectionReadRepo,scope:EvidenceStoreScope,isEnabled:()=>boolean,options:{revalidationOnly?:boolean}={}){
 const authority=createGovernanceRequestAuthority(request);
 async function actor(s:EvidenceStoreScope,signal:AbortSignal){if(!isEnabled()||s.organizationId!==scope.organizationId||s.actorUserId!==scope.actorUserId||s.sessionId!==scope.sessionId)throw Error('governance_collection_unavailable');signal.throwIfAborted();await repo.$transaction(tx=>authority(tx,s,options.revalidationOnly?'aws_reader':'collector'));signal.throwIfAborted()}
 const store=createGovernanceEvidenceStore(repo,{assertCurrent:async(tx,s,role,snapshot)=>{
  if(!isEnabled())throw Error('governance_collection_unavailable');await authority(tx,s,role);if(role!=='collector')return;
  if(!snapshot||snapshot.source!=='aws'||snapshot.organizationId!==s.organizationId)throw Error('governance_aws_source_required');
  await assertGovernanceEvidenceConnection(tx,s,snapshot);
 }});
 const source=(s:EvidenceStoreScope)=>createAwsGovernanceDiscovery({scope:s,repo,assertActor:actor,isEnabled});
 const service=createGovernanceCollectionService({store,assertCurrent:actor,source});
 return{async observe(raw:unknown){const selection=discoverySelectionSchema.parse(raw);if(selection.source!=='aws')throw Error('governance_aws_source_required');await actor(scope,request.signal);return discoverEvidence(selection,source(scope),request.signal)},async collect(raw:unknown,nonce:string){if(options.revalidationOnly)throw Error('governance_collection_requires_administrator');const selection=discoverySelectionSchema.parse(raw);if(selection.source!=='aws')throw Error('governance_aws_source_required');return service.collect(scope,selection,nonce,request.signal)}};
}
