import {createTeamsOutboundDrain} from '@/lib/governance/intelligence/teamsOutboundDrain';
import {assertNoUncoveredGovernanceExecution} from '@/lib/governance/intelligence/uncoveredExecution';
import {fenceUncoveredMutationStore} from '@/lib/governance/intelligence/uncoveredMutationStore';
import {readBotActionTaskBinding,assertBotActionTaskBinding} from '@/lib/axiom/bot/actionTaskBinding';
import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/db';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import {readBoundedGithubBody,withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import {readDesktopCommercialAccess} from './desktopCommercialAccess';
import {hasDesktopCapability,type DesktopWorkspaceRole,type DesktopCapability} from './desktopAuthorization';
import {consumeToken} from '@/lib/api/rateLimiter';
import {decryptScopedCredential} from '@/lib/security/credentialVault';
import {connectionCredentialContext} from '@/lib/integrations/tenantAuthorization';
import {readConnectedActionTargets,connectedTargetDigest} from '@/lib/integrations/connectedActionDiscovery';
import type {ConnectedActionTargets} from '@/lib/integrations/connectedActionDiscoveryContract';
import {CONNECTED_ACTION_KIND,connectedActionIntentSchema,type ConnectedActionIntent as Intent,type ConnectedActionDto,type ConnectedActionScope as Scope} from '@/lib/integrations/connectedActionContract';
import {createConnectedActionStore} from '@/lib/integrations/connectedActionStore';
import {createConnectedActionTransport} from '@/lib/integrations/connectedActionTransport';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction as Tx} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {connectedActionsRequestSchema,connectedActionsDataSchema,type ConnectedActionsRequest} from './connectedActionsContract';

const principalSchema=z.object({id:z.string().min(1),userId:z.string().min(1),organizationId:z.string().min(1),credentialKind:z.literal('desktop_session'),capabilities:z.array(z.string())}).passthrough();
const connectionSchema=z.object({id:z.string().min(1),organizationId:z.string().min(1),provider:z.enum(['teams','linear']),status:z.literal('active'),revokedAt:z.null(),consentedByUserId:z.string().min(1),externalAccountId:z.string().uuid(),updatedAt:z.date(),lastValidatedAt:z.date(),encryptedCredential:z.string().min(1),scopesJson:z.array(z.string()).max(32)});
type Connection=z.infer<typeof connectionSchema>;
const select={id:true,organizationId:true,provider:true,status:true,revokedAt:true,consentedByUserId:true,externalAccountId:true,updatedAt:true,lastValidatedAt:true,encryptedCredential:true,scopesJson:true} as const;
const credentialSchema=z.object({accessToken:z.string().min(1).max(32768).refine(v=>!/[\x00-\x20\x7f-\x9f]/.test(v)),expiresAt:z.number().int().safe()}).passthrough();
class Refusal extends Error{constructor(readonly code:string,readonly status=409){super(code)}}
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export interface ConnectedActionsHttpPorts{
 repo?:ReleaseOperationPlanRepo;
 readPrincipal?:(request:NextRequest,manage:boolean,approving:boolean)=>Promise<unknown>;
 readConnection?:(organizationId:string,provider:'teams'|'linear')=>Promise<unknown>;
 commercialAllowed?:(organizationId:string)=>Promise<boolean>;
 decrypt?:(cipher:string,context:string)=>string;
 fetch?:typeof fetch;enabled?:(provider:'teams'|'linear')=>boolean;
}
const production:ConnectedActionsHttpPorts={repo:prisma as unknown as ReleaseOperationPlanRepo,readPrincipal:(request,manage,approving)=>resolveRequestDesktopSession(request,{requiredScope:manage&&!approving?'pipeline:trigger':'pipeline:read',requiredCapability:approving?'agent:approve':manage?'connections:manage':'workspace:read',requireWorkspaceMembership:true,allowApiKey:false,route:'governed connected-app actions'}),readConnection:(organizationId,provider)=>prisma.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId,provider}},select}),commercialAllowed:async org=>(await readDesktopCommercialAccess(org)).allowed,decrypt:decryptScopedCredential,fetch,enabled:provider=>process.env.AXIOM_CONNECTED_APP_ACTIONS_ENABLED==='true'&&process.env[provider==='teams'?'AXIOM_TEAMS_CHANNEL_ACTIONS_ENABLED':'AXIOM_LINEAR_ISSUE_ACTIONS_ENABLED']==='true'};

/** Real provider adapters are fixed in server code. A client may choose an exact
 * target/content, but cannot supply tenant, token, connection, permission or approval. */
