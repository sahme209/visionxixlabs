import 'server-only';
import {readCodingOutboundBlockersLocked} from '@/lib/workforce/pipelines/codingOutboundHistory';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction as Tx,ReleaseOperationPlanRow as Row} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {identifier,digestSchema} from './contracts';
import type {RevisionScope} from './revisionStore';
import {drainScopeSchema,drainDecisionPlanSchema,outboundBindingSchema,drainDecisionIdSchema,drainSlotIdSchema,drainSavedIdSchema,type DrainDecisionPlan,type DrainOutboundBinding,type DrainAuthorityRole} from './drainContracts';
const DECISION='governance_drain_decision_v1',TRANSITION='governance_transition_v1',SLOT='governance_outbound_v1';
function fail():never{throw Error('governance_drain_unavailable')}
const same=(a:unknown,b:unknown)=>hash(a)===hash(b);
const decisionInput=z.object({format:z.literal(1),scope:drainScopeSchema,plan:drainDecisionPlanSchema,nonce:z.string().uuid(),createdAt:z.string().datetime()}).strict();
const decisionState=z.discriminatedUnion('status',[z.object({status:z.literal('proposed')}).strict(),z.object({status:z.literal('approved'),reviewer:drainScopeSchema}).strict(),z.object({status:z.literal('consumed'),reviewer:drainScopeSchema}).strict()]);
const transitionInput=z.object({format:z.literal(1),organizationId:identifier,createdAt:z.string().datetime()}).strict();
const transitionState=z.object({status:z.enum(['draining','aborted']),plan:drainDecisionPlanSchema,decisionId:drainDecisionIdSchema,epoch:z.string().uuid(),preExistingAdmissionDigest:digestSchema}).strict();
const slotInput=z.object({format:z.literal(1),scope:drainScopeSchema,binding:outboundBindingSchema,epoch:z.string().uuid().nullable(),createdAt:z.string().datetime()}).strict();
const slotState=z.discriminatedUnion('status',[z.object({status:z.literal('reserved')}).strict(),z.object({status:z.literal('submission_intent')}).strict(),z.object({status:z.literal('unknown')}).strict(),z.object({status:z.literal('quiescent'),observationDigest:digestSchema}).strict()]);
const kinds=[DECISION,TRANSITION,SLOT];
function parse(row:Row){if(!kinds.includes(row.workflowKind))fail();const input=row.workflowKind===DECISION?decisionInput.parse(row.inputJson):row.workflowKind===TRANSITION?transitionInput.parse(row.inputJson):slotInput.parse(row.inputJson);const state=row.workflowKind===DECISION?decisionState.parse(row.stateJson):row.workflowKind===TRANSITION?transitionState.parse(row.stateJson):slotState.parse(row.stateJson);
 const org='scope'in input?input.scope.organizationId:input.organizationId,id=row.workflowKind===DECISION?'governance_drain_decision_'+hash({organizationId:org,plan:decisionInput.parse(input).plan,nonce:decisionInput.parse(input).nonce}):row.workflowKind===TRANSITION?'governance_transition_'+hash(org):'governance_outbound_'+hash({organizationId:org,serverNonce:slotInput.parse(input).binding.serverNonce});
 const consumed=row.workflowKind===DECISION&&state.status==='consumed',complete=consumed||state.status==='quiescent'||state.status==='aborted';
 if(row.id!==id||row.organizationId!==org||(row as any).autonomyLevel!=='observe'||row.maxAttempts!==1||row.attemptCount!==(consumed?1:0)||row.version<0||row.version>=128||row.leaseOwner||row.leaseExpiresAt||row.approvalProposalId||row.currentStep!==state.status||row.status!==(complete?'completed':'paused_for_input')||row.createdAt.toISOString()!==input.createdAt||row.updatedAt<row.createdAt||!Number.isFinite(row.updatedAt.getTime())||'scope'in input&&row.requestedByUserId!==input.scope.actorUserId)fail();return{input,state};}
