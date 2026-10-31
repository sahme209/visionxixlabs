import 'server-only';
import type {NextRequest} from 'next/server';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {AwsConnectionReadRepo} from '@/lib/cloud/aws/enrollment/scopedConnection';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
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
  const accounts=await tx.$queryRaw<Array<{id:string;organizationId:string;provider:string;externalAccountId:string;credentialRef:string;regions:string[];enabled:boolean;updatedAt:Date}>>`SELECT "id","organizationId","provider","externalAccountId","credentialRef","regions","enabled","updatedAt" FROM "CloudAccount" WHERE "id"=${snapshot.connectionId} AND "organizationId"=${s.organizationId} FOR SHARE`;
  const credentials=await tx.$queryRaw<Array<{id:string;organizationId:string;version:number;revokedAt:Date|null}>>`SELECT "id","organizationId","version","revokedAt" FROM "CloudAccountCredential" WHERE "id"=${snapshot.connectionId} AND "organizationId"=${s.organizationId} FOR SHARE`;
  const a=accounts[0],c=credentials[0],target=/^aws:account:(\d{12}):region:([a-z]{2}(?:-[a-z]+)+-\d)$/.exec(snapshot.selection.resourceId);
  if(accounts.length!==1||credentials.length!==1||!target||a.id!==snapshot.connectionId||a.organizationId!==s.organizationId||a.provider!=='aws'||a.externalAccountId!==target[1]||!a.regions.includes(target[2])||!a.enabled||a.credentialRef!=='cloud-v2:'+a.id||c.id!==a.id||c.organizationId!==s.organizationId||c.revokedAt||!Number.isSafeInteger(c.version)||c.version<1||sha256ContentHash({accountId:a.id,updatedAt:a.updatedAt.toISOString(),credentialVersion:c.version})!==snapshot.connectionRevision)throw Error('governance_aws_connection_changed');
 }});
 const source=(s:EvidenceStoreScope)=>createAwsGovernanceDiscovery({scope:s,repo,assertActor:actor,isEnabled});
 const service=createGovernanceCollectionService({store,assertCurrent:actor,source});
 return{async observe(raw:unknown){const selection=discoverySelectionSchema.parse(raw);if(selection.source!=='aws')throw Error('governance_aws_source_required');await actor(scope,request.signal);return discoverEvidence(selection,source(scope),request.signal)},async collect(raw:unknown,nonce:string){if(options.revalidationOnly)throw Error('governance_collection_requires_administrator');const selection=discoverySelectionSchema.parse(raw);if(selection.source!=='aws')throw Error('governance_aws_source_required');return service.collect(scope,selection,nonce,request.signal)}};
}
