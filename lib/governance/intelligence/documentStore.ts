import 'server-only';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction as Tx,ReleaseOperationPlanRow as Row} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {identifier,digestSchema,scopeSchema,type EvidenceSnapshot} from './contracts';
import {parseUploadedPolicy} from './documentRequirements';
import {validateEvidenceEnvelope} from './freshness';
const BLOB='governance_document_blob_v1',HEAD='governance_document_head_v1';
const scopeInput=z.object({organizationId:identifier,actorUserId:identifier,sessionId:identifier}).strict();
type Scope=z.infer<typeof scopeInput>;
const nameSchema=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,119}\.(md|txt)$/i).refine(v=>!v.includes('..'));
const base={format:z.literal(1),organizationId:identifier,name:nameSchema,selection:scopeSchema,createdBy:identifier,sessionId:identifier,createdAt:z.string().datetime(),requestId:z.string().uuid()};
const headInput=z.object(base).strict(),blobInput=z.object({...base,sourceDigest:digestSchema,base64:z.string().min(1).max(87384)}).strict();
const headState=z.object({blobId:z.string().regex(/^governance_document_blob_[a-f0-9]{64}$/),sourceDigest:digestSchema}).strict(),blobState=z.object({sourceDigest:digestSchema}).strict();
const uploadInput=z.object({name:nameSchema,selection:scopeSchema,utf8Bytes:z.instanceof(Uint8Array).refine(v=>v.byteLength>0&&v.byteLength<=65536),expectedVersion:z.number().int().min(0).max(998).nullable(),requestId:z.string().uuid()}).strict();
const headId=(org:string,name:string,selection:unknown)=>'governance_document_head_'+hash({organizationId:org,name,selection});
const blobId=(org:string,name:string,selection:unknown,sourceDigest:string)=>'governance_document_blob_'+hash({organizationId:org,name,selection,sourceDigest});
function deny():never{throw Error('governance_document_unavailable')}
function sane(row:Row&{autonomyLevel?:unknown},input:z.infer<typeof headInput>,kind:string){if(row.organizationId!==input.organizationId||row.workflowKind!==kind||row.status!=='completed'||row.autonomyLevel!=='observe'||row.currentStep!==(kind===HEAD?'current':'recorded')||row.requestedByUserId!==input.createdBy||row.attemptCount!==0||row.maxAttempts!==1||row.leaseOwner||row.leaseExpiresAt||row.approvalProposalId||row.createdAt.toISOString()!==input.createdAt||!Number.isInteger(row.version)||row.version<0||row.version>999||kind===BLOB&&row.version!==0)deny()}
async function history(tx:Tx,row:Row,kind:string){
 const events=await tx.durableAgentWorkflowEvent.findMany({where:{organizationId:row.organizationId,workflowRunId:row.id},orderBy:{sequence:'asc'},take:1001});
 if(events.length!==row.version+1)deny();let previous:string|null=null;
 for(let i=0;i<events.length;i++){
  const e=events[i],d=z.object({inputDigest:digestSchema,stateDigest:digestSchema,previousStateDigest:digestSchema.nullable(),state:z.unknown(),requestId:z.string().uuid(),expectedVersion:z.number().int().min(0).nullable()}).strict().parse(e.detailJson),state=kind===HEAD?headState.parse(d.state):blobState.parse(d.state);
  if(i===0&&d.requestId!==(row.inputJson as {requestId:string}).requestId)deny();
  if(kind===HEAD){const input=headInput.parse(row.inputJson),pointer=headState.parse(state);if(pointer.blobId!==blobId(input.organizationId,input.name,input.selection,pointer.sourceDigest))deny()}
  if(e.organizationId!==row.organizationId||e.workflowRunId!==row.id||e.sequence!==i||e.eventType!==kind+(kind===HEAD?'.updated':'.recorded')||e.actorKind!=='user'||!identifier.safeParse(e.actorId).success||i===0&&e.actorId!==row.requestedByUserId||d.inputDigest!==hash(row.inputJson)||d.stateDigest!==hash(state)||d.previousStateDigest!==previous||d.expectedVersion!==(i?i-1:null)||!Number.isFinite(e.occurredAt.getTime())||e.occurredAt<row.createdAt||i>0&&e.occurredAt<events[i-1].occurredAt)deny();
  previous=d.stateDigest;if(i===events.length-1&&(d.stateDigest!==hash(row.stateJson)||e.occurredAt.getTime()!==row.updatedAt.getTime()))deny();
 }
 return events;
}
async function readHead(tx:Tx,s:Scope,name:string,selection:unknown){
 const rows=await tx.$queryRaw<Row[]>`SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${headId(s.organizationId,name,selection)} AND "organizationId"=${s.organizationId} AND "workflowKind"=${HEAD} FOR SHARE`;
 if(!rows.length)return null;if(rows.length!==1)deny();const row=rows[0],input=headInput.parse(row.inputJson),state=headState.parse(row.stateJson);sane(row,input,HEAD);
 if(input.name!==name||input.organizationId!==s.organizationId||hash(input.selection)!==hash(selection)||row.id!==headId(s.organizationId,input.name,input.selection))deny();const events=await history(tx,row,HEAD);return{row,input,state,events};
}
async function readBlob(tx:Tx,s:Scope,id:string,at:number){
 if(!/^governance_document_blob_[a-f0-9]{64}$/.test(id))deny();const rows=await tx.$queryRaw<Row[]>`SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${id} AND "organizationId"=${s.organizationId} AND "workflowKind"=${BLOB} FOR SHARE`;if(rows.length!==1)deny();
 const row=rows[0],input=blobInput.parse(row.inputJson),state=blobState.parse(row.stateJson);sane(row,input,BLOB);if(row.createdAt.getTime()>at)deny();const bytes=Buffer.from(input.base64,'base64');
 if(bytes.toString('base64')!==input.base64||bytes.length>65536||input.organizationId!==s.organizationId||createHash('sha256').update(bytes).digest('hex')!==input.sourceDigest||state.sourceDigest!==input.sourceDigest||id!==blobId(s.organizationId,input.name,input.selection,input.sourceDigest))deny();
 await history(tx,row,BLOB);const parsed=parseUploadedPolicy({organizationId:s.organizationId,name:input.name,selection:input.selection,utf8Bytes:new Uint8Array(bytes),now:at});return{row,input,parsed};
}
/** DB/source binding only. Caller must separately verify current reader/session. */
export async function assertGovernanceDocumentHead(tx:Tx,s:Scope,raw:unknown){
 const e=validateEvidenceEnvelope(raw);if(e.organizationId!==s.organizationId||e.source!=='document'||!e.connectionId.startsWith('upload:')||e.collectorVersion!=='governance-document-v2')deny();
 const name=nameSchema.parse(e.connectionId.slice(7)),head=await readHead(tx,s,name,e.selection);if(!head||head.state.sourceDigest!==e.sourceDigest||e.connectionRevision!==e.sourceDigest)deny();
 const body=await readBlob(tx,s,head.state.blobId,Date.now()),actual=body.parsed.snapshot;
 if(body.input.name!==name||hash(body.input.selection)!==hash(e.selection)||actual.sourceDigest!==head.state.sourceDigest||hash({facts:actual.facts,completeness:actual.completeness})!==hash({facts:e.facts,completeness:e.completeness}))deny();
}
type Artifact={id:string;snapshot:EvidenceSnapshot;createdAt:string};
interface Ports {recordSnapshot?:(tx:Tx,s:Scope,snapshot:EvidenceSnapshot,requestId:string,phase:'new'|'recover')=>Promise<Artifact>;assertCurrent:(tx:Tx,scope:Scope,role:'reader'|'collector')=>Promise<void>;now?:()=>Date}
/** Bounded inert policy bytes + audited CAS head, using existing durable tables.
 * Uploading a source never approves/activates a policy or changes a provider. */