function validStep(kind:string,prior:any,next:any,input:any,actor:RevisionScope){
 if(kind===DECISION){const p=decisionInput.parse(input).plan;if(actor.organizationId!==p.organizationId)fail();if(!prior){if(next.status!=='proposed'||actor.actorUserId!==p.requesterUserId||!same(actor,input.scope))fail()}
 else if(prior.status==='proposed'){if(next.status!=='approved'||actor.actorUserId!==p.reviewerUserId||!same(next.reviewer,actor))fail()}
 else if(prior.status==='approved'){if(next.status!=='consumed'||!same(next.reviewer,prior.reviewer)||!same(actor,input.scope))fail()}else fail();}
 else if(kind===SLOT){if(actor.organizationId!==input.scope.organizationId||next.status!=='quiescent'&&!same(actor,input.scope))fail();if(!prior){if(next.status!=='reserved')fail()}else if(prior.status==='reserved'){if(!['submission_intent','unknown','quiescent'].includes(next.status))fail()}else if(prior.status==='submission_intent'){if(!['unknown','quiescent'].includes(next.status))fail()}else if(prior.status==='unknown'){if(next.status!=='quiescent')fail()}else fail();}
 else{const p=drainDecisionPlanSchema.parse(next.plan);if(p.organizationId!==input.organizationId||actor.organizationId!==p.organizationId||actor.actorUserId!==p.requesterUserId||next.epoch!==p.epoch||next.preExistingAdmissionDigest!==p.preExistingAdmissionDigest)fail();if(!prior){if(p.kind!=='begin'||p.expectedVersion!==null||next.status!=='draining')fail()}else if(prior.status==='draining'){if(p.kind!=='abort'||next.status!=='aborted'||p.epoch!==prior.epoch||p.preExistingAdmissionDigest!==prior.preExistingAdmissionDigest)fail()}else if(prior.status==='aborted'){if(p.kind!=='begin'||next.status!=='draining'||p.epoch===prior.epoch)fail()}else fail();}
}
async function history(tx:Tx,row:Row):Promise<ReturnType<typeof parse>&{row:Row;epochs:string[]}>{const {input,state}=parse(row),events=await tx.durableAgentWorkflowEvent.findMany({where:{organizationId:row.organizationId,workflowRunId:row.id},orderBy:{sequence:'asc'},take:129});if(events.length!==row.version+1)fail();let previous:any=null,previousAt=row.createdAt;const epochs:string[]=[];
 for(let n=0;n<events.length;n++){const e=events[n],d=z.object({inputDigest:digestSchema,stateDigest:digestSchema,previousStateDigest:digestSchema.nullable(),expectedVersion:z.number().int().nullable(),state:z.unknown(),actor:drainScopeSchema}).strict().parse(e.detailJson);const next=row.workflowKind===DECISION?decisionState.parse(d.state):row.workflowKind===TRANSITION?transitionState.parse(d.state):slotState.parse(d.state);
 if(e.workflowRunId!==row.id||e.organizationId!==row.organizationId||e.sequence!==n||e.actorKind!=='user'||e.actorId!==d.actor.actorUserId||e.eventType!==row.workflowKind+'.'+next.status||d.inputDigest!==hash(input)||d.stateDigest!==hash(next)||d.previousStateDigest!==(previous===null?null:hash(previous))||d.expectedVersion!==(n===0?null:n-1)||!Number.isFinite(e.occurredAt.getTime())||e.occurredAt<previousAt||n===0&&e.occurredAt.getTime()!==row.createdAt.getTime()||n===row.version&&(!same(next,state)||e.occurredAt.getTime()!==row.updatedAt.getTime()))fail();
 validStep(row.workflowKind,previous,next,input,d.actor);if(row.workflowKind===TRANSITION){const transition=transitionState.parse(next);if(transition.status==='draining'){if(epochs.includes(transition.epoch))fail();epochs.push(transition.epoch)}if(n>0&&transition.plan.expectedVersion!==n-1)fail();const decisionRow=await tx.durableAgentWorkflow.findFirst({where:{id:transition.decisionId,organizationId:row.organizationId}});if(!decisionRow||decisionRow.workflowKind!==DECISION)fail();const decision=await history(tx,decisionRow);if(decision.state.status!=='consumed'||!same(decisionInput.parse(decision.input).plan,transition.plan)||!same(decisionInput.parse(decision.input).scope,d.actor))fail();}previous=next;previousAt=e.occurredAt;
 }return{row,input,state,epochs};}
