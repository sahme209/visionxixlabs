import {assertNoGovernanceEnrollmentForMutation} from '@/lib/governance/intelligence/enrollmentMetadata';
import {assertBotActionTaskBinding} from '@/lib/axiom/bot/actionTaskBinding';
import 'server-only';
import {z} from 'zod';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction as Tx,ReleaseOperationPlanRow as Row} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {CONNECTED_ACTION_KIND as KIND,connectedActionIntentSchema,connectedActionScopeSchema,connectedActionApprovalSchema,connectedActionResultSchema,connectedActionDtoSchema,type ConnectedActionIntent as Intent,type ConnectedActionScope as Scope,type ConnectedActionResult as Result} from './connectedActionContract';
import {connectedActionId} from './connectedActionIdentity';

type Approval=z.infer<typeof connectedActionApprovalSchema>;
export interface ConnectedActionStorePorts{
 /** Must check and lock live desktop session/membership, the saved connection and
  * the distinct approver's current accepted authority before execution. */
 assertCurrent?:(tx:Tx,scope:Scope,intent:Intent,role:'read'|'request'|'approve'|'execute',approval?:Approval)=>Promise<void>;
 /** Rebuild from current trusted target discovery, never echo a client assertion. */
 readCurrentIntent?:(tx:Tx,scope:Scope,intent:Intent)=>Promise<unknown>;
 /** Retain the original server discovery window; no I/O or serialized authority. */
 captureCurrentIntentFreshness?:(scope:Scope,intent:Intent)=>()=>void;
 now?:()=>Date;
}
const inputSchema=z.object({format:z.literal(1),intent:connectedActionIntentSchema,intentDigest:z.string().regex(/^[a-f0-9]{64}$/),requesterSessionId:z.string().min(1),requestedAt:z.string().datetime()}).strict();
const stateSchema=z.object({state:z.enum(['requested','approved','dispatching','confirmed','unknown','refused','cancelled']),approval:connectedActionApprovalSchema.optional(),receipt:connectedActionResultSchema.options[0].shape.receipt.optional()}).strict();
const equal=(a:unknown,b:unknown)=>hash(a)===hash(b);
const refuse=():never=>{throw Error('connected_action_unavailable')};
const status=(s:string)=>s==='requested'?'paused_for_approval':s==='approved'?'paused_for_input':s==='dispatching'?'running':s==='cancelled'?'cancelled':s==='confirmed'?'completed':'failed';
export function createConnectedActionStore(repo:ReleaseOperationPlanRepo,ports:ConnectedActionStorePorts={}){
 const now=()=>{const value=ports.now?.()??new Date();if(!Number.isFinite(value.getTime()))refuse();return value};
 function unpack(row:Row){
  const i=inputSchema.parse(row.inputJson),s=stateSchema.parse(row.stateJson),intent=i.intent;
  const version=s.state==='requested'?0:s.state==='approved'?1:s.state==='dispatching'?2:s.state==='cancelled'?(s.approval?2:1):3;
  const attempted=['dispatching','confirmed','unknown','refused'].includes(s.state);
  if(row.id!==connectedActionId(intent)||row.organizationId!==intent.organizationId||row.workflowKind!==KIND||row.requestedByUserId!==intent.requesterUserId||intent.executorUserId!==intent.requesterUserId||i.intentDigest!==hash(intent)||row.version!==version||row.currentStep!==s.state||row.status!==status(s.state)||row.attemptCount!==(attempted?1:0)||row.maxAttempts!==1||row.approvalProposalId!==null||row.createdAt.toISOString()!==i.requestedAt||!!s.approval!==(attempted||s.state==='approved'||s.state==='cancelled'&&version===2)||!!s.receipt!==(s.state==='confirmed'))refuse();
  if(s.approval&&(s.approval.intentDigest!==i.intentDigest||s.approval.approverUserId===intent.requesterUserId||s.approval.approverUserId===intent.executorUserId||s.approval.expiresAt!==intent.expiresAt||Date.parse(s.approval.approvedAt)>=Date.parse(s.approval.expiresAt)))refuse();
  if(s.state==='dispatching'?(row.leaseOwner!==intent.executorUserId||!row.leaseExpiresAt||row.leaseExpiresAt.getTime()>Date.parse(intent.expiresAt)):row.leaseOwner!==null||row.leaseExpiresAt!==null)refuse();
  if(s.receipt){const receipt=s.receipt;
   if(intent.provider==='outlook'){if(receipt.provider!=='outlook')return refuse();if(receipt.accountId!==intent.accountId||receipt.kind!==intent.kind)refuse();if(receipt.kind==='outlook_event_create'){const u=new URL(receipt.url);if(u.protocol!=='https:'||u.username||u.password||u.port||!['outlook.live.com','outlook.office.com','outlook.office365.com'].includes(u.hostname))refuse()}}
   else {if(receipt.provider==='outlook')return refuse();if(receipt.provider!==intent.provider||receipt.teamId!==intent.teamId||intent.provider==='teams'&&(receipt.provider!=='teams'||receipt.channelId!==intent.channelId)||intent.provider==='linear'&&intent.kind!=='linear_issue_create'&&(receipt.provider!=='linear'||receipt.issueId!==intent.issueId))refuse();const url=new URL(receipt.url);if(url.protocol!=='https:'||url.username||url.password||url.port||url.hostname!==(intent.provider==='teams'?'teams.microsoft.com':'linear.app'))refuse()}
  }
  return{i,s};
 }
 async function authority(tx:Tx,scope:Scope,row:Row,role:'read'|'request'|'approve'|'execute'){
  const{i,s}=unpack(row);if(scope.organizationId!==row.organizationId||!ports.assertCurrent)refuse();
  if(role==='request'&&scope.actorUserId!==i.intent.requesterUserId||role==='approve'&&[i.intent.requesterUserId,i.intent.executorUserId].includes(scope.actorUserId)||role==='execute'&&scope.actorUserId!==i.intent.executorUserId)refuse();
  await ports.assertCurrent!(tx,structuredClone(scope),structuredClone(i.intent),role,s.approval&&structuredClone(s.approval));
 }
 async function live(tx:Tx,scope:Scope,row:Row,role:'request'|'approve'|'execute'){
  await authority(tx,scope,row,role);await assertBotActionTaskBinding(tx,scope.organizationId,unpack(row).i.intent.requesterUserId,unpack(row).i.intent.sourceTask);if(!ports.readCurrentIntent)refuse();const{i}=unpack(row);
  if(!equal(connectedActionIntentSchema.parse(await ports.readCurrentIntent!(tx,scope,structuredClone(i.intent))),i.intent))refuse();
  await authority(tx,scope,row,role);const end=new Date(i.intent.expiresAt);if(now()>=end)refuse();const times=await tx.$queryRaw<Array<{live:boolean}>>`SELECT clock_timestamp()<${end} AS "live"`;if(times.length!==1||!times[0].live)refuse();
 }
 async function load(tx:Tx,scope:Scope,id:string){
  if(!/^connected_action_[a-f0-9]{64}$/.test(id))refuse();
  const rows=await tx.$queryRaw<Row[]>`SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${id} AND "organizationId"=${scope.organizationId} AND "workflowKind"=${KIND} FOR UPDATE`;
  if(rows.length!==1)refuse();const row=rows[0],{i,s}=unpack(row);
  const events=await tx.durableAgentWorkflowEvent.findMany({where:{workflowRunId:id,organizationId:scope.organizationId},orderBy:{sequence:'asc'},take:5});
  const steps=['requested',s.state==='cancelled'&&row.version===1?'cancelled':'approved',s.state==='cancelled'?'cancelled':'dispatching',s.state];
  if(events.length!==row.version+1||events.some((e,n)=>e.sequence!==n||e.workflowRunId!==id||e.organizationId!==scope.organizationId||e.actorKind!=='user'||e.actorId!==(n===1&&steps[n]==='approved'?s.approval?.approverUserId:i.intent.requesterUserId)||e.eventType!=='connected_action.'+steps[n]||!equal(e.detailJson,{intentDigest:i.intentDigest})||!Number.isFinite(e.occurredAt.getTime())))refuse();
  return row;
 }
 function dto(row:Row){const{i,s}=unpack(row);return connectedActionDtoSchema.parse({id:row.id,intent:i.intent,intentDigest:i.intentDigest,...s,version:row.version,attemptCount:row.attemptCount,leaseExpiresAt:row.leaseExpiresAt?.toISOString()??null})}
 async function event(tx:Tx,row:Row,actor:string){const{i}=unpack(row);await tx.durableAgentWorkflowEvent.create({data:{workflowRunId:row.id,organizationId:row.organizationId,sequence:row.version,eventType:'connected_action.'+row.currentStep,actorKind:'user',actorId:actor,detailJson:{intentDigest:i.intentDigest},occurredAt:row.updatedAt}})}
 async function change(tx:Tx,row:Row,state:z.infer<typeof stateSchema>,actor:string,lease:Date|null=null){
  const data={stateJson:state,currentStep:state.state,status:status(state.state),version:{increment:1},attemptCount:['dispatching','confirmed','unknown','refused'].includes(state.state)?1:0,leaseOwner:state.state==='dispatching'?unpack(row).i.intent.executorUserId:null,leaseExpiresAt:lease,updatedAt:now()};
  const result=await tx.durableAgentWorkflow.updateMany({where:{id:row.id,organizationId:row.organizationId,workflowKind:KIND,version:row.version,inputJson:{equals:row.inputJson},stateJson:{equals:row.stateJson},attemptCount:row.attemptCount},data});if(result.count!==1)refuse();
  const next={...row,...data,version:row.version+1};unpack(next);await event(tx,next,actor);return next;
 }
 async function readClaimedConnectedOutboundLocked(tx:Tx,rawScope:Scope,id:string,rawIntent:Intent,profile:'teams.channel_message.v1'|'linear.issue_create.v1'){
  const wall=Date.now();if(!Number.isFinite(wall))refuse();
  const scope=connectedActionScopeSchema.parse(rawScope),intent=connectedActionIntentSchema.parse(rawIntent);
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+hash(scope.organizationId)}))`;
  const row=await load(tx,scope,id),{i,s}=unpack(row);
  if(profile==='teams.channel_message.v1'?(intent.kind!=='teams_channel_message'||intent.provider!=='teams'):(intent.kind!=='linear_issue_create'||intent.provider!=='linear'))return refuse();
  if(intent.provider!=='teams'&&intent.provider!=='linear')return refuse();
  if(!equal(intent,i.intent)||s.state!=='dispatching'||row.attemptCount!==1||row.leaseOwner!==i.intent.executorUserId||!row.leaseExpiresAt||!s.approval||scope.actorUserId!==i.intent.executorUserId||!ports.captureCurrentIntentFreshness)refuse();
  await live(tx,scope,row,'execute');
  // This profile remains uncovered: current enrollment always refuses under the same org lock.
  await assertNoGovernanceEnrollmentForMutation(tx,scope.organizationId);
  const sourceFresh=ports.captureCurrentIntentFreshness!(scope,structuredClone(i.intent));if(typeof sourceFresh!=='function')refuse();sourceFresh();
  const approval=s.approval!;
  const sessions=await tx.$queryRaw<Array<{id:string;userId:string;organizationId:string;expiresAt:Date;revokedAt:Date|null;now:Date}>>`SELECT "id","userId","organizationId","expiresAt","revokedAt",clock_timestamp() AS "now" FROM "DesktopSessionRecord" WHERE "organizationId"=${scope.organizationId} AND (("id"=${scope.sessionId} AND "userId"=${scope.actorUserId}) OR ("id"=${approval.approverSessionId} AND "userId"=${approval.approverUserId})) FOR SHARE`;
  if(sessions.length!==2||!sessions.some(v=>v.id===scope.sessionId&&v.userId===scope.actorUserId)||!sessions.some(v=>v.id===approval.approverSessionId&&v.userId===approval.approverUserId)||sessions.some(v=>v.organizationId!==scope.organizationId||v.revokedAt!==null||!(v.expiresAt instanceof Date)||!Number.isFinite(v.expiresAt.getTime())||!(v.now instanceof Date)||!Number.isFinite(v.now.getTime())||v.expiresAt<=v.now))refuse();
  const dbNow=Math.max(...sessions.map(v=>v.now.getTime())),remaining=Math.min(row.leaseExpiresAt!.getTime(),Date.parse(i.intent.expiresAt),Date.parse(approval.expiresAt),...sessions.map(v=>v.expiresAt.getTime()))-dbNow;
  const fresh=()=>{const elapsed=Date.now()-wall;if(!Number.isFinite(elapsed)||!Number.isFinite(remaining)||elapsed<0||elapsed>=remaining)refuse();sourceFresh()};fresh();
  return{fresh,attemptId:'connected_action_attempt_'+hash({operationId:row.id,attemptCount:row.attemptCount,intentDigest:i.intentDigest,approval}),sourceDigest:hash({intent:i.intent,approval}),targetDigest:hash({provider:intent.provider,workspaceId:intent.workspaceId,teamId:intent.teamId,...(intent.provider==='teams'?{channelId:intent.channelId}:{}),targetEvidenceDigest:intent.targetEvidenceDigest}),connectionId:intent.connectionId};
 }
 return{
 async request(rawScope:Scope,rawIntent:Intent){const scope=connectedActionScopeSchema.parse(rawScope),intent=connectedActionIntentSchema.parse(rawIntent),id=connectedActionId(intent);if(intent.organizationId!==scope.organizationId||intent.requesterUserId!==scope.actorUserId||intent.executorUserId!==scope.actorUserId)refuse();return repo.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},0))::text AS "locked"`;
  const old=await tx.durableAgentWorkflow.findFirst({where:{id,organizationId:scope.organizationId,workflowKind:KIND}});if(old){const row=await load(tx,scope,id);if(!equal({...intent,expiresAt:unpack(row).i.intent.expiresAt},unpack(row).i.intent))refuse();await authority(tx,scope,row,'read');return dto(row)}
  const at=now();if(Date.parse(intent.expiresAt)>at.getTime()+900000)refuse();
  const data:Row={id,organizationId:scope.organizationId,workflowKind:KIND,requestedByUserId:scope.actorUserId,status:'paused_for_approval',currentStep:'requested',inputJson:{format:1,intent,intentDigest:hash(intent),requesterSessionId:scope.sessionId,requestedAt:at.toISOString()},stateJson:{state:'requested'},attemptCount:0,maxAttempts:1,version:0,leaseOwner:null,leaseExpiresAt:null,approvalProposalId:null,createdAt:at,updatedAt:at};
  await live(tx,scope,data,'request');const row=await tx.durableAgentWorkflow.create({data:{...data,objective:'Review one exact connected-app action',autonomyLevel:'observe'}});await event(tx,row,scope.actorUserId);await live(tx,scope,row,'request');return dto(row);
 })},
 async get(rawScope:Scope,id:string){const scope=connectedActionScopeSchema.parse(rawScope);return repo.$transaction(async tx=>{const row=await load(tx,scope,id);await authority(tx,scope,row,'read');return dto(row)})},
 async approve(rawScope:Scope,id:string,expectedVersion:number){const scope=connectedActionScopeSchema.parse(rawScope);return repo.$transaction(async tx=>{const row=await load(tx,scope,id),{i,s}=unpack(row);if(row.version!==expectedVersion||s.state!=='requested')refuse();await live(tx,scope,row,'approve');const approval=connectedActionApprovalSchema.parse({approverUserId:scope.actorUserId,approverSessionId:scope.sessionId,intentDigest:i.intentDigest,approvedAt:now().toISOString(),expiresAt:i.intent.expiresAt});const next=await change(tx,row,{state:'approved',approval},scope.actorUserId);await live(tx,scope,next,'approve');return dto(next)})},
 async claim(rawScope:Scope,id:string,expectedVersion:number){const scope=connectedActionScopeSchema.parse(rawScope);return repo.$transaction(async tx=>{const row=await load(tx,scope,id),{i,s}=unpack(row);await authority(tx,scope,row,'read');if(s.state==='requested')refuse();if(s.state!=='approved')return{claimed:false as const,record:dto(row)};if(row.version!==expectedVersion||row.attemptCount!==0||!s.approval)refuse();await live(tx,scope,row,'execute');const lease=new Date(Math.min(now().getTime()+30000,Date.parse(i.intent.expiresAt)));const next=await change(tx,row,{...s,state:'dispatching'},scope.actorUserId,lease);await live(tx,scope,next,'execute');if(now()>=lease)refuse();return{claimed:true as const,record:dto(next)}})},
 async beforeDispatch(rawScope:Scope,id:string){const scope=connectedActionScopeSchema.parse(rawScope);return repo.$transaction(async tx=>{const row=await load(tx,scope,id);if(row.currentStep!=='dispatching'||!row.leaseExpiresAt||now()>=row.leaseExpiresAt)refuse();await live(tx,scope,row,'execute');return structuredClone(unpack(row).i.intent)})},
 /** Exact existing single-mutation profiles only; update/close remain uncovered. */
 readClaimedTeamsOutboundLocked:(tx:Tx,scope:Scope,id:string,intent:Intent)=>readClaimedConnectedOutboundLocked(tx,scope,id,intent,'teams.channel_message.v1'),
 readClaimedLinearCreateOutboundLocked:(tx:Tx,scope:Scope,id:string,intent:Intent)=>readClaimedConnectedOutboundLocked(tx,scope,id,intent,'linear.issue_create.v1'),
 async finish(rawScope:Scope,id:string,rawResult:Result){const scope=connectedActionScopeSchema.parse(rawScope),result=connectedActionResultSchema.parse(rawResult);return repo.$transaction(async tx=>{const row=await load(tx,scope,id),{s}=unpack(row);await authority(tx,scope,row,'read');if(scope.actorUserId!==unpack(row).i.intent.executorUserId)refuse();if(s.state!=='dispatching'){if(['confirmed','unknown','refused'].includes(s.state)&&equal({...result},s.receipt?{state:s.state,receipt:s.receipt}:{state:s.state}))return dto(row);refuse()}
  if(result.state==='confirmed'){if(!row.leaseExpiresAt||now()>=row.leaseExpiresAt)refuse();await live(tx,scope,row,'execute')}
  const next=await change(tx,row,{state:result.state,approval:s.approval,...(result.state==='confirmed'?{receipt:result.receipt}:{})},scope.actorUserId);
  if(result.state==='confirmed'){await live(tx,scope,next,'execute');if(!row.leaseExpiresAt||now()>=row.leaseExpiresAt)refuse()}
  return dto(next);
 })},
 async recover(rawScope:Scope,id:string,expectedVersion:number){const scope=connectedActionScopeSchema.parse(rawScope);return repo.$transaction(async tx=>{const row=await load(tx,scope,id),{s}=unpack(row);await authority(tx,scope,row,'read');if(scope.actorUserId!==unpack(row).i.intent.executorUserId||row.version!==expectedVersion)refuse();if(s.state!=='dispatching'||!row.leaseExpiresAt||now()<row.leaseExpiresAt)return dto(row);return dto(await change(tx,row,{state:'unknown',approval:s.approval},scope.actorUserId))})},
 async cancel(rawScope:Scope,id:string,expectedVersion:number){const scope=connectedActionScopeSchema.parse(rawScope);return repo.$transaction(async tx=>{const row=await load(tx,scope,id),{s,i}=unpack(row);await authority(tx,scope,row,'read');if(scope.actorUserId!==i.intent.requesterUserId||row.version!==expectedVersion||!['requested','approved'].includes(s.state))refuse();return dto(await change(tx,row,{...s,state:'cancelled'},scope.actorUserId))})},
 };
}
