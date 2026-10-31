import 'server-only';
import type {ReleaseOperationPlanTransaction as Tx} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {validateEvidenceEnvelope} from './freshness';
import type {EvidenceStoreScope} from './evidenceStore';
/** Connection binding only, not user authorization or freshness proof. Callers
 * must separately check current principal/roles and fresh source observations. */
export async function assertGovernanceEvidenceConnection(tx:Tx,scope:EvidenceStoreScope,raw:unknown){
 const e=validateEvidenceEnvelope(raw);if(e.organizationId!==scope.organizationId)throw Error('governance_source_scope_changed');
 if(e.source==='github'){
  if(e.selection.resourceId!=='github:repository:'+e.selection.repositoryId)throw Error('governance_connection_changed');
  const rows=await tx.$queryRaw<Array<{id:string;organizationId:string;githubInstallationId:string;updatedAt:Date;status:string;revokedAt:Date|null;suspendedAt:Date|null}>>`SELECT "id","organizationId","githubInstallationId","updatedAt","status","revokedAt","suspendedAt" FROM "GitHubInstallation" WHERE "id"=${e.connectionId} AND "organizationId"=${scope.organizationId} FOR SHARE`,c=rows[0];
  if(rows.length!==1||c.id!==e.connectionId||c.organizationId!==scope.organizationId||! /^[1-9][0-9]*$/.test(c.githubInstallationId)||c.status!=='active'||c.revokedAt||c.suspendedAt||c.updatedAt.toISOString()!==e.connectionRevision)throw Error('governance_connection_changed');return;
 }
 if(e.source==='aws'){
  const accounts=await tx.$queryRaw<Array<{id:string;organizationId:string;provider:string;externalAccountId:string;credentialRef:string;regions:string[];enabled:boolean;updatedAt:Date}>>`SELECT "id","organizationId","provider","externalAccountId","credentialRef","regions","enabled","updatedAt" FROM "CloudAccount" WHERE "id"=${e.connectionId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
  const credentials=await tx.$queryRaw<Array<{id:string;organizationId:string;version:number;revokedAt:Date|null}>>`SELECT "id","organizationId","version","revokedAt" FROM "CloudAccountCredential" WHERE "id"=${e.connectionId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
  const a=accounts[0],c=credentials[0],target=/^aws:account:(\d{12}):region:([a-z]{2}(?:-[a-z]+)+-\d)$/.exec(e.selection.resourceId);
  if(accounts.length!==1||credentials.length!==1||!target||a.id!==e.connectionId||a.organizationId!==scope.organizationId||a.provider!=='aws'||a.externalAccountId!==target[1]||!a.regions.includes(target[2])||!a.enabled||a.credentialRef!=='cloud-v2:'+a.id||c.id!==a.id||c.organizationId!==scope.organizationId||c.revokedAt||!Number.isSafeInteger(c.version)||c.version<1||sha256ContentHash({accountId:a.id,updatedAt:a.updatedAt.toISOString(),credentialVersion:c.version})!==e.connectionRevision)throw Error('governance_aws_connection_changed');return;
 }
 throw Error('governance_current_document_head_unavailable');
}
