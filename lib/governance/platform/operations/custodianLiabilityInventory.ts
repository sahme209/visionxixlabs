import 'server-only';
import {z} from 'zod';
export interface CustodianInventorySql{$queryRawUnsafe(sql:string):Promise<unknown>}
export interface CustodianInventoryDatabase{$transaction<T>(fn:(tx:CustodianInventorySql)=>Promise<T>,options:{isolationLevel:'ReadCommitted';timeout:number;maxWait:number}):Promise<T>}
import {readOperationalDelegation} from './delegationContract';
const row=z.object({actionId:z.string(),manifestDigest:z.string(),parentPlanDigest:z.string(),version:z.number().int(),stateJson:z.unknown()}).strict();
const fail=():never=>{throw Error('custodian_liability_inventory_unavailable')};
/** Private, read-only evidence of recorded attempts, NOT fleet completeness or
 * live credential validity. No default database, route, credential supplier,
 * close/reset/expiry cleanup or activation proof. Unknown legacy and expired
 * recorded credentials remain held; actual fleet/custody qualification is separate. */
export function createCustodianLiabilityInventory(db:CustodianInventoryDatabase){return Object.freeze({async read(){
 try{return await db.$transaction(async sql=>{
  const rows=await sql.$queryRawUnsafe('SELECT "actionId","manifestDigest","parentPlanDigest",version,"stateJson" FROM "PlatformOperationalDelegation" ORDER BY "actionId" LIMIT 129');
  if(!Array.isArray(rows)||rows.length>128)return fail();let budget=1048576;const seen=new Set<string>();
  const entries=rows.flatMap(raw=>{
   const bytes=Buffer.byteLength(JSON.stringify(raw),'utf8');budget-=bytes;if(bytes>131072||budget<0)return fail();
   const saved=row.parse(raw),state=readOperationalDelegation(saved.stateJson);
   if(saved.actionId!==state.actionId||saved.manifestDigest!==state.manifest.digest||saved.parentPlanDigest!==state.parentPlanDigest||saved.version!==state.version||seen.has(saved.actionId))return fail();seen.add(saved.actionId);
   if(state.credential.status==='not_requested')return [];
   const source=state.sourceCredential,result=state.credential;
   return [Object.freeze({actionId:state.actionId,manifestDigest:state.manifest.digest,issuerProfileDigest:state.manifest.issuerProfileDigest??null,sourceStatus:source?.status??'untracked_legacy',sourceLeaseRef:source?.status==='issued'?source.leaseRef:null,sourceExpiresAt:source?.status==='issued'?source.expiresAt:null,executionStatus:result.status,executionLeaseRef:result.status==='issued'?result.leaseRef:null,executionExpiresAt:result.status==='issued'?result.expiresAt:null,hold:true as const})];
  });
  return Object.freeze({entries:Object.freeze(entries),coverage:'recorded_platform_attempts_only' as const,activationAuthorized:false as const,credentialValidityChecked:false as const,closurePerformed:false as const});
 },{isolationLevel:'ReadCommitted',timeout:5000,maxWait:2000})}catch{return fail()}
}})}