export function createConnectedActionsHttp(ports:ConnectedActionsHttpPorts=production){
 return async function handle(request:NextRequest,rawProvider:string):Promise<Response>{try{
  if(rawProvider!=='teams'&&rawProvider!=='linear')throw new Refusal('provider_unavailable',404);const provider=rawProvider;
  if(!['GET','POST'].includes(request.method))throw new Refusal('method_not_allowed',405);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(25000)]),query=request.nextUrl.searchParams;
  if(request.url.length>2048||[...query.keys()].some(k=>!['id','intentId','targets','teamId','issueId','taskId','taskLinked'].includes(k))||[...query.keys()].some(k=>query.getAll(k).length!==1)||(query.has('id')||query.has('intentId')||query.has('taskId')||query.has('taskLinked'))&&query.size!==1||query.has('targets')&&query.get('targets')!=='1'||!query.has('targets')&&[...query.keys()].some(k=>!['id','intentId','taskId','taskLinked'].includes(k)))throw new Refusal('invalid_connected_action',400);
  if(query.has('taskLinked')&&query.get('taskLinked')!=='1')throw new Refusal('invalid_connected_action',400);
  if(query.has('taskId')&&!/^bot_[a-f0-9]{64}$/.test(query.get('taskId')!))throw new Refusal('invalid_connected_action',400);
  let body:ConnectedActionsRequest|undefined;
  if(request.method==='POST'){if(query.size||!request.body||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new Refusal('invalid_connected_action',400);body=connectedActionsRequestSchema.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readBoundedGithubBody(new Response(request.body),signal,24576))))}
  const manage=!!body&&!['recover','cancel'].includes(body.action),approving=body?.action==='approve';
  const parsed=principalSchema.safeParse(await ports.readPrincipal?.(request,manage,approving));if(!parsed.success)throw new Refusal('desktop_session_required',401);const actor=parsed.data,scope:Scope={organizationId:actor.organizationId,actorUserId:actor.userId,sessionId:actor.id};
  if(!consumeToken(`connected-actions:${scope.organizationId}:${scope.actorUserId}:${provider}`,{capacity:16,tokensPerSecond:0.2}).allowed)throw new Refusal('connected_action_rate_limited',429);
  const enabled=()=>ports.enabled?.(provider)===true;
  const current=async()=>{signal.throwIfAborted();const p=principalSchema.parse(await withGithubAbort(ports.readPrincipal!(request,manage,approving),signal));if(p.id!==actor.id||p.userId!==actor.userId||p.organizationId!==actor.organizationId)throw new Refusal('desktop_session_required',401);return p};
  const readConnection=async()=>{if(!ports.readConnection||!ports.decrypt)throw new Refusal('connected_action_adapter_unavailable',503);await current();const raw=await withGithubAbort(ports.readConnection(scope.organizationId,provider),signal);if(raw===null||typeof raw==='object'&&raw!==null&&('status'in raw&&raw.status!=='active'||'revokedAt'in raw&&raw.revokedAt!==null))throw new Refusal('connected_action_connection_required');const row=connectionSchema.parse(raw);if(row.organizationId!==scope.organizationId||row.provider!==provider||row.lastValidatedAt.getTime()>Date.now()||Date.now()-row.lastValidatedAt.getTime()>86400000)throw new Refusal('connected_action_refresh_required');return row};
  let captured:Connection|undefined,targets:ConnectedActionTargets|undefined;
  const readTargets=async(teamId?:string,issueId?:string)=>{const row=await readConnection(),token=credentialSchema.parse(JSON.parse(ports.decrypt!(row.encryptedCredential,connectionCredentialContext({organizationId:row.organizationId,provider,connectionId:row.id}))));
   const observed=await readConnectedActionTargets({provider,organizationId:row.organizationId,connectionId:row.id,connectionRevision:row.updatedAt.toISOString(),externalAccountId:row.externalAccountId,token:token.accessToken,scopes:row.scopesJson,expiresAt:token.expiresAt,teamId,issueId,signal,fetchImpl:ports.fetch,assertCurrent:async()=>{await current();const latest=await readConnection();if(hash(latest)!==hash(row))throw new Refusal('connected_action_connection_changed')}});captured=row;targets=observed;return observed;
  };
  function targetDigest(i:Intent,page:ConnectedActionTargets){if(i.provider==='outlook')throw new Refusal('provider_unavailable',404);const team=page.teams.find(t=>t.id===i.teamId);if(!team||page.workspaceId!==i.workspaceId||page.connectionId!==i.connectionId||page.connectionRevision!==i.connectionRevision)throw new Refusal('connected_action_target_changed');
   if(i.provider==='teams'){const channel=page.channels.find(c=>c.id===i.channelId);if(!channel||channel.membershipType!=='standard'||team.archived||!page.canMessage)throw new Refusal('connected_action_permission_required');return connectedTargetDigest({provider,workspaceId:page.workspaceId,team,channel})}
   if(i.kind==='linear_issue_create'){if(!page.canCreate)throw new Refusal('connected_action_permission_required');return connectedTargetDigest({provider,workspaceId:page.workspaceId,team})}
   const issue=page.issues.find(v=>v.id===i.issueId);if(!issue||!page.canUpdate)throw new Refusal('connected_action_permission_required');if(i.kind==='linear_issue_close'){const state=page.states.find(v=>v.id===i.stateId);if(!state||state.type!=='completed'||issue.stateId===state.id)throw new Refusal('connected_action_target_changed');return connectedTargetDigest({provider,workspaceId:page.workspaceId,team,issue,state})}return connectedTargetDigest({provider,workspaceId:page.workspaceId,team,issue});
  }
  if(!ports.repo)throw new Refusal('connected_action_adapter_unavailable',503);const repo=ports.repo;
  const assertMember=async(tx:Tx,user:string,capability:DesktopCapability)=>{const rows=await tx.$queryRaw<Array<{organizationId:string;userId:string;acceptedAt:Date|null;role:string}>>`SELECT "organizationId","userId","acceptedAt","role" FROM "OrgMembership" WHERE "organizationId"=${scope.organizationId} AND "userId"=${user} FOR SHARE`;const m=rows[0];if(rows.length!==1||m.organizationId!==scope.organizationId||m.userId!==user||!m.acceptedAt||!['owner','admin','operator','security_reviewer','finance_viewer','read_only'].includes(m.role)||!hasDesktopCapability(m.role as DesktopWorkspaceRole,capability))throw new Refusal('connected_action_permission_required',403)};
  const assertSession=async(tx:Tx,s:Scope)=>{const rows=await tx.$queryRaw<Array<{live:boolean}>>`SELECT ("revokedAt" IS NULL AND "expiresAt">clock_timestamp()) AS "live" FROM "DesktopSessionRecord" WHERE "id"=${s.sessionId} AND "organizationId"=${s.organizationId} AND "userId"=${s.actorUserId} FOR SHARE`;if(rows.length!==1||!rows[0].live)throw new Refusal('desktop_session_required',401)};
  const rawStore=createConnectedActionStore(repo,{assertCurrent:async(tx,s,i,role,approval)=>{
   signal.throwIfAborted();if(hash(s)!==hash(scope)||i.organizationId!==scope.organizationId||i.provider!==provider)throw new Refusal('desktop_session_required',401);
   if(!ports.commercialAllowed||!await ports.commercialAllowed(scope.organizationId))throw new Refusal('connected_action_permission_required',403);
   await assertSession(tx,scope);await assertMember(tx,scope.actorUserId,role==='approve'?'agent:approve':role==='read'?'workspace:read':'connections:manage');
   if(scope.actorUserId!==i.requesterUserId)await assertMember(tx,scope.actorUserId,'agent:approve');
   if(role!=='read')await assertMember(tx,i.executorUserId,'connections:manage');
   if(approval&&role!=='read'){await assertMember(tx,approval.approverUserId,'agent:approve');await assertSession(tx,{organizationId:scope.organizationId,actorUserId:approval.approverUserId,sessionId:approval.approverSessionId})}
   // Session and membership are rechecked under the transaction's row locks.
   // Do not call the outer resolver here: it touches lastUsedAt on a
   // separate pooled connection and waits on this transaction's session lock.
   if(role==='execute'&&!enabled())throw new Refusal('connected_action_execution_disabled');signal.throwIfAborted();
  },readCurrentIntent:async(tx,_s,i)=>{
   if(!captured||!targets||Date.now()-Date.parse(targets.observedAt)>30000||i.targetEvidenceDigest!==targetDigest(i,targets))throw new Refusal('connected_action_target_changed');
   const rows=await tx.$queryRaw<Connection[]>`SELECT "id","organizationId","provider","status","revokedAt","consentedByUserId","externalAccountId","updatedAt","lastValidatedAt","encryptedCredential","scopesJson" FROM "TenantIntegrationConnection" WHERE "organizationId"=${scope.organizationId} AND "provider"=${provider} FOR SHARE`;
   if(rows.length!==1||hash(connectionSchema.parse(rows[0]))!==hash(captured)||captured.id!==i.connectionId||captured.updatedAt.toISOString()!==i.connectionRevision||captured.consentedByUserId!==i.requesterUserId)throw new Refusal('connected_action_connection_changed');return structuredClone(i);
  },captureCurrentIntentFreshness:(s,i)=>{
   const targetSnapshot=targets,connectionSnapshot=captured;if(!targetSnapshot||!connectionSnapshot||hash(s)!==hash(scope)||i.provider!==provider||i.connectionId!==connectionSnapshot.id||i.connectionRevision!==connectionSnapshot.updatedAt.toISOString()||i.targetEvidenceDigest!==targetDigest(i,targetSnapshot))throw new Refusal('connected_action_target_changed');
   const observedAt=Date.parse(targetSnapshot.observedAt),deadline=observedAt+30000;
   return()=>{signal.throwIfAborted();const at=Date.now();if(!Number.isFinite(at)||!Number.isFinite(observedAt)||at<observedAt||at>=deadline||targets!==targetSnapshot||captured!==connectionSnapshot||!enabled())throw new Refusal('connected_action_target_changed')};
  }});
  const store=fenceUncoveredMutationStore(rawStore,()=>assertNoUncoveredGovernanceExecution(request,repo,scope,signal));
  let actions:ConnectedActionDto[]=[],truncated=false;
  if(body?.action==='request'){
   if(!actor.capabilities.includes('connections:manage')||provider==='teams'&&body.kind!=='teams_channel_message'||provider==='linear'&&body.kind==='teams_channel_message')throw new Refusal('connected_action_permission_required',403);
   const page=await readTargets(body.teamId,body.issueId);if(!captured||captured.consentedByUserId!==scope.actorUserId)throw new Refusal('connected_action_consenting_owner_required',403);
   const sourceTask=body.sourceTask?await repo.$transaction(tx=>readBotActionTaskBinding(tx,scope.organizationId,scope.actorUserId,body.sourceTask)):undefined;
   const intent=connectedActionIntentSchema.parse({...(sourceTask?{sourceTask}:{}),kind:body.kind,provider,intentId:body.intentId,organizationId:scope.organizationId,requesterUserId:scope.actorUserId,executorUserId:scope.actorUserId,connectionId:captured.id,connectionRevision:captured.updatedAt.toISOString(),workspaceId:page.workspaceId,teamId:body.teamId,targetEvidenceDigest:'0'.repeat(64),expiresAt:new Date(Date.now()+900000).toISOString(),...(body.kind==='teams_channel_message'?{channelId:body.channelId,text:body.text}:body.kind==='linear_issue_create'?{title:body.title,...(body.description?{description:body.description}:{})}:body.kind==='linear_issue_update'?{issueId:body.issueId,title:body.title,...(body.description?{description:body.description}:{})}:{issueId:body.issueId,stateId:body.stateId,stateType:'completed'})});intent.targetEvidenceDigest=targetDigest(intent,page);actions=[await store.request(scope,intent)];
  }else if(body){
   const saved=await store.get(scope,body.id);if(saved.intent.provider!==provider)throw new Refusal('connected_action_unavailable');
   const outbound=body.action==='execute'&&provider==='teams'?createTeamsOutboundDrain(repo,request,scope,body.id,rawStore,{signal,isEnabled:enabled}):undefined;outbound?.assertAvailable();
   if(body.action==='approve'||body.action==='execute'){await readTargets(saved.intent.teamId,saved.intent.provider==='linear'&&saved.intent.kind!=='linear_issue_create'?saved.intent.issueId:undefined)}
   if(body.action==='approve')actions=[await store.approve(scope,body.id,body.expectedVersion)];
   else if(body.action==='cancel')actions=[await store.cancel(scope,body.id,body.expectedVersion)];
   else if(body.action==='recover')actions=[await store.recover(scope,body.id,body.expectedVersion)];
   else{
    const claim=await store.claim(scope,body.id,body.expectedVersion);if(!claim.claimed)actions=[claim.record];else{
     const transport=createConnectedActionTransport({isEnabled:enabled,fetch:ports.fetch,...(outbound?{beforeSubmission:outbound.beforeSubmission}:{}),readCredential:async(i,credentialSignal)=>{credentialSignal.throwIfAborted();if(outbound)await outbound.beforeCredential(i,credentialSignal);if(!captured||!targets)throw new Refusal('connected_action_target_changed');const row=await readConnection();credentialSignal.throwIfAborted();if(hash(row)!==hash(captured))throw new Refusal('connected_action_connection_changed');const token=credentialSchema.parse(JSON.parse(ports.decrypt!(row.encryptedCredential,connectionCredentialContext({organizationId:row.organizationId,provider,connectionId:row.id}))));return{organizationId:row.organizationId,connectionId:row.id,connectionRevision:row.updatedAt.toISOString(),provider,workspaceId:targets.workspaceId,token:token.accessToken,scopes:row.scopesJson,expiresAt:token.expiresAt}}});
     const result=await transport.execute({operationId:body.id,intent:claim.record.intent,signal,assertCurrent:async()=>{if(outbound){const proof=await repo.$transaction(tx=>rawStore.readClaimedTeamsOutboundLocked(tx,scope,body.id,claim.record.intent));proof.fresh();return proof.fresh}await store.beforeDispatch(scope,body.id)}});try{actions=[await store.finish(scope,body.id,result)]}catch{actions=[await store.finish(scope,body.id,{state:'unknown'})]}
    }
   }
  }else if(query.has('targets')){if(!actor.capabilities.includes('connections:manage'))throw new Refusal('connected_action_permission_required',403);await readTargets(query.get('teamId')??undefined,query.get('issueId')??undefined)}
  else if(query.has('id')||query.has('intentId')){const id=query.has('id')?query.get('id')!:'connected_action_'+hash({organizationId:scope.organizationId,intentId:z.string().uuid().parse(query.get('intentId'))});const saved=await store.get(scope,id);if(saved.intent.provider!==provider)throw new Refusal('connected_action_unavailable');actions=[saved]}
  else{const rows=await repo.durableAgentWorkflow.findMany({where:{organizationId:scope.organizationId,workflowKind:CONNECTED_ACTION_KIND,...(query.has('taskId')?{AND:[{inputJson:{path:['intent','provider'],equals:provider}},{inputJson:{path:['intent','sourceTask','taskId'],equals:query.get('taskId')!}}]}:{inputJson:{path:['intent','provider'],equals:provider}}),...(!actor.capabilities.includes('agent:approve')?{requestedByUserId:scope.actorUserId}:{})},orderBy:[{createdAt:'desc'},{id:'desc'}],take:41});const visible=rows.filter(row=>{const linked=!!(row.inputJson as {intent?:{sourceTask?:unknown}})?.intent?.sourceTask;return query.has('taskId')||query.has('taskLinked')?linked:!linked});truncated=rows.length>20;for(const row of visible.slice(0,20))actions.push(await store.get(scope,row.id))}
  const taskCurrent=new Map<string,boolean>();for(const action of actions){if(!action.intent.sourceTask)continue;let valid=true;try{await withGithubAbort(repo.$transaction(tx=>assertBotActionTaskBinding(tx,scope.organizationId,action.intent.requesterUserId,action.intent.sourceTask)),signal)}catch{valid=false}taskCurrent.set(action.id,valid)}
  const final=await current();return reply({ok:true,data:connectedActionsDataSchema.parse({provider,enabled:enabled(),canRequest:final.capabilities.includes('connections:manage'),canApprove:final.capabilities.includes('agent:approve'),actions:actions.map(a=>({...a,canApprove:taskCurrent.get(a.id)!==false&&final.capabilities.includes('agent:approve')&&a.state==='requested'&&![a.intent.requesterUserId,a.intent.executorUserId].includes(scope.actorUserId)&&Date.parse(a.intent.expiresAt)>Date.now(),canExecute:taskCurrent.get(a.id)!==false&&enabled()&&final.capabilities.includes('connections:manage')&&a.state==='approved'&&a.intent.executorUserId===scope.actorUserId&&Date.parse(a.intent.expiresAt)>Date.now(),canCancel:['requested','approved'].includes(a.state)&&a.intent.requesterUserId===scope.actorUserId,canRecover:a.state==='dispatching'&&a.intent.executorUserId===scope.actorUserId})),...(targets?{targets}:{}),truncated})});
 }catch(error){const invalid=error instanceof z.ZodError||error instanceof SyntaxError;return reply({ok:false,error:error instanceof Refusal?error.code:error instanceof Error&&error.message==='bot_action_task_changed'?'bot_action_task_changed':invalid?'invalid_connected_action':error instanceof Error&&/^connected_action_[a-z_]+$/.test(error.message)?error.message:'connected_action_unavailable'},error instanceof Refusal?error.status:invalid?400:409)}};
}
export const handleConnectedActions=createConnectedActionsHttp();
