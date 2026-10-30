import {matchHistoricalJiraLink} from '@/lib/releaseops/associatedTicketProof';
import {buildJiraCloseCandidate,type JiraTerminalDiscovery} from '@/lib/releaseops/jiraTicketCloseDiscovery';
import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {ticketReleaseAssociationSchema,type TicketReleaseAssociation,type TicketReviewScope} from '@/lib/releaseops/ticketGovernanceReviewContract';
import {ticketGovernanceReferenceSchema,type TicketGovernanceReference} from '@/lib/releaseops/ticketGovernanceReference';
import {buildAssociatedTicketLink} from '@/lib/releaseops/associatedTicketCandidate';
import {createJiraTicketLifecycleStore,JiraTicketSourceChanged} from '@/lib/releaseops/jiraTicketLifecycleStore';
import {createServiceNowTicketLifecycleStore,ServiceNowTicketSourceChanged} from '@/lib/releaseops/serviceNowTicketLifecycleStore';
import {parseJiraTicketActionCandidate,type JiraTicketActionCandidate} from '@/lib/releaseops/jiraTicketLifecycleContract';
import {parseServiceNowTicketActionCandidate,type ServiceNowTicketActionCandidate} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
import type {createTicketGovernanceService} from './ticketGovernanceService';
type Candidate=JiraTicketActionCandidate|ServiceNowTicketActionCandidate;
type Role='read'|'prepare'|'approve'|'execute';
export interface AssociatedTicketActionsPorts{
 governance:Pick<ReturnType<typeof createTicketGovernanceService>,'preflightApproved'|'readApprovedInTransaction'|'get'>;
 readOriginal:(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,binding:TicketReleaseAssociation)=>Promise<{candidate:unknown}>;
 authorize:(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,userId:string,role:Role,binding:TicketReleaseAssociation,candidate?:Readonly<Candidate>)=>Promise<void>;
 writeReady:(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,candidate:Readonly<Candidate>,binding:TicketReleaseAssociation)=>Promise<boolean>;
 /** Fixed server adapters only. Must check scopes/credential/journal readiness before claim. */
 preflightTransport?:(scope:TicketReviewScope,candidate:Readonly<Candidate>,binding:TicketReleaseAssociation,signal:AbortSignal)=>Promise<void>;
 executeTransport?:(id:string,candidate:Readonly<Candidate>,signal:AbortSignal,assertClaim:(candidate:Readonly<Candidate>,signal:AbortSignal)=>Promise<void>)=>Promise<{status:'confirmed'|'refused'|'unknown'}>;
 readJiraClosureDiscovery?:(scope:TicketReviewScope,candidate:Readonly<JiraTicketActionCandidate>,issue:{id:string;key:string},signal:AbortSignal)=>Promise<JiraTerminalDiscovery>;
 now?:()=>number;
}
const amendmentSchema=z.object({actionId:z.string().regex(/^(jira|servicenow)_action_[a-f0-9]{64}$/),expectedVersion:z.number().int().min(0).max(16)}).strict();
const mutation=z.object({actionId:z.string().regex(/^(jira|servicenow)_action_[a-f0-9]{64}$/),expectedVersion:z.number().int().min(0).max(2147483647),clientRequestId:z.string().uuid()}).strict();
/** One authenticated request, one exact association. Uses the existing durable
 * one-attempt stores and transports; no second execution or approval system. */