async function loadDrainBarrier(tx:Tx,org:string){const row=await tx.durableAgentWorkflow.findFirst({where:{id:'governance_transition_'+hash(org)}});if(row&&(row.organizationId!==org||row.workflowKind!==TRANSITION))fail();return row?history(tx,row):null;}
/** DB-only barrier metadata, not reader/source/execution authority. The caller
 * must establish its real current authority separately in this same transaction. */
export async function readEnrollmentDrainBarrierLocked(tx:Tx,rawOrg:string,signal:AbortSignal){const org=identifier.parse(rawOrg),deadline=Date.now()+15000;const ready=()=>{signal.throwIfAborted();if(!Number.isFinite(Date.now())||Date.now()>=deadline)fail()};ready();await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+hash(org)}))`;ready();const x=await loadDrainBarrier(tx,org);ready();if(!x)return null;const state=transitionState.parse(x.state);return{id:x.row.id,version:x.row.version,status:state.status,epoch:state.epoch,executionAuthorized:false as const};}
async function drainDatabaseClock(tx:Tx){const rows=await tx.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() AS "now"`;if(rows.length!==1||!(rows[0].now instanceof Date)||!Number.isFinite(rows[0].now.getTime()))fail();return rows[0].now;}
function drainRecordView(row:Row){const{input,state}=parse(row);return{id:row.id,version:row.version,status:state.status,...(row.workflowKind===SLOT?{epoch:slotInput.parse(input).epoch}:row.workflowKind===TRANSITION?{epoch:transitionState.parse(state).epoch}:{}),executionAuthorized:false as const};}
/** Shared all-tenant bounded scan. Every entry uses the ORIGINAL canonical
 * immutable history validator; malformed/overflow is unavailable, never partial. */
async function scanOutboundBlockers(tx:Tx,org:string,assertFresh:()=>void){
 const counts={blockingCount:0,reservedCount:0,submissionIntentCount:0,unknownCount:0,quiescentCount:0},seen=new Set<string>();let cursor:string|undefined;
 for(let page=0;;page++){assertFresh();const rows=await tx.durableAgentWorkflow.findMany({where:{organizationId:org,OR:[{workflowKind:SLOT},{id:{startsWith:'governance_outbound_'}}]},orderBy:[{id:'asc'}],take:100,...(cursor?{cursor:{id:cursor},skip:1}:{})});assertFresh();if(rows.length>100||page>=100&&rows.length)fail();
  for(const row of rows){if(row.organizationId!==org||row.workflowKind!==SLOT||seen.has(row.id))fail();seen.add(row.id);const x=await history(tx,row);assertFresh();if(x.state.status==='reserved')counts.reservedCount++;else if(x.state.status==='submission_intent')counts.submissionIntentCount++;else if(x.state.status==='unknown')counts.unknownCount++;else if(x.state.status==='quiescent')counts.quiescentCount++;else fail()}
  if(rows.length<100)break;cursor=rows[rows.length-1].id;
 }
 const coding=await readCodingOutboundBlockersLocked(tx,org,assertFresh);counts.unknownCount+=coding;
 counts.blockingCount=counts.reservedCount+counts.submissionIntentCount+counts.unknownCount;return counts;
}
/** Metadata-only in the caller's EXISTING transaction. Exact current reader is
 * mandatory even for zero rows; this result never grants execution/activation. */
