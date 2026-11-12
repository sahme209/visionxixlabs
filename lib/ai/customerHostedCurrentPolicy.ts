import {createHash} from 'node:crypto';
import {activeCustomerHostedBudget,parseCustomerHostedOperatorConfig,readInstallationAIMode,type CustomerHostedOperatorConfig} from './customerHostedConfig';
import {readAcceptedCustomerHostedLimits} from './customerHostedLimitSupplier';
import {normalizeStoredWorkspaceAIProviderPolicy} from './workspaceProviderPolicy';
import type {CustomerHostedExtractionSnapshot} from './customerHostedExtraction';
interface Dependencies {
 db:{$queryRawUnsafe(sql:string,...values:unknown[]):Promise<unknown>};
 readConfig?:()=>CustomerHostedOperatorConfig|null;
 readLimits?:typeof readAcceptedCustomerHostedLimits;
}
export interface CurrentCustomerHostedSnapshot extends CustomerHostedExtractionSnapshot {readonly budgetLimitTokens:number;readonly expiresAt:number}
function fail():never{throw Error('customer_hosted_current_policy_unavailable')}
function offline(){if(readInstallationAIMode(process.env.AXIOM_OFFLINE_MODE)!=='offline')fail()}
/** One joined query rechecks current accepted membership and workspace opt-in.
 * Never construct a Gateway manager/catalog or consult dollar credits here. */
export function createCustomerHostedCurrentReader(scope:{organizationId:string;actorId:string;preferredProvider?:string;preferredModel?:string},deps:Dependencies){
 const readConfig=deps.readConfig??(()=>parseCustomerHostedOperatorConfig(process.env.AXIOM_LOCAL_MODEL_CONFIG));
 const readLimits=deps.readLimits??readAcceptedCustomerHostedLimits;
 async function policy(){
  const rows=await deps.db.$queryRawUnsafe('SELECT p.enabled,p."allowedProviders",p."modelSelections",p."fallbackOrder",floor(extract(epoch FROM clock_timestamp())*1000)::double precision AS now FROM "OrganizationAIProviderPolicy" p JOIN "OrgMembership" m ON m."organizationId"=p."organizationId" WHERE p."organizationId"=$1 AND m."userId"=$2 AND m."acceptedAt" IS NOT NULL LIMIT 2',scope.organizationId,scope.actorId);
  if(!Array.isArray(rows)||rows.length!==1||!rows[0]||typeof rows[0]!=='object')fail();
  const row=rows[0] as Record<string,unknown>;
  if(!Number.isSafeInteger(row.now)||Number(row.now)<0||row.enabled!==true||JSON.stringify(row.allowedProviders)!=='["customer_hosted"]'||!['[]','["customer_hosted"]'].includes(JSON.stringify(row.fallbackOrder)))fail();
  const parsed=normalizeStoredWorkspaceAIProviderPolicy({enabled:row.enabled,allowedProviders:row.allowedProviders,modelSelections:row.modelSelections,fallbackOrder:row.fallbackOrder});
  const modelId=parsed?.modelSelections.customer_hosted;
  if(!parsed||!modelId||scope.preferredModel!==undefined&&scope.preferredModel!==modelId)fail();
  return {modelId,now:row.now as number,digest:createHash('sha256').update(JSON.stringify(parsed)).digest('hex')};
 }
 return async():Promise<CurrentCustomerHostedSnapshot>=>{
  offline();
  if(!scope.organizationId||scope.organizationId.length>200||!scope.actorId||scope.actorId.length>200||scope.preferredProvider!==undefined&&scope.preferredProvider!=='customer_hosted')fail();
  const config=readConfig();if(!config)fail();
  const initial=await policy();if(!config.models.some(m=>m.id===initial.modelId))fail();
  const accepted=await readLimits(config,initial.modelId,initial.now);if(!accepted)fail();
  if(readConfig()?.digest!==config.digest)fail();
  // Evidence IO is awaited BEFORE the final joined actor/policy/database-clock
  // read, preventing a revoked member's earlier result from becoming authority.
  const final=await policy();offline();
  if(readConfig()?.digest!==config.digest||final.digest!==initial.digest||final.modelId!==initial.modelId||accepted.expiresAt<=final.now)fail();
  const budget=activeCustomerHostedBudget(config,scope.organizationId,final.now),model=config.models.find(m=>m.id===final.modelId);
  if(!budget||!model||accepted.reservedTokens!==model.maxInputTokens+model.maxOutputTokens)fail();
  return Object.freeze({config,modelId:final.modelId,policyDigest:createHash('sha256').update(JSON.stringify([final.digest,accepted.evidenceSha256,accepted.expiresAt])).digest('hex'),windowId:budget.windowId,reservedTokens:accepted.reservedTokens,budgetLimitTokens:budget.limitTokens,expiresAt:Math.min(accepted.expiresAt,Date.parse(budget.expiresAt))});
 };
}
