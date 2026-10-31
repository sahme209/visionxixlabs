import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction as Tx,ReleaseOperationPlanRow as Row} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {identifier,digestSchema,type EvidenceSnapshot} from './contracts';
import {validateEvidenceEnvelope} from './freshness';
const KIND='governance_evidence_snapshot_v1';
const scopeSchema=z.object({organizationId:identifier,actorUserId:identifier,sessionId:identifier}).strict();
export type EvidenceStoreScope=z.infer<typeof scopeSchema>;
interface Ports{assertCurrent:(tx:Tx,scope:EvidenceStoreScope,role:'reader'|'collector',snapshot?:EvidenceSnapshot)=>Promise<void>;now?:()=>Date}
const inputSchema=z.object({format:z.literal(1),snapshot:z.unknown(),actorUserId:identifier,sessionId:identifier,clientRequestId:z.string().uuid(),createdAt:z.string().datetime()}).strict();
const deny=():never=>{throw Error('governance_evidence_unavailable')};
const idFor=(org:string,digest:string)=>'governance_evidence_'+sha256ContentHash({organizationId:org,digest});
/** Immutable source artifacts in existing durable tables. Ports do current DB
 * authorization only; collection/provider I/O completes before acquiring locks. */
export function createGovernanceEvidenceStore(repo:ReleaseOperationPlanRepo,ports:Ports){
 const now=()=>{const value=ports.now?.()??new Date();if(!Number.isFinite(value.getTime()))deny();return value};
 async function authority(tx:Tx,s:EvidenceStoreScope,role:'reader'|'collector',snapshot?:EvidenceSnapshot){
  const rows=await tx.$queryRaw<Array<{organizationId:string;userId:string;acceptedAt:Date|null}>>`SELECT "organizationId","userId","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${s.organizationId} AND "userId"=${s.actorUserId} FOR SHARE`;
  if(rows.length!==1||rows[0].organizationId!==s.organizationId||rows[0].userId!==s.actorUserId||!rows[0].acceptedAt||!ports.assertCurrent)deny();await ports.assertCurrent(tx,s,role,snapshot);
 }
 function fresh(snapshot:EvidenceSnapshot){const at=now().getTime(),observed=Date.parse(snapshot.observedAt),expires=Date.parse(snapshot.expiresAt);if(observed>at||expires<=at||expires-observed>300000)deny()}
 async function unpack(tx:Tx,s:EvidenceStoreScope,row:Row){
  const input=inputSchema.parse(row.inputJson),snapshot=validateEvidenceEnvelope(input.snapshot),state=z.object({digest:digestSchema}).strict().parse(row.stateJson);
  if(row.id!==idFor(s.organizationId,snapshot.digest)||row.organizationId!==s.organizationId||snapshot.organizationId!==s.organizationId||row.workflowKind!==KIND||row.version!==0||row.currentStep!=='observed'||row.status!=='completed'||row.attemptCount!==0||row.maxAttempts!==1||row.leaseOwner||row.leaseExpiresAt||row.approvalProposalId||row.requestedByUserId!==input.actorUserId||state.digest!==snapshot.digest||row.createdAt.toISOString()!==input.createdAt||row.updatedAt.getTime()!==row.createdAt.getTime())deny();
  const events=await tx.durableAgentWorkflowEvent.findMany({where:{organizationId:s.organizationId,workflowRunId:row.id},orderBy:{sequence:'asc'},take:2}),e=events[0];
  if(events.length!==1||e.sequence!==0||e.workflowRunId!==row.id||e.organizationId!==s.organizationId||e.eventType!==KIND+'.observed'||e.actorKind!=='user'||e.actorId!==input.actorUserId||e.occurredAt.getTime()!==row.createdAt.getTime()||sha256ContentHash(e.detailJson)!==sha256ContentHash({inputDigest:sha256ContentHash(row.inputJson),stateDigest:sha256ContentHash(row.stateJson),clientRequestId:input.clientRequestId}))deny();
  return{id:row.id,snapshot:structuredClone(snapshot),createdAt:input.createdAt};
 }
 async function readIn(tx:Tx,s:EvidenceStoreScope,digest:string){
  const rows=await tx.$queryRaw<Row[]>`SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${idFor(s.organizationId,digest)} AND "organizationId"=${s.organizationId} AND "workflowKind"=${KIND} FOR SHARE`;
  if(rows.length!==1)deny();const value=await unpack(tx,s,rows[0]);await authority(tx,s,'reader',value.snapshot);return value;
 }
 return{
  async save(rawScope:EvidenceStoreScope,rawSnapshot:unknown,nonce:string,transaction?:Tx){const s=scopeSchema.parse(rawScope),snapshot=validateEvidenceEnvelope(rawSnapshot);z.string().uuid().parse(nonce);if(snapshot.organizationId!==s.organizationId||Buffer.byteLength(JSON.stringify(snapshot))>262144)deny();fresh(snapshot);
   const run=async(tx:Tx)=>{const id=idFor(s.organizationId,snapshot.digest);await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${id}))`;await authority(tx,s,'collector',snapshot);fresh(snapshot);
    const prior=await tx.durableAgentWorkflow.findFirst({where:{id,organizationId:s.organizationId,workflowKind:KIND}});if(prior)return readIn(tx,s,snapshot.digest);
    const at=now(),input=inputSchema.parse({format:1,snapshot,actorUserId:s.actorUserId,sessionId:s.sessionId,clientRequestId:nonce,createdAt:at.toISOString()}),state={digest:snapshot.digest};
    const row=await tx.durableAgentWorkflow.create({data:{id,organizationId:s.organizationId,workflowKind:KIND,objective:'Read-only governance evidence; no provider execution',status:'completed',autonomyLevel:'observe',currentStep:'observed',inputJson:input,stateJson:state,requestedByUserId:s.actorUserId,attemptCount:0,maxAttempts:1,version:0,leaseOwner:null,leaseExpiresAt:null,approvalProposalId:null,nextAttemptAt:null,createdAt:at,updatedAt:at,completedAt:at}});
    await tx.durableAgentWorkflowEvent.create({data:{workflowRunId:id,organizationId:s.organizationId,sequence:0,eventType:KIND+'.observed',actorKind:'user',actorId:s.actorUserId,detailJson:{inputDigest:sha256ContentHash(input),stateDigest:sha256ContentHash(state),clientRequestId:nonce},occurredAt:at}});
    const result=await unpack(tx,s,row);fresh(snapshot);await authority(tx,s,'collector',snapshot);return result;
   };return transaction?run(transaction):repo.$transaction(run);
  },
  async read(rawScope:EvidenceStoreScope,digest:string,transaction?:Tx){const s=scopeSchema.parse(rawScope);digestSchema.parse(digest);return transaction?readIn(transaction,s,digest):repo.$transaction(tx=>readIn(tx,s,digest))},
  async lookupDocumentUpload(rawScope:EvidenceStoreScope,requestId:string){const s=scopeSchema.parse(rawScope);z.string().uuid().parse(requestId);return repo.$transaction(async tx=>{await authority(tx,s,'reader');const rows=await tx.durableAgentWorkflow.findMany({where:{organizationId:s.organizationId,workflowKind:KIND,AND:[{inputJson:{path:['clientRequestId'],equals:requestId}},{inputJson:{path:['actorUserId'],equals:s.actorUserId}},{inputJson:{path:['snapshot','source'],equals:'document'}}]},orderBy:[{createdAt:'desc'},{id:'desc'}],take:2});if(!rows.length)return{found:false as const};if(rows.length!==1)deny();const input=inputSchema.parse(rows[0].inputJson),snapshot=validateEvidenceEnvelope(input.snapshot);if(input.actorUserId!==s.actorUserId||input.clientRequestId!==requestId||snapshot.source!=='document')deny();const artifact=await readIn(tx,s,snapshot.digest);await authority(tx,s,'reader');return{found:true as const,artifact}})},
  async lookupCollectionRequest(rawScope:EvidenceStoreScope,requestId:string){const s=scopeSchema.parse(rawScope);z.string().uuid().parse(requestId);return repo.$transaction(async tx=>{await authority(tx,s,'reader');const rows=await tx.durableAgentWorkflow.findMany({where:{organizationId:s.organizationId,workflowKind:KIND,AND:[{inputJson:{path:['clientRequestId'],equals:requestId}},{inputJson:{path:['actorUserId'],equals:s.actorUserId}},{OR:[{inputJson:{path:['snapshot','source'],equals:'github'}},{inputJson:{path:['snapshot','source'],equals:'aws'}}]}]},orderBy:[{createdAt:'desc'},{id:'desc'}],take:2});if(!rows.length)return{found:false as const};if(rows.length!==1)deny();const input=inputSchema.parse(rows[0].inputJson),snapshot=validateEvidenceEnvelope(input.snapshot);if(input.actorUserId!==s.actorUserId||input.clientRequestId!==requestId||!['github','aws'].includes(snapshot.source))deny();const artifact=await readIn(tx,s,snapshot.digest);await authority(tx,s,'reader');return{found:true as const,artifact}})},
  async list(rawScope:EvidenceStoreScope){const s=scopeSchema.parse(rawScope);return repo.$transaction(async tx=>{await authority(tx,s,'reader');const rows=await tx.durableAgentWorkflow.findMany({where:{organizationId:s.organizationId,workflowKind:KIND},orderBy:[{createdAt:'desc'},{id:'desc'}],take:21});const items=[];for(const row of rows.slice(0,20)){const{snapshot:e,createdAt,id}=await unpack(tx,s,row);items.push({id,digest:e.digest,source:e.source,connectionId:e.connectionId,connectionRevision:e.connectionRevision,selection:e.selection,completeness:e.completeness,observedAt:e.observedAt,expiresAt:e.expiresAt,createdAt,factCount:e.facts.length})}await authority(tx,s,'reader');return{items,truncated:rows.length>20}})},
 };
}