export async function readEnrollmentDrainBlockersLocked(tx:Tx,rawOrg:string,ports:{signal:AbortSignal;assertCurrent(tx:Tx,organizationId:string):Promise<()=>void>}){
 const org=identifier.parse(rawOrg),started=Date.now();const ready=()=>{ports.signal.throwIfAborted();const at=Date.now();if(typeof ports.assertCurrent!=='function'||!Number.isFinite(started)||!Number.isFinite(at)||at<started||at>=started+15000)fail()};ready();
 await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+hash(org)}))`;ready();
 let readerFresh=await ports.assertCurrent(tx,org);if(typeof readerFresh!=='function')fail();const fresh=()=>{ready();readerFresh();ready()};fresh();
 const bar=await loadDrainBarrier(tx,org);fresh();const counts=await scanOutboundBlockers(tx,org,fresh);
 readerFresh=await ports.assertCurrent(tx,org);if(typeof readerFresh!=='function')fail();await drainDatabaseClock(tx);fresh();
 return{...counts,transition:bar?drainRecordView(bar.row):null,executionAuthorized:false as const,legacyQualification:'unavailable' as const,runtimeQualification:'unavailable' as const};
}
/** Internal DB-only association check in the caller's existing org-first transaction.
 * This validates canonical slot history, not participant authority or quiescence.
 * The trusted caller must separately verify the actual original private claim. */
export async function readExactEnrollmentDrainAttemptLocked(tx:Tx,rawScope:RevisionScope,rawBinding:Omit<DrainOutboundBinding,'serverNonce'>,status:'reserved'|'submission_intent'){
 const scope=drainScopeSchema.parse(rawScope),binding=outboundBindingSchema.omit({serverNonce:true}).parse(rawBinding);
 await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+hash(scope.organizationId)}))`;
 const rows=await tx.durableAgentWorkflow.findMany({where:{organizationId:scope.organizationId,workflowKind:SLOT,inputJson:{path:['binding','operationId'],equals:binding.operationId}},orderBy:[{id:'asc'}],take:2});
 if(rows.length!==1)fail();const checked=await history(tx,rows[0]),input=slotInput.parse(checked.input),{serverNonce:_,...actual}=input.binding;
 if(!same(input.scope,scope)||!same(actual,binding)||checked.state.status!==status)fail();
 return{id:rows[0].id,status:checked.state.status,executionAuthorized:false as const};
}
export interface EnrollmentDrainPorts{
 signal:AbortSignal;
 assertAuthority(tx:Tx,caller:RevisionScope,callerRole:DrainAuthorityRole,subject:RevisionScope,subjectRole:DrainAuthorityRole):Promise<()=>void>;
 /** Mandatory trusted DB-only verifier of exact candidate/parent/manifest and pre-existing admission. No production adapter is supplied. */
 verifyPlan?(tx:Tx,scope:RevisionScope,plan:DrainDecisionPlan):Promise<()=>void>;
 /** Mandatory existing operation/profile/source authority, not a slot-based grant. */
 verifyOperation?(tx:Tx,scope:RevisionScope,binding:DrainOutboundBinding):Promise<()=>void>;
 /** Supported exact terminal/no-future-effect evidence only; receipt/cancellation acknowledgement is insufficient. */
 verifyQuiescence?(tx:Tx,scope:RevisionScope,binding:DrainOutboundBinding,observationDigest:string):Promise<()=>void>;
}
/** Local protocol foundation only: no activation, runtime qualification, provider
 * adapter, timeout clearance, replay, token storage or execution permission. */
