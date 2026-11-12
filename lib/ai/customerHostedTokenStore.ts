import {createHash} from 'node:crypto';
import {customerHostedExposure,customerHostedReservationFits,customerHostedUsageLiability,type CustomerHostedTokenRecord} from './customerHostedTokenBudget';
export interface TokenRequest {
 readonly installationId:string;readonly organizationId:string;readonly actorId:string;
 readonly requestDigest:string;readonly modelId:string;readonly configDigest:string;
 readonly windowId:string;readonly reservedTokens:number;
}
export interface TokenCall extends TokenRequest,CustomerHostedTokenRecord {readonly id:string}
export interface TokenTransaction {
 lock(organizationId:string):Promise<void>;
 now():Promise<number>;
 /** All installations/windows for this organization; never filter unknown holds by expiry. */
 read(organizationId:string):Promise<readonly TokenCall[]>;
 insert(record:TokenCall):Promise<void>;
 replace(record:TokenCall):Promise<void>;
}
export interface TokenRepository {transaction<T>(fn:(tx:TokenTransaction)=>Promise<T>):Promise<T>}
export interface CurrentTokenBudget {readonly digest:string;readonly windowId:string;readonly limitTokens:number;readonly startsAt:number;readonly expiresAt:number}
function refuse():never{throw Error('customer_hosted_token_admission_unavailable');}
function valid(request:TokenRequest){
 for(const value of [request.installationId,request.organizationId,request.actorId,request.modelId,request.windowId])if(typeof value!=='string'||!value.length||value.length>256)refuse();
 for(const value of [request.requestDigest,request.configDigest])if(!/^[a-f0-9]{64}$/.test(value))refuse();
 if(!Number.isSafeInteger(request.reservedTokens)||request.reservedTokens<=0)refuse();
}
function idFor(request:TokenRequest){return 'customer_hosted_token_'+createHash('sha256').update(JSON.stringify([request.organizationId,request.requestDigest])).digest('hex');}
function same(a:TokenRequest,b:TokenRequest){return (['installationId','organizationId','actorId','requestDigest','modelId','configDigest','windowId','reservedTokens'] as const).every(k=>a[k]===b[k]);}
/** Internal accounting service. Callers still need qualified model bounds,
 * current actor/policy checks and a final one-use transport dispatch boundary. */
export function createCustomerHostedTokenStore(repository:TokenRepository,readCurrent:(organizationId:string)=>Promise<CurrentTokenBudget|null>){
 const claims=new WeakMap<object,TokenCall>();
 async function current(request:TokenRequest,tx:TokenTransaction){
  const budget=await readCurrent(request.organizationId),now=await tx.now();
  if(!budget||budget.digest!==request.configDigest||budget.windowId!==request.windowId||!Number.isSafeInteger(now)||!Number.isSafeInteger(budget.startsAt)||budget.startsAt>now||!Number.isSafeInteger(budget.expiresAt)||budget.expiresAt<=now)refuse();
  return budget;
 }
 return {
  async reserveCustomerHostedCall(request:TokenRequest):Promise<string>{
   valid(request);const bound=Object.freeze({...request}),id=idFor(bound);
   return repository.transaction(async tx=>{
    await tx.lock(bound.organizationId);
    const records=await tx.read(bound.organizationId),budget=await current(bound,tx);
    if(records.some(r=>r.organizationId!==bound.organizationId||r.id===id))refuse();
    const exposure=customerHostedExposure(bound.windowId,records);
    if(exposure===null||!customerHostedReservationFits(budget.limitTokens,exposure,bound.reservedTokens))refuse();
    await tx.insert({...bound,id,status:'reserved',reportedTokens:null});return id;
   });
  },
  async claimCustomerHostedCall(request:TokenRequest,id:string):Promise<object>{
   valid(request);const bound=Object.freeze({...request});
   const record=await repository.transaction(async tx=>{
    await tx.lock(bound.organizationId);
    const records=await tx.read(bound.organizationId),budget=await current(bound,tx),record=records.find(r=>r.id===id);
    if(records.some(r=>r.organizationId!==bound.organizationId)||!record||id!==idFor(bound)||!same(record,bound)||record.status!=='reserved')refuse();
    const exposure=customerHostedExposure(bound.windowId,records);
    if(exposure===null||!Number.isSafeInteger(budget.limitTokens)||budget.limitTokens<exposure)refuse();
    const claimed:TokenCall={...record,status:'dispatched'};await tx.replace(claimed);return claimed;
   });
   const claim=Object.freeze({});claims.set(claim,record);return claim;
  },
  async settleCustomerHostedCall(claim:object,reportedTokens:unknown,responseVerified=true){
   const record=claims.get(claim);if(!record)refuse();
   // Consume before awaits. A failed/unknown settlement keeps the dispatched
   // hold; it never grants permission to resend or retry settlement silently.
   claims.delete(claim);
   return repository.transaction(async tx=>{
    await tx.lock(record.organizationId);
    const rows=await tx.read(record.organizationId),stored=rows.find(r=>r.id===record.id);
    if(!stored||!same(stored,record)||stored.status!=='dispatched')refuse();
    const observed=customerHostedUsageLiability(record.reservedTokens,reportedTokens);
    const outcome=!responseVerified&&observed.status!=='overrun'?{status:'unknown' as const,liabilityTokens:record.reservedTokens}:observed;
    await tx.replace({...stored,status:outcome.status,reportedTokens:outcome.status==='unknown'?null:outcome.liabilityTokens});
    return outcome;
   });
  },
 };
}
