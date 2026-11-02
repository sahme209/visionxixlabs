import 'server-only';
import {z} from 'zod';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction as Tx,ReleaseOperationPlanRow as Row} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {identifier,digestSchema} from './contracts';
import type {RevisionScope} from './revisionStore';
import {readGovernanceEnrollmentMetadata} from './enrollmentMetadata';
const KIND='native_git_credential_lease_v1',PREFIX='native_git_credential_lease_';
const scopeSchema=z.object({organizationId:identifier,actorUserId:identifier,sessionId:identifier}).strict();
const branchSchema=z.string().min(1).max(255).refine(v=>v!=='@'&&!/[\s\x00-\x1f\x7f~^:?*\[\\]/.test(v)&&!v.startsWith('/')&&!v.endsWith('/')&&!v.endsWith('.')&&!v.includes('..')&&!v.includes('@{')&&!v.includes('//')&&!v.split('/').some(p=>p.startsWith('.')||p.endsWith('.lock')));
export const nativeGitCredentialLeaseBindingSchema=z.object({repositoryFullName:z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/).max(240),branch:branchSchema,connectionId:identifier,githubInstallationId:z.string().regex(/^[1-9][0-9]{0,19}$/),connectionRevision:z.string().datetime()}).strict();
export type NativeGitCredentialLeaseBinding=z.infer<typeof nativeGitCredentialLeaseBindingSchema>;
const expirySchema=z.number().finite().int().safe().min(1).max(8640000000000000);
const inputSchema=z.object({format:z.literal(1),protocol:z.literal('native_git_push_credential_lease_v1'),purpose:z.literal('push'),scope:scopeSchema,binding:nativeGitCredentialLeaseBindingSchema,serverNonce:z.string().uuid(),createdAt:z.string().datetime()}).strict();
const stateSchema=z.discriminatedUnion('status',[z.object({status:z.literal('pending')}).strict(),z.object({status:z.literal('issued'),providerExpiresAt:expirySchema}).strict()]);
const metadataSchema=z.discriminatedUnion('status',[z.object({id:z.string().regex(/^native_git_credential_lease_[a-f0-9]{64}$/),version:z.literal(0),status:z.literal('pending')}).strict(),z.object({id:z.string().regex(/^native_git_credential_lease_[a-f0-9]{64}$/),version:z.literal(1),status:z.literal('issued'),providerExpiresAt:expirySchema}).strict()]);
export type NativeGitCredentialLeaseMetadata=z.infer<typeof metadataSchema>;
const unavailable=():never=>{throw Error('native_git_credential_lease_unavailable')};
const same=(a:unknown,b:unknown)=>hash(a)===hash(b);
const leaseId=(org:string,nonce:string)=>PREFIX+hash({organizationId:org,serverNonce:nonce});
async function lock(tx:Tx,org:string){await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+hash(org)}))`}
function appClock(now?:()=>Date){const value=(now?.()??new Date()).getTime();if(!Number.isFinite(value))unavailable();return value}
async function databaseClock(tx:Tx){const rows=await tx.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() AS "now"`;if(rows.length!==1||!(rows[0].now instanceof Date)||!Number.isFinite(rows[0].now.getTime()))unavailable();return rows[0].now.getTime()}
function unpack(row:Row){
 const input=inputSchema.parse(row.inputJson),state=stateSchema.parse(row.stateJson),issued=state.status==='issued';
 if(row.id!==leaseId(input.scope.organizationId,input.serverNonce)||row.organizationId!==input.scope.organizationId||row.workflowKind!==KIND||row.requestedByUserId!==input.scope.actorUserId||(row as Row&{autonomyLevel?:unknown}).autonomyLevel!=='observe'||row.status!==(issued?'completed':'paused_for_input')||row.currentStep!==state.status||row.version!==(issued?1:0)||row.attemptCount!==0||row.maxAttempts!==1||row.leaseOwner||row.leaseExpiresAt||row.approvalProposalId||row.createdAt.toISOString()!==input.createdAt||!Number.isFinite(row.updatedAt.getTime())||row.updatedAt<row.createdAt||issued&&state.providerExpiresAt<=row.updatedAt.getTime())unavailable();
 return{input,state};
}
async function history(tx:Tx,row:Row){
 const {input,state}=unpack(row),events=await tx.durableAgentWorkflowEvent.findMany({where:{organizationId:row.organizationId,workflowRunId:row.id},orderBy:{sequence:'asc'},take:3});
 if(events.length!==row.version+1)unavailable();let previous:string|null=null;
 for(let n=0;n<events.length;n++){
  const event=events[n],detail=z.object({inputDigest:digestSchema,stateDigest:digestSchema,previousStateDigest:digestSchema.nullable(),expectedVersion:z.number().int().nullable(),state:stateSchema}).strict().parse(event.detailJson),expected=n===0?{status:'pending'}:state;
  if(event.organizationId!==row.organizationId||event.workflowRunId!==row.id||event.sequence!==n||event.actorKind!=='user'||event.actorId!==input.scope.actorUserId||event.eventType!==KIND+(n?'.issued':'.reserved')||detail.inputDigest!==hash(input)||!same(detail.state,expected)||detail.stateDigest!==hash(detail.state)||detail.previousStateDigest!==previous||detail.expectedVersion!==(n?0:null)||!Number.isFinite(event.occurredAt.getTime())||event.occurredAt<row.createdAt||n===0&&event.occurredAt.getTime()!==row.createdAt.getTime()||n>0&&event.occurredAt<events[n-1].occurredAt||n===row.version&&event.occurredAt.getTime()!==row.updatedAt.getTime())unavailable();previous=detail.stateDigest;
 }
 return{input,state};
}
async function event(tx:Tx,row:Row,prior:unknown|null){const{input,state}=unpack(row);await tx.durableAgentWorkflowEvent.create({data:{organizationId:row.organizationId,workflowRunId:row.id,sequence:row.version,eventType:KIND+(row.version?'.issued':'.reserved'),actorKind:'user',actorId:input.scope.actorUserId,detailJson:{inputDigest:hash(input),stateDigest:hash(state),previousStateDigest:prior===null?null:hash(prior),expectedVersion:row.version?0:null,state},occurredAt:row.updatedAt}})}
const metadata=(row:Row)=>{const{state}=unpack(row);return metadataSchema.parse({id:row.id,version:row.version,...state})};
/** A reservation precedes token resolution outside locks; uncertain results stay
 * pending. Neither metadata nor empty history qualifies older issuer runtimes.
 * This store never mints, stores, revokes or renews a provider credential. */
