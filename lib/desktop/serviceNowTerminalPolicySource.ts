import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {serviceNowTerminalPolicySchema,type ServiceNowTerminalPolicy,type TicketReviewScope} from '@/lib/releaseops/ticketGovernanceReviewContract';
import type {ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {serviceNowNativeProcessSchema} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
export interface ServiceNowTerminalPolicySourcePorts {
 /** Receipt of a bounded fixed-API model read performed before taking store locks.
  * Closing fields/states remain administrator-declared policy, not API-discovered authority. */
 readModelReceipt?:(scope:TicketReviewScope,policy:Readonly<ServiceNowTerminalPolicy>)=>Promise<unknown>;
 now?:()=>number;
}
const modelReceiptSchema=z.object({organizationId:z.string(),connectionId:z.string(),connectionRevision:z.string().datetime(),instanceOrigin:z.string(),nativeProcess:serviceNowNativeProcessSchema,modelDigest:z.string().regex(/^[a-f0-9]{64}$/),observedAt:z.string().datetime()}).strict();
export function createServiceNowTerminalPolicyLockedSource(ports:ServiceNowTerminalPolicySourcePorts={}){
 return async(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,raw:ServiceNowTerminalPolicy)=>{
  if(!ports.readModelReceipt)throw Error('servicenow_terminal_policy_source_unavailable');
  const policy=serviceNowTerminalPolicySchema.parse(raw);if(policy.organizationId!==scope.organizationId)throw Error('servicenow_terminal_policy_changed');
  const rows=await tx.$queryRaw<Array<{id:string;organizationId:string;provider:string;status:string;revokedAt:Date|null;updatedAt:Date;externalAccountId:string|null;consentedByUserId:string|null}>>`SELECT "id","organizationId","provider","status","revokedAt","updatedAt","externalAccountId","consentedByUserId" FROM "TenantIntegrationConnection" WHERE "id"=${policy.connectionId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
  const connection=rows[0];if(rows.length!==1||connection.id!==policy.connectionId||connection.organizationId!==scope.organizationId||connection.provider!=='servicenow'||connection.status!=='active'||connection.revokedAt||connection.updatedAt.toISOString()!==policy.connectionRevision||connection.externalAccountId!==policy.instanceOrigin||connection.consentedByUserId!==policy.requesterUserId)throw Error('servicenow_terminal_policy_connection_changed');
  const receipt=modelReceiptSchema.parse(await ports.readModelReceipt(scope,policy)),now=(ports.now??Date.now)(),observed=Date.parse(receipt.observedAt);
  if(receipt.organizationId!==scope.organizationId||receipt.connectionId!==policy.connectionId||receipt.connectionRevision!==policy.connectionRevision||receipt.instanceOrigin!==policy.instanceOrigin||sha256ContentHash(receipt.nativeProcess)!==sha256ContentHash(policy.nativeProcess)||receipt.modelDigest!==policy.modelDigest||observed>now||now-observed>30000)throw Error('servicenow_terminal_policy_model_changed');
  return structuredClone(policy);
 };
}