export function createEnrollmentDrainStore(repo:ReleaseOperationPlanRepo,deps:EnrollmentDrainPorts){
 const ready=()=>{deps.signal.throwIfAborted();if(!Number.isFinite(Date.now()))fail()};
 async function proof(fn:(()=>Promise<()=>void>)|undefined){ready();if(!fn)fail();const fresh=await fn();if(typeof fresh!=='function')fail();ready();fresh();return()=>{ready();fresh();ready()}}
 async function authority(tx:Tx,caller:RevisionScope,role:DrainAuthorityRole,subject=caller,subjectRole=role){return proof(typeof deps.assertAuthority==='function'?()=>deps.assertAuthority(tx,structuredClone(caller),role,structuredClone(subject),subjectRole):undefined)}
 async function planProof(tx:Tx,s:RevisionScope,p:DrainDecisionPlan){return proof(deps.verifyPlan?()=>deps.verifyPlan!(tx,structuredClone(s),structuredClone(p)):undefined)}
 async function operationProof(tx:Tx,s:RevisionScope,b:DrainOutboundBinding){return proof(deps.verifyOperation?()=>deps.verifyOperation!(tx,structuredClone(s),structuredClone(b)):undefined)}
 const clock=drainDatabaseClock;
 async function transaction<T>(raw:RevisionScope,fn:(tx:Tx,s:RevisionScope,retain:(f:()=>void)=>void)=>Promise<T>,publish?:((consumeFresh:()=>void)=>void)){const s=drainScopeSchema.parse(raw),deadline=Date.now()+15000;const within=()=>{ready();if(Date.now()>=deadline)fail()};within();let last:(()=>void)|undefined;const value=await repo.$transaction(async tx=>{await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+hash(s.organizationId)}))`;ready();return fn(tx,s,f=>{last=f})},{maxWait:15000,timeout:15000});if(!last)fail();within();last();within();if(publish){const fresh=last;let used=false;publish(()=>{if(used)fail();used=true;within();fresh();within()})}return value;}
 async function load(tx:Tx,s:RevisionScope,id:string){const row=await tx.durableAgentWorkflow.findFirst({where:{id,organizationId:s.organizationId}});if(!row)fail();return history(tx,row)}
 async function barrier(tx:Tx,s:RevisionScope){return loadDrainBarrier(tx,s.organizationId)}
 async function append(tx:Tx,row:Row,actor:RevisionScope,prior:any){await tx.durableAgentWorkflowEvent.create({data:{organizationId:row.organizationId,workflowRunId:row.id,sequence:row.version,eventType:row.workflowKind+'.'+(row.stateJson as any).status,actorKind:'user',actorId:actor.actorUserId,detailJson:{inputDigest:hash(row.inputJson),stateDigest:hash(row.stateJson),previousStateDigest:prior===null?null:hash(prior),expectedVersion:row.version===0?null:row.version-1,state:row.stateJson,actor},occurredAt:row.updatedAt}})}
 async function create(tx:Tx,s:RevisionScope,id:string,kind:string,input:any,state:any,at:Date){validStep(kind,null,state,input,s);const row=await tx.durableAgentWorkflow.create({data:{id,organizationId:s.organizationId,workflowKind:kind,objective:'Governance drain protocol metadata; no execution authority',requestedByUserId:s.actorUserId,autonomyLevel:'observe',status:'paused_for_input',currentStep:state.status,inputJson:input,stateJson:state,attemptCount:0,maxAttempts:1,version:0,leaseOwner:null,leaseExpiresAt:null,approvalProposalId:null,createdAt:at,updatedAt:at}});await append(tx,row,s,null);return row;}
 async function update(tx:Tx,s:RevisionScope,x:Awaited<ReturnType<typeof history>>,state:any,at:Date){if(x.row.version>=127)fail();validStep(x.row.workflowKind,x.state,state,x.input,s);const consumed=x.row.workflowKind===DECISION&&state.status==='consumed',complete=consumed||state.status==='aborted'||state.status==='quiescent';const data={stateJson:state,currentStep:state.status,status:complete?'completed':'paused_for_input',attemptCount:consumed?1:0,version:{increment:1},updatedAt:at};const result=await tx.durableAgentWorkflow.updateMany({where:{id:x.row.id,organizationId:s.organizationId,workflowKind:x.row.workflowKind,version:x.row.version,inputJson:{equals:x.input},stateJson:{equals:x.state},attemptCount:x.row.attemptCount,leaseOwner:null,leaseExpiresAt:null},data});if(result.count!==1)fail();const row={...x.row,...data,version:x.row.version+1};await append(tx,row,s,x.state);return row;}
 /** One actual operation has one attempt in the current merge profile. The
  * canonical slot itself persists its server nonce; query under the org lock,
  * never a process cache, recovers that immutable association after lost ack. */
 async function findAttempt(tx:Tx,s:RevisionScope,operationId:string){
  const rows=await tx.durableAgentWorkflow.findMany({where:{organizationId:s.organizationId,workflowKind:SLOT,inputJson:{path:['binding','operationId'],equals:operationId}},orderBy:[{id:'asc'}],take:2});
  if(rows.length>1)fail();
  if(!rows.length)return null;
  const x=await history(tx,rows[0]),input=slotInput.parse(x.input);
  if(input.scope.organizationId!==s.organizationId||input.binding.operationId!==operationId)fail();
  return {...x,slot:input};
 }
 async function reserveLocked(tx:Tx,s:RevisionScope,b:DrainOutboundBinding,retain:(f:()=>void)=>void){
  const a=await authority(tx,s,'reader'),v=await operationProof(tx,s,b),bar=await barrier(tx,s);
  if(bar&&bar.state.status!=='aborted')fail();
  const epoch=bar?transitionState.parse(bar.state).epoch:null,id='governance_outbound_'+hash({organizationId:s.organizationId,serverNonce:b.serverNonce});
  if(await tx.durableAgentWorkflow.findFirst({where:{id}}))fail();
  const at=await clock(tx),row=await create(tx,s,id,SLOT,{format:1,scope:s,binding:b,epoch,createdAt:at.toISOString()},{status:'reserved'},at);
  await clock(tx);const fresh=()=>{a();v()};fresh();retain(fresh);return drainRecordView(row);
 }
 const view=drainRecordView;
 function live(plan:DrainDecisionPlan,at:Date){ready();const expiry=Date.parse(plan.expiresAt);if(!Number.isFinite(expiry)||Date.now()>=expiry||at.getTime()>=expiry)fail();}
 async function principals(tx:Tx,s:RevisionScope,callerRole:DrainAuthorityRole,x:Awaited<ReturnType<typeof history>>){const input=decisionInput.parse(x.input),p=input.plan;const fs=[await authority(tx,s,callerRole,input.scope,'administrator')];if(x.state.status!=='proposed'){const reviewer=decisionState.parse(x.state);if(reviewer.status==='proposed')fail();if(reviewer.reviewer.actorUserId!==p.reviewerUserId||reviewer.reviewer.organizationId!==s.organizationId)fail();fs.push(await authority(tx,s,callerRole,reviewer.reviewer,'reviewer'))}return()=>fs.forEach(f=>f())}
 return{
  async prepareDecision(raw:RevisionScope,rawPlan:DrainDecisionPlan,nonce:string){const p=drainDecisionPlanSchema.parse(rawPlan);z.string().uuid().parse(nonce);return transaction(raw,async(tx,s,retain)=>{if(p.organizationId!==s.organizationId||p.requesterUserId!==s.actorUserId)fail();const a=await authority(tx,s,'administrator'),v=await planProof(tx,s,p),at=await clock(tx);live(p,at);const id='governance_drain_decision_'+hash({organizationId:s.organizationId,plan:p,nonce});if(await tx.durableAgentWorkflow.findFirst({where:{id}}))fail();const row=await create(tx,s,id,DECISION,{format:1,scope:s,plan:p,nonce,createdAt:at.toISOString()},{status:'proposed'},at);const end=await clock(tx);const fresh=()=>{a();v();live(p,end)};fresh();retain(fresh);return view(row)})},
  async approveDecision(raw:RevisionScope,id:string){drainDecisionIdSchema.parse(id);return transaction(raw,async(tx,s,retain)=>{const x=await load(tx,s,id),input=decisionInput.parse(x.input),p=input.plan;if(x.state.status!=='proposed'||s.actorUserId!==p.reviewerUserId||s.actorUserId===p.requesterUserId)fail();const a=await principals(tx,s,'reviewer',x),r=await authority(tx,s,'reviewer'),v=await planProof(tx,s,p),at=await clock(tx);live(p,at);const row=await update(tx,s,x,{status:'approved',reviewer:s},at);const end=await clock(tx);const fresh=()=>{a();r();v();live(p,end)};fresh();retain(fresh);return view(row)})},
  async begin(raw:RevisionScope,id:string){return execute(raw,id,'begin')},
  async abort(raw:RevisionScope,id:string){return execute(raw,id,'abort')},
  async reserve(raw:RevisionScope,rawBinding:DrainOutboundBinding){const b=outboundBindingSchema.parse(rawBinding);return transaction(raw,(tx,s,retain)=>reserveLocked(tx,s,b,retain))},
  /** New operations only; an existing reserved/unknown/terminal slot is never
   * reused to mint, resend, replace history or escape an uncertain commit. */
  async reserveAttempt(raw:RevisionScope,rawBinding:Omit<DrainOutboundBinding,'serverNonce'>){
   const b=outboundBindingSchema.omit({serverNonce:true}).parse(rawBinding);
   return transaction(raw,async(tx,s,retain)=>{
    const a=await authority(tx,s,'reader');
    if(await findAttempt(tx,s,b.operationId))fail();
    a();return reserveLocked(tx,s,{...b,serverNonce:randomUUID()},retain);
   });
  },
  /** Read-only lost-ack/restart association. It grants no replay capability. */
  async readAttempt(raw:RevisionScope,operationId:string,attemptId:string){
   identifier.parse(operationId);identifier.parse(attemptId);
   return transaction(raw,async(tx,s,retain)=>{
    let a=await authority(tx,s,'reader');const x=await findAttempt(tx,s,operationId);
    if(!x||x.slot.binding.attemptId!==attemptId)fail();
    a=await authority(tx,s,'reader');await clock(tx);a();retain(a);
    return structuredClone({...view(x.row),kind:'slot' as const,binding:x.slot.binding,originalScope:x.slot.scope});
   });
  },
  async markSubmissionIntent(raw:RevisionScope,id:string,publishFreshness?:(consumeFresh:()=>void)=>void){return slotChange(raw,id,'submission_intent',undefined,publishFreshness)},
  async markUnknown(raw:RevisionScope,id:string){return slotChange(raw,id,'unknown')},
  async observeQuiescent(raw:RevisionScope,id:string,observationDigest:string){digestSchema.parse(observationDigest);return slotChange(raw,id,'quiescent',observationDigest)},
  /** Deliberate lost-ack recovery: current reader only, no provider/source
   * requalification, decision consumption, event write, retry or deadline reset. */
  async readSaved(raw:RevisionScope,id:string){drainSavedIdSchema.parse(id);return transaction(raw,async(tx,s,retain)=>{let a=await authority(tx,s,'reader');const x=await load(tx,s,id);let details;
   if(x.row.workflowKind===DECISION){const input=decisionInput.parse(x.input),state=decisionState.parse(x.state);details={kind:'decision' as const,plan:input.plan,originalScope:input.scope,reviewerScope:state.status==='proposed'?null:state.reviewer};}
   else if(x.row.workflowKind===SLOT){const input=slotInput.parse(x.input),state=slotState.parse(x.state);details={kind:'slot' as const,binding:input.binding,originalScope:input.scope,observationDigest:state.status==='quiescent'?state.observationDigest:null};}
   else{const state=transitionState.parse(x.state);details={kind:'transition' as const,plan:state.plan,decisionId:state.decisionId};}
   a=await authority(tx,s,'reader');await clock(tx);a();retain(a);return structuredClone({...view(x.row),...details});})},
  async readBlockers(raw:RevisionScope){return transaction(raw,async(tx,s,retain)=>{let readerFresh:(()=>void)|undefined;const result=await readEnrollmentDrainBlockersLocked(tx,s.organizationId,{signal:deps.signal,assertCurrent:async(t,org)=>{if(org!==s.organizationId)fail();readerFresh=await authority(t,s,'reader');return readerFresh}});if(!readerFresh)fail();readerFresh();retain(readerFresh);return result})},
 };
 async function execute(raw:RevisionScope,id:string,kind:'begin'|'abort'){drainDecisionIdSchema.parse(id);return transaction(raw,async(tx,s,retain)=>{const x=await load(tx,s,id),input=decisionInput.parse(x.input),p=input.plan;if(p.kind!==kind||x.state.status!=='approved'||!same(input.scope,s))fail();const a=await principals(tx,s,'administrator',x),v=await planProof(tx,s,p),bar=await barrier(tx,s);if(kind==='begin'){if(p.kind!=='begin'||(bar?.row.version??null)!==p.expectedVersion||bar&&(bar.state.status!=='aborted'||bar.epochs.includes(p.epoch)))fail()}else if(p.kind!=='abort'||!bar||bar.row.version!==p.expectedVersion||bar.state.status!=='draining'||transitionState.parse(bar.state).epoch!==p.epoch||transitionState.parse(bar.state).preExistingAdmissionDigest!==p.preExistingAdmissionDigest)fail();const at=await clock(tx);live(p,at);const approved=decisionState.parse(x.state);if(approved.status!=='approved')fail();await update(tx,s,x,{status:'consumed',reviewer:approved.reviewer},at);const state={status:kind==='begin'?'draining':'aborted',plan:p,decisionId:id,epoch:p.epoch,preExistingAdmissionDigest:p.preExistingAdmissionDigest},row=bar?await update(tx,s,bar,state,at):await create(tx,s,'governance_transition_'+hash(s.organizationId),TRANSITION,{format:1,organizationId:s.organizationId,createdAt:at.toISOString()},state,at);const end=await clock(tx);const fresh=()=>{a();v();live(p,end)};fresh();retain(fresh);return view(row)})}
 async function slotChange(raw:RevisionScope,id:string,status:'submission_intent'|'unknown'|'quiescent',observationDigest?:string,publishFreshness?:(consumeFresh:()=>void)=>void){drainSlotIdSchema.parse(id);return transaction(raw,async(tx,s,retain)=>{const x=await load(tx,s,id),input=slotInput.parse(x.input);if(input.scope.organizationId!==s.organizationId||status!=='quiescent'&&!same(input.scope,s))fail();const a=await authority(tx,s,'reader');let v:()=>void=()=>{};if(status==='submission_intent'){if(x.state.status!=='reserved')fail();const bar=await barrier(tx,s);if(bar&&bar.state.status!=='aborted'||(bar?transitionState.parse(bar.state).epoch:null)!==input.epoch)fail();v=await operationProof(tx,s,input.binding)}else if(status==='quiescent'){v=await proof(deps.verifyQuiescence&&observationDigest?()=>deps.verifyQuiescence!(tx,structuredClone(s),structuredClone(input.binding),observationDigest):undefined)}const at=await clock(tx),row=await update(tx,s,x,status==='quiescent'?{status,observationDigest}:{status},at);await clock(tx);const fresh=()=>{a();v()};fresh();retain(fresh);return view(row)},publishFreshness)}
}