export function createAssociatedTicketActionsService(repo:ReleaseOperationPlanRepo,rawReference:TicketGovernanceReference,ports:AssociatedTicketActionsPorts){
 const reference=ticketGovernanceReferenceSchema.parse(rawReference),now=ports.now??Date.now;
 let hint:TicketReleaseAssociation|undefined;
 const sourceChanged=():never=>{throw hint?.ticket.provider==='servicenow'?new ServiceNowTicketSourceChanged():new JiraTicketSourceChanged()};
 function binding(){if(!hint)throw Error('ticket_association_preflight_required');return hint}
 function parse(raw:unknown){return binding().ticket.provider==='jira'?parseJiraTicketActionCandidate(raw):parseServiceNowTicketActionCandidate(raw)}
 async function warm(scope:TicketReviewScope,signal:AbortSignal){
  const proof=await ports.governance.preflightApproved(scope,reference,signal),a=ticketReleaseAssociationSchema.parse(proof.binding);
  if(proof.reviewId!==reference.reviewId||proof.bindingDigest!==reference.bindingDigest||sha256ContentHash(a)!==reference.bindingDigest||a.organizationId!==scope.organizationId)throw Error('ticket_association_changed');hint=a;signal.throwIfAborted();return a;
 }
 async function historyHint(scope:TicketReviewScope,signal:AbortSignal){
  const row=await ports.governance.get(scope,reference.reviewId,signal),a=ticketReleaseAssociationSchema.parse(row.binding);
  if(row.bindingDigest!==reference.bindingDigest||sha256ContentHash(a)!==reference.bindingDigest||a.organizationId!==scope.organizationId)throw Error('ticket_association_changed');hint=a;
 }
 async function approved(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,ref:TicketGovernanceReference){
  if(sha256ContentHash(ref)!==sha256ContentHash(reference))sourceChanged();
  const proof=await ports.governance.readApprovedInTransaction(tx,scope,reference);if(sha256ContentHash(proof.binding)!==reference.bindingDigest)sourceChanged();return proof;
 }
 async function current(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,raw:Readonly<Candidate>){
  try{const c=parse(raw);if(!('association'in c)||!c.association||sha256ContentHash(c.association)!==sha256ContentHash(reference))sourceChanged();
   const proof=await approved(tx,scope,reference),a=ticketReleaseAssociationSchema.parse(proof.binding),original=await ports.readOriginal(tx,scope,a);
   const expected=buildAssociatedTicketLink(reference,a,original.candidate,now());
   if(c.kind==='link')return expected;
   if(c.kind!=='close'||!('siteId'in c)||!c.linkedEvidenceActionId)throw new JiraTicketSourceChanged();
   const linked=await jira.readConfirmedLinkProvenance(scope,c.linkedEvidenceActionId,tx);
   matchHistoricalJiraLink(linked.candidate,expected);if(['organizationId','releaseId','releaseVersion','connectionId','connectionRevision','siteId','sourceDigest','expiresAt'].some(k=>(c as Record<string,unknown>)[k]!== (expected as Record<string,unknown>)[k]))sourceChanged();
   return c;
  }catch{sourceChanged()}
 }
 const common={now:()=>new Date(now()),transportMode:'provider' as const,readApprovedAssociation:approved,
  assertCurrent:async(tx:ReleaseOperationPlanTransaction,input:{scope:TicketReviewScope;actorUserId:string;role:Role;candidate?:Readonly<Candidate>})=>ports.authorize(tx,input.scope,input.actorUserId,input.role,binding(),input.candidate),
  readCurrentAction:current,
  readWriteReadiness:(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,candidate:Readonly<Candidate>)=>ports.writeReady(tx,scope,candidate,binding())};
 const jira=createJiraTicketLifecycleStore(repo,common),sn=createServiceNowTicketLifecycleStore(repo,common);
 const store=()=>binding().ticket.provider==='jira'?jira:sn;
 async function selected(scope:TicketReviewScope,id:string){
  if(!new RegExp(`^${binding().ticket.provider==='jira'?'jira':'servicenow'}_action_[a-f0-9]{64}$`).test(id))throw Error('ticket_associated_action_unavailable');
  const row=await repo.durableAgentWorkflow.findFirst({where:{id,organizationId:scope.organizationId}});if(!row)throw Error('ticket_associated_action_unavailable');
  const raw=z.object({candidate:z.unknown()}).passthrough().parse(row.inputJson),candidate=parse(raw.candidate);
  if(!('association'in candidate)||!candidate.association||sha256ContentHash(candidate.association)!==sha256ContentHash(reference))throw Error('ticket_associated_action_unavailable');return candidate;
 }
 async function closeDiscovery(scope:TicketReviewScope,linkId:string,signal:AbortSignal){
  const a=await warm(scope,signal);if(a.ticket.provider!=='jira'||scope.actorUserId!==a.executorUserId||!ports.readJiraClosureDiscovery)throw Error('ticket_closure_unavailable');
  const {link,candidate}=await repo.$transaction(async tx=>{const proof=await approved(tx,scope,reference),original=await ports.readOriginal(tx,scope,ticketReleaseAssociationSchema.parse(proof.binding)),fresh=buildAssociatedTicketLink(reference,proof.binding,original.candidate,now()),link=await jira.readConfirmedLinkProvenance(scope,linkId,tx);matchHistoricalJiraLink(link.candidate,fresh);if(!('siteId'in fresh)||fresh.kind!=='link')throw Error('ticket_closure_unavailable');return{link,candidate:fresh}});
  const discovery=await ports.readJiraClosureDiscovery(scope,candidate,candidate.issue,signal);signal.throwIfAborted();await repo.$transaction(async tx=>{await approved(tx,scope,reference);const latest=await jira.readConfirmedLinkProvenance(scope,linkId,tx);if(sha256ContentHash(latest)!==sha256ContentHash(link))throw Error('ticket_link_changed')});return{link,candidate,discovery};
 }

 return{
  async prepareLink(scope:TicketReviewScope,clientRequestId:string,signal:AbortSignal,amendment?:{actionId:string;expectedVersion:number}){
   z.string().uuid().parse(clientRequestId);const a=await warm(scope,signal);if(scope.actorUserId!==a.executorUserId||a.requesterUserId!==a.executorUserId)throw Error('ticket_executor_required');
   const candidate=await repo.$transaction(async tx=>{await approved(tx,scope,reference);await ports.authorize(tx,scope,scope.actorUserId,'prepare',a);return buildAssociatedTicketLink(reference,a,(await ports.readOriginal(tx,scope,a)).candidate,now())});
   signal.throwIfAborted();if(amendment)return store().amend(scope,{...amendmentSchema.parse(amendment),candidate,executorUserId:a.executorUserId,clientRequestId});return store().prepare(scope,{candidate,executorUserId:a.executorUserId,clientRequestId});
  },
  async list(scope:TicketReviewScope,signal:AbortSignal){
   try{await warm(scope,signal)}catch{signal.throwIfAborted();await historyHint(scope,signal)}
   const rows=await repo.durableAgentWorkflow.findMany({where:{organizationId:scope.organizationId,workflowKind:binding().ticket.provider==='jira'?'jira_ticket_action_v1':'servicenow_ticket_action_v1',AND:[{inputJson:{path:['candidate','association','reviewId'],equals:reference.reviewId}},{inputJson:{path:['candidate','association','bindingDigest'],equals:reference.bindingDigest}}]},orderBy:[{createdAt:'desc'},{id:'desc'}],take:6});
   const actions=[];for(const row of rows.slice(0,5)){signal.throwIfAborted();await selected(scope,row.id);actions.push(await store().get(scope,row.id))}const acceptedLinks:Array<{id:string;version:number;issueKey:string;runUrl:string;sourceCommit:string;evidenceId:string;evidenceDigest:string;originalAssociationReviewId:string;readOnly:true}>=[];
   if(binding().ticket.provider==='jira'){
    const matches=await repo.durableAgentWorkflow.findMany({where:{organizationId:scope.organizationId,workflowKind:'jira_ticket_action_v1',currentStep:'confirmed',AND:[{inputJson:{path:['candidate','kind'],equals:'link'}},{inputJson:{path:['candidate','publishActionId'],equals:binding().original.actionId}},{inputJson:{path:['candidate','evidence','id'],equals:binding().deployment.evidenceId}}]},orderBy:[{createdAt:'desc'},{id:'desc'}],take:6});
    for(const row of matches.slice(0,5)){try{const item=await repo.$transaction(async tx=>{const proof=await approved(tx,scope,reference),original=await ports.readOriginal(tx,scope,ticketReleaseAssociationSchema.parse(proof.binding)),fresh=buildAssociatedTicketLink(reference,proof.binding,original.candidate,now()),saved=await jira.readConfirmedLinkProvenance(scope,row.id,tx);matchHistoricalJiraLink(saved.candidate,fresh);return saved});const c=item.candidate;if(c.kind==='link'&&c.association)acceptedLinks.push({id:item.actionId,version:item.actionVersion,issueKey:c.issue.key,runUrl:c.evidence.url,sourceCommit:c.evidence.headSha,evidenceId:c.evidence.id,evidenceDigest:c.evidence.digest,originalAssociationReviewId:c.association.reviewId,readOnly:true})}catch{signal.throwIfAborted()}}
   }
   const refreshableDrafts:Array<{id:string;version:number;kind:'link'|'close';readOnly:true}>=[];
   const priorDrafts=await repo.durableAgentWorkflow.findMany({where:{organizationId:scope.organizationId,workflowKind:binding().ticket.provider==='jira'?'jira_ticket_action_v1':'servicenow_ticket_action_v1',attemptCount:0,AND:[{inputJson:{path:['candidate','releaseId'],equals:binding().original.releaseId}},{inputJson:{path:['candidate','publishActionId'],equals:binding().original.actionId}}]},orderBy:[{createdAt:'desc'},{id:'desc'}],take:6});
   for(const row of priorDrafts.slice(0,5)){const prior=parse(z.object({candidate:z.unknown()}).passthrough().parse(row.inputJson).candidate);if(prior.kind==='publish'||prior.kind==='link'&&prior.evidence.id!==binding().deployment.evidenceId)continue;const saved=await store().get(scope,row.id);if(saved.kind!=='publish'&&saved.canAmend&&saved.attemptCount===0)refreshableDrafts.push({id:saved.id,version:saved.version,kind:saved.kind,readOnly:true})}
   return{provider:binding().ticket.provider,actions,truncated:rows.length>5,acceptedLinks,refreshableDrafts};
  },
  async closeOptions(scope:TicketReviewScope,linkId:string,signal:AbortSignal){const {link,discovery}=await closeDiscovery(scope,linkId,signal),closeId='jira_action_'+sha256ContentHash({organizationId:scope.organizationId,releaseId:binding().original.releaseId,kind:'close'}),prior=await repo.durableAgentWorkflow.findFirst({where:{id:closeId,organizationId:scope.organizationId,workflowKind:'jira_ticket_action_v1'}});let amendment:{actionId:string;expectedVersion:number}|undefined,blockedByConsumedAction=false;if(prior){const saved=await jira.get(scope,closeId);if(saved.canAmend&&saved.attemptCount===0)amendment={actionId:saved.id,expectedVersion:saved.version};else blockedByConsumedAction=true}return{linkActionId:linkId,linkVersion:link.actionVersion,expiresAt:discovery.expiresAt,transitions:discovery.transitions.map(t=>({id:t.id,label:t.name,targetStatusLabel:t.targetStatusName})),...(amendment?{amendment}:{}),...(blockedByConsumedAction?{blockedByConsumedAction:true as const}:{})}},
  async prepareClose(scope:TicketReviewScope,linkId:string,expectedLinkVersion:number,transitionId:string,clientRequestId:string,signal:AbortSignal,amendment?:{actionId:string;expectedVersion:number}){
   z.string().uuid().parse(clientRequestId);z.number().int().min(0).parse(expectedLinkVersion);z.string().regex(/^[0-9]{1,20}$/).parse(transitionId);
   const {link,candidate,discovery}=await closeDiscovery(scope,linkId,signal);if(link.actionVersion!==expectedLinkVersion)throw Error('ticket_link_changed');
   const close=parseJiraTicketActionCandidate({...buildJiraCloseCandidate(candidate,candidate.publishActionId,candidate.issue,discovery,transitionId,now()),association:reference,linkedEvidenceActionId:linkId});
   signal.throwIfAborted();if(amendment)return jira.amend(scope,{...amendmentSchema.parse(amendment),candidate:close,executorUserId:binding().executorUserId,clientRequestId});return jira.prepare(scope,{candidate:close,executorUserId:binding().executorUserId,clientRequestId});
  },
  async get(scope:TicketReviewScope,id:string,signal:AbortSignal){try{await warm(scope,signal)}catch{signal.throwIfAborted();await historyHint(scope,signal)}await selected(scope,id);return store().get(scope,id)},
  async mutate(scope:TicketReviewScope,raw:unknown,mode:'approve'|'cancel'|'dispatch'|'recover',signal:AbortSignal){
   const input=mutation.parse(raw);if(!['approve','cancel','dispatch','recover'].includes(mode))throw Error('ticket_action_unavailable');
   if(mode==='cancel'||mode==='recover')await historyHint(scope,signal);else await warm(scope,signal);
   const candidate=await selected(scope,input.actionId);signal.throwIfAborted();
   if(mode==='cancel')return store().cancel(scope,input);
   if(mode==='recover')return store().recover(scope,input.actionId);
   if(mode==='approve')return store().approve(scope,input);
   const a=binding();if(scope.actorUserId!==a.executorUserId||!ports.preflightTransport||!ports.executeTransport)throw Error('ticket_provider_execution_unavailable');
   await ports.preflightTransport(scope,candidate,a,signal);signal.throwIfAborted();
   const saved=await store().get(scope,input.actionId);if(saved.version!==input.expectedVersion)throw Error('ticket_action_changed');
   const claim=await store().claim(scope,input.actionId);if(!claim.claimed)return claim.record;
   let result:{status:'confirmed'|'refused'|'unknown'};
   try{result=await ports.executeTransport(input.actionId,claim.candidate,signal,async(c,s)=>{s.throwIfAborted();if(sha256ContentHash(c)!==sha256ContentHash(claim.candidate))throw Error('ticket_action_changed');await store().beforeDispatch(scope,input.actionId);s.throwIfAborted()})}catch{result={status:'unknown'}}
   try{return await store().finish(scope,input.actionId,result)}catch{return store().finish(scope,input.actionId,{status:'unknown'})}
  },
 };
}