export function createNativeGitCredentialLeaseStore(repo:ReleaseOperationPlanRepo,deps:{assertCurrent(tx:Tx,scope:RevisionScope,binding:NativeGitCredentialLeaseBinding):Promise<()=>void>;signal:AbortSignal;now?:()=>Date}){
 const ready=()=>{deps.signal.throwIfAborted();if(typeof deps.assertCurrent!=='function')unavailable();appClock(deps.now)};
 async function current(tx:Tx,s:RevisionScope,b:NativeGitCredentialLeaseBinding){ready();const fresh=await deps.assertCurrent(tx,structuredClone(s),structuredClone(b));if(typeof fresh!=='function')unavailable();ready();fresh();return()=>{ready();fresh();ready()}}
 async function absent(tx:Tx,org:string){ready();if(await readGovernanceEnrollmentMetadata(tx,org,deps.signal)!==false)unavailable();ready()}
 return{
  async reserve(rawScope:RevisionScope,rawBinding:NativeGitCredentialLeaseBinding,serverNonce:string):Promise<NativeGitCredentialLeaseMetadata>{try{
   const scope=scopeSchema.parse(rawScope),binding=nativeGitCredentialLeaseBindingSchema.parse(rawBinding),nonce=z.string().uuid().parse(serverNonce),id=leaseId(scope.organizationId,nonce);ready();
   return await repo.$transaction(async tx=>{await lock(tx,scope.organizationId);await current(tx,scope,binding);await absent(tx,scope.organizationId);
    if(await tx.durableAgentWorkflow.findFirst({where:{id}}))unavailable();const at=new Date(appClock(deps.now)),input=inputSchema.parse({format:1,protocol:'native_git_push_credential_lease_v1',purpose:'push',scope,binding,serverNonce:nonce,createdAt:at.toISOString()});
    const row=await tx.durableAgentWorkflow.create({data:{id,organizationId:scope.organizationId,workflowKind:KIND,objective:'Native Git push credential lifetime metadata; no token',requestedByUserId:scope.actorUserId,autonomyLevel:'observe',status:'paused_for_input',currentStep:'pending',inputJson:input,stateJson:{status:'pending'},attemptCount:0,maxAttempts:1,version:0,leaseOwner:null,leaseExpiresAt:null,approvalProposalId:null,createdAt:at,updatedAt:at}});
    await event(tx,row,null);const finalFresh=await current(tx,scope,binding);await absent(tx,scope.organizationId);const dbAt=await databaseClock(tx);ready();finalFresh();if(dbAt<at.getTime())unavailable();return metadata(row);
   });
  }catch{return unavailable()}},
  async finalize(rawScope:RevisionScope,id:string,providerExpiresAt:number):Promise<NativeGitCredentialLeaseMetadata>{try{
   const scope=scopeSchema.parse(rawScope),expiry=expirySchema.parse(providerExpiresAt);if(!/^native_git_credential_lease_[a-f0-9]{64}$/.test(id))unavailable();ready();if(expiry<=appClock(deps.now))unavailable();
   return await repo.$transaction(async tx=>{await lock(tx,scope.organizationId);const rows=await tx.$queryRaw<Row[]>`SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${id} FOR UPDATE`;if(rows.length!==1)unavailable();const row=rows[0],{input,state}=await history(tx,row);
    if(!same(input.scope,scope)||row.organizationId!==scope.organizationId||state.status!=='pending'||row.version!==0)unavailable();await current(tx,scope,input.binding);await absent(tx,scope.organizationId);
    const at=new Date(appClock(deps.now));if(expiry<=at.getTime()||at<row.updatedAt)unavailable();const nextState=stateSchema.parse({status:'issued',providerExpiresAt:expiry});
    const result=await tx.durableAgentWorkflow.updateMany({where:{id,organizationId:scope.organizationId,workflowKind:KIND,version:0,currentStep:'pending',status:'paused_for_input',attemptCount:0,maxAttempts:1,inputJson:{equals:row.inputJson as never},stateJson:{equals:row.stateJson as never}},data:{version:{increment:1},currentStep:'issued',status:'completed',stateJson:nextState,updatedAt:at}});if(result.count!==1)unavailable();
    const next={...row,version:1,currentStep:'issued',status:'completed',stateJson:nextState,updatedAt:at};await event(tx,next,state);const finalFresh=await current(tx,scope,input.binding);await absent(tx,scope.organizationId);
    const dbAt=await databaseClock(tx);ready();finalFresh();if(expiry<=dbAt||expiry<=appClock(deps.now)||dbAt<at.getTime())unavailable();return metadata(next);
   });
  }catch{return unavailable()}},
 };
}
/** Metadata-only blocker read in the caller's existing transaction. The exact
 * current reader is mandatory even for zero rows; absence is never coverage. */
