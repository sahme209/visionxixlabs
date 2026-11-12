import {randomUUID} from 'node:crypto';
import type {TokenCall,TokenRepository,TokenTransaction} from './customerHostedTokenStore';
import {customerHostedExposure} from './customerHostedTokenBudget';
interface Sql {
 $queryRawUnsafe<T=unknown>(sql:string,...values:unknown[]):Promise<T>;
 $executeRawUnsafe(sql:string,...values:unknown[]):Promise<number>;
}
export interface CustomerHostedSqlRepository {
 $transaction<T>(fn:(tx:Sql)=>Promise<T>,options:{isolationLevel:'ReadCommitted';timeout:number;maxWait:number}):Promise<T>;
}
const kind='customer_hosted_token_call_v1';
const keys=['id','organizationId','installationId','actorId','requestDigest','modelId','configDigest','windowId','reservedTokens','status','reportedTokens'];
function refuse():never{throw Error('customer_hosted_token_storage_unavailable');}
/** Persist only accounting bindings. Prompt/output text has no storage field. */
export function decodeCustomerHostedTokenRow(row:unknown,organizationId:string):TokenCall {
 if(!row||typeof row!=='object')refuse();
 const r=row as Record<string,unknown>,raw=r.stateJson;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))refuse();
 const b=raw as Record<string,unknown>;
 if(Object.keys(b).length!==keys.length||Object.keys(b).some(k=>!keys.includes(k)))refuse();
 if(b.organizationId!==organizationId||r.organizationId!==organizationId||b.id!==r.id||typeof b.id!=='string'||!/^customer_hosted_token_[a-f0-9]{64}$/.test(b.id))refuse();
 for(const key of ['organizationId','installationId','actorId','modelId','windowId'])if(typeof b[key]!=='string'||!(b[key] as string).length||(b[key] as string).length>256)refuse();
 for(const key of ['requestDigest','configDigest'])if(typeof b[key]!=='string'||!/^[a-f0-9]{64}$/.test(b[key] as string))refuse();
 const record=b as unknown as TokenCall;
 if(customerHostedExposure(record.windowId,[record])===null)refuse();
 return Object.freeze({...record});
}
/** Existing durable workflow/event storage, with TOKEN-specific workflow kind.
 * Rows are terminal scheduler records, never queued jobs. No schema/cents reuse.
 * ReadCommitted is intentional: reads after an awaited advisory lock must see
 * the preceding holder's committed reservations. Never retry automatically. */
export function createCustomerHostedTokenRepository(db:CustomerHostedSqlRepository):TokenRepository {
 return {transaction:fn=>db.$transaction(async sql=>{
  let locked:string|null=null;
  const tx:TokenTransaction={
   async now(){
    if(locked===null)refuse();
    const rows=await sql.$queryRawUnsafe<Array<{now:number}>>('SELECT floor(extract(epoch FROM clock_timestamp())*1000)::double precision AS now');
    if(rows.length!==1||!Number.isSafeInteger(rows[0].now))refuse();return rows[0].now;
   },
   async lock(org){
    if(locked!==null||!org||org.length>256)refuse();
    await sql.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))','axiom-customer-hosted-token:'+org);locked=org;
   },
   async read(org){
    if(locked!==org)refuse();
    const rows=await sql.$queryRawUnsafe<unknown[]>('SELECT id,"organizationId","stateJson" FROM "DurableAgentWorkflow" WHERE "organizationId"=$1 AND "workflowKind"=$2 ORDER BY id LIMIT 10001',org,kind);
    if(rows.length>10000)refuse();return rows.map(r=>decodeCustomerHostedTokenRow(r,org));
   },
   async insert(record){
    if(locked!==record.organizationId)refuse();decodeCustomerHostedTokenRow({id:record.id,organizationId:record.organizationId,stateJson:record},record.organizationId);
    await sql.$executeRawUnsafe('INSERT INTO "DurableAgentWorkflow" (id,"organizationId","workflowKind",objective,status,"autonomyLevel","inputJson","stateJson","requestedByUserId","maxAttempts",version,"updatedAt") VALUES ($1,$2,$3,\'Customer-hosted token accounting\',\'completed\',\'manual\',\'{}\'::jsonb,$4::jsonb,$5,1,0,clock_timestamp())',record.id,record.organizationId,kind,JSON.stringify(record),record.actorId);
    await event(record,0);
   },
   async replace(record){
    if(locked!==record.organizationId)refuse();decodeCustomerHostedTokenRow({id:record.id,organizationId:record.organizationId,stateJson:record},record.organizationId);
    const rows=await sql.$queryRawUnsafe<Array<{version:number}>>('UPDATE "DurableAgentWorkflow" SET "stateJson"=$1::jsonb,version=version+1,"updatedAt"=clock_timestamp() WHERE id=$2 AND "organizationId"=$3 AND "workflowKind"=$4 AND status=\'completed\' RETURNING version',JSON.stringify(record),record.id,record.organizationId,kind);
    if(rows.length!==1)refuse();await event(record,rows[0].version);
   },
  };
  async function event(record:TokenCall,sequence:number){
   await sql.$executeRawUnsafe('INSERT INTO "DurableAgentWorkflowEvent" (id,"workflowRunId","organizationId",sequence,"eventType","actorKind","actorId","detailJson") VALUES ($1,$2,$3,$4,$5,\'system\',$6,$7::jsonb)',randomUUID(),record.id,record.organizationId,sequence,'customer_hosted.'+record.status,record.actorId,JSON.stringify({settlement:'customer_hosted_unpriced',reservedTokens:record.reservedTokens,reportedTokens:record.reportedTokens}));
  }
  return fn(tx);
 },{isolationLevel:'ReadCommitted',timeout:10000,maxWait:5000})};
}