export function createGovernanceDocumentStore(repo:ReleaseOperationPlanRepo,ports:Ports){
 const now=()=>{const at=ports.now?.()??new Date();if(!Number.isFinite(at.getTime()))deny();return at};
 async function authority(tx:Tx,s:Scope,role:'reader'|'collector'){
  const rows=await tx.$queryRaw<Array<{organizationId:string;userId:string;acceptedAt:Date|null}>>`SELECT "organizationId","userId","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${s.organizationId} AND "userId"=${s.actorUserId} FOR SHARE`;
  if(rows.length!==1||rows[0].organizationId!==s.organizationId||rows[0].userId!==s.actorUserId||!rows[0].acceptedAt||!ports.assertCurrent)deny();await ports.assertCurrent(tx,s,role);
 }
 async function event(tx:Tx,row:Row,s:Scope,requestId:string,previousStateDigest:string|null){await tx.durableAgentWorkflowEvent.create({data:{organizationId:s.organizationId,workflowRunId:row.id,sequence:row.version,eventType:row.workflowKind+(row.workflowKind===HEAD?'.updated':'.recorded'),actorKind:'user',actorId:s.actorUserId,detailJson:{inputDigest:hash(row.inputJson),stateDigest:hash(row.stateJson),state:row.stateJson,previousStateDigest,requestId,expectedVersion:row.version?row.version-1:null},occurredAt:row.updatedAt}})}
 async function record(tx:Tx,s:Scope,snapshot:EvidenceSnapshot,requestId:string,phase:'new'|'recover'){
  if(!ports.recordSnapshot)return undefined;
  const artifact=await ports.recordSnapshot(tx,s,structuredClone(snapshot),requestId,phase);
  if(!artifact||artifact.id!=='governance_evidence_'+hash({organizationId:s.organizationId,digest:snapshot.digest})||hash(validateEvidenceEnvelope(artifact.snapshot))!==hash(snapshot)||!z.string().datetime().safeParse(artifact.createdAt).success)deny();return artifact;
 }
 async function create(tx:Tx,s:Scope,id:string,kind:string,input:unknown,state:unknown,requestId:string,at:Date){const row=await tx.durableAgentWorkflow.create({data:{id,organizationId:s.organizationId,workflowKind:kind,objective:'Inert policy source history; no execution authority',status:'completed',autonomyLevel:'observe',currentStep:kind===HEAD?'current':'recorded',requestedByUserId:s.actorUserId,inputJson:input,stateJson:state,attemptCount:0,maxAttempts:1,version:0,leaseOwner:null,leaseExpiresAt:null,approvalProposalId:null,nextAttemptAt:null,createdAt:at,updatedAt:at,completedAt:at}});await event(tx,row,s,requestId,null);return row}
 return{
  async upload(rawScope:Scope,raw:unknown){
   const s=scopeInput.parse(rawScope),u=uploadInput.parse(raw),bytes=new Uint8Array(u.utf8Bytes),at=now(),parsed=parseUploadedPolicy({organizationId:s.organizationId,name:u.name,selection:u.selection,utf8Bytes:bytes,now:at.getTime()}),sourceDigest=parsed.snapshot.sourceDigest,id=blobId(s.organizationId,u.name,u.selection,sourceDigest),hid=headId(s.organizationId,u.name,u.selection);
   return repo.$transaction(async tx=>{
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${hid}))`;await authority(tx,s,'collector');const head=await readHead(tx,s,u.name,u.selection);
    const prior=head?.events.find(e=>(e.detailJson as {requestId:string}).requestId===u.requestId);
    if(prior){if(prior.sequence!==head!.row.version||head!.state.blobId!==id)deny();const recovered=parseUploadedPolicy({organizationId:s.organizationId,name:u.name,selection:u.selection,utf8Bytes:bytes,now:head!.row.updatedAt.getTime()}).snapshot,artifact=await record(tx,s,recovered,u.requestId,'recover');await authority(tx,s,'collector');return{snapshot:recovered,headVersion:head!.row.version,artifact}}
    if((head?.row.version??null)!==u.expectedVersion||head&&(head.row.version>=999||at<head.row.updatedAt))deny();
    const existing=await tx.durableAgentWorkflow.findFirst({where:{id,organizationId:s.organizationId,workflowKind:BLOB}});
    if(existing)await readBlob(tx,s,id,at.getTime());else await create(tx,s,id,BLOB,{format:1,organizationId:s.organizationId,name:u.name,selection:u.selection,createdBy:s.actorUserId,sessionId:s.sessionId,createdAt:at.toISOString(),requestId:u.requestId,sourceDigest,base64:Buffer.from(bytes).toString('base64')},{sourceDigest},u.requestId,at);
    const state={blobId:id,sourceDigest};let version=0;
    if(!head)await create(tx,s,hid,HEAD,{format:1,organizationId:s.organizationId,name:u.name,selection:u.selection,createdBy:s.actorUserId,sessionId:s.sessionId,createdAt:at.toISOString(),requestId:u.requestId},state,u.requestId,at);
    else{const changed=await tx.durableAgentWorkflow.updateMany({where:{id:hid,organizationId:s.organizationId,workflowKind:HEAD,version:head.row.version,inputJson:{equals:head.row.inputJson},stateJson:{equals:head.row.stateJson}},data:{stateJson:state,version:{increment:1},updatedAt:at,completedAt:at}});if(changed.count!==1)deny();version=head.row.version+1;await event(tx,{...head.row,stateJson:state,version,updatedAt:at},s,u.requestId,hash(head.row.stateJson))}
    const artifact=await record(tx,s,parsed.snapshot,u.requestId,'new');await authority(tx,s,'collector');return{snapshot:parsed.snapshot,headVersion:version,artifact};
   });
  },
  async observe(rawScope:Scope,raw:unknown){const s=scopeInput.parse(rawScope),approved=validateEvidenceEnvelope(raw);if(approved.organizationId!==s.organizationId||approved.source!=='document'||!approved.connectionId.startsWith('upload:'))deny();const name=nameSchema.parse(approved.connectionId.slice(7));return repo.$transaction(async tx=>{await authority(tx,s,'reader');const head=await readHead(tx,s,name,approved.selection);if(!head)deny();const body=await readBlob(tx,s,head.state.blobId,now().getTime());if(body.input.name!==name||hash(body.input.selection)!==hash(approved.selection)||body.input.sourceDigest!==head.state.sourceDigest)deny();await authority(tx,s,'reader');return body.parsed.snapshot})},
 };
}