export async function readNativeGitCredentialLeaseBlockers(tx:Tx,rawOrg:string,ports:{assertCurrent(tx:Tx,org:string):Promise<()=>void>;signal:AbortSignal;now?:()=>Date}):Promise<{pendingCount:number;liveIssuedCount:number;expiredIssuedCount:number;legacyQualification:'unavailable'}>{try{
 const org=identifier.parse(rawOrg),deadline=Date.now()+15000,ready=()=>{ports.signal.throwIfAborted();if(typeof ports.assertCurrent!=='function'||!Number.isFinite(Date.now())||Date.now()>=deadline)unavailable();appClock(ports.now)};ready();await lock(tx,org);
 let readerFresh=await ports.assertCurrent(tx,org);if(typeof readerFresh!=='function')unavailable();ready();readerFresh();
 // Stable pages under the organization lock retain complete history. More than
 // 10,000 records or the 15-second read budget is unavailable, never partial
 // absence/coverage. A future archival/index design must preserve this history.
 const states:Array<z.infer<typeof stateSchema>>=[],seen=new Set<string>();let cursor:string|undefined;
 for(let page=0;;page++){
  ready();readerFresh();const rows=await tx.durableAgentWorkflow.findMany({where:{organizationId:org,OR:[{workflowKind:KIND},{id:{startsWith:PREFIX}}]},orderBy:[{id:'asc'}],take:100,...(cursor?{cursor:{id:cursor},skip:1}:{})});
  if(rows.length>100||page>=100&&rows.length)unavailable();
  for(const row of rows){if(row.organizationId!==org||seen.has(row.id))unavailable();seen.add(row.id);states.push((await history(tx,row)).state);ready();readerFresh()}
  if(rows.length<100)break;cursor=rows[rows.length-1].id;
 }
 readerFresh=await ports.assertCurrent(tx,org);if(typeof readerFresh!=='function')unavailable();ready();const dbAt=await databaseClock(tx);ready();readerFresh();ready();const counts={pendingCount:0,liveIssuedCount:0,expiredIssuedCount:0,legacyQualification:'unavailable' as const};
 for(const state of states){if(state.status==='pending')counts.pendingCount++;else if(state.providerExpiresAt>dbAt)counts.liveIssuedCount++;else counts.expiredIssuedCount++}return counts;
}catch{return unavailable()}}
