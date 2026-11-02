import {afterAll,afterEach,beforeAll,describe,it,expect,vi} from 'vitest';
import {createRequire} from 'node:module';
import {NextRequest} from 'next/server';
import {createAgentActionExecutionHttp,createAgentActionEligibilityHttp} from '@/lib/desktop/agentActionExecutionHttp';
import {randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
const f=vi.hoisted(()=>({db:null as any,principal:null as any,commercial:true,token:vi.fn()}));
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:async()=>f.principal}));
vi.mock('@/lib/connectors/github/resolveTenantScopedToken',async actual=>({...await actual<typeof import('@/lib/connectors/github/resolveTenantScopedToken')>(),resolveTenantScopedToken:f.token}));
vi.mock('@/lib/desktop/desktopCommercialAccess',()=>({readDesktopCommercialAccess:async()=>({allowed:f.commercial})}));
vi.mock('@/lib/billing/tenantBillingStore',()=>({readBillingPlanWithAvailability:async()=>({available:f.commercial,plan:{tier:'no_plan',status:'none'}})}));
import {createAgentActionExecutionRequestService} from '@/lib/desktop/agentActionExecutionRequestService';
vi.mock('@/lib/db',()=>({prisma:new Proxy({}, {get(_t,key){const v=f.db[key];return typeof v==='function'?v.bind(f.db):v}})}));
vi.mock('../agentIdentityPolicy',()=>({readWorkspaceAgentIdentity:(org:string)=>f.db.workspaceAgentIdentity.findUnique({where:{organizationId:org}})}));
import {decideAgentAction} from '../browserApprovalDecision';
import {agentActionDigest} from '../proposalIntegrity';
import {readAgentDeploymentAuthoritySnapshot} from '../agentDeploymentAuthoritySnapshot';
import {createAgentActionExecutionStore} from '../agentActionExecutionStore';
const socket=process.env.AXIOM_EXECUTION_POLICY_PG_SOCKET;
describe.skipIf(!socket)('actual new-review requester execution store; no provider transport',()=>{
 beforeAll(async()=>{
  const generated=process.env.AXIOM_EXECUTION_POLICY_PG_CLIENT;
  if(!socket||!/^\/private\/tmp\/axiom-execution-policy-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||!generated||!generated.startsWith(socket.slice(0,-7)+'/generated/'))throw Error('owned_fixture_required');
  const Client=createRequire(import.meta.url)(generated).PrismaClient;f.db=new Client({datasources:{db:{url:`postgresql://policy_fixture@localhost/policy_fixture?host=${encodeURIComponent(socket)}`}}});
  const [r]=await f.db.$queryRawUnsafe("SELECT current_database()='policy_fixture' AND current_user='policy_fixture' AND current_setting('listen_addresses')='' AS private");if(!r?.private)throw Error('owned_fixture_required');
 });
 afterAll(async()=>f.db?.$disconnect());afterEach(()=>vi.unstubAllGlobals());
 async function fixture(lifetime=60000,toolName='open_github_pull_request',buildArgs?:(org:string)=>Record<string,unknown>){
  const org='agent-exec-'+randomUUID(),requester='requester',sessionId=org+'-session';
  for(const [userId,role]of [[requester,'operator'],['reviewer','security_reviewer'],['other','admin']])await f.db.orgMembership.create({data:{organizationId:org,userId,role,acceptedAt:new Date()}});
  await f.db.desktopSessionRecord.create({data:{id:sessionId,organizationId:org,userId:requester,expiresAt:new Date(Date.now()+60000)}});
  await f.db.workspaceAgentIdentity.create({data:{organizationId:org,enabled:true,allowedTools:[toolName],updatedBy:'reviewer'}});
  const conversation=await f.db.agentConversation.create({data:{organizationId:org,userId:requester}}),input={organizationId:org,conversationId:conversation.id,proposedByUserId:requester,toolName,args:buildArgs?.(org)??{repositoryFullName:'fixture/repository',head:'reviewed',base:'main',title:'One exact action'}};
  const {args,...proposalInput}=input;
  const proposal=await f.db.agentActionProposal.create({data:{...proposalInput,argsJson:args,actionDigest:agentActionDigest(input),riskLevel:'medium',approvalExpiresAt:new Date(Date.now()+lifetime)}});
  expect(await decideAgentAction({organizationId:org,proposalId:proposal.id,actorUserId:'reviewer',actorRole:'security_reviewer',decision:'approve'})).toEqual({ok:true,status:'approved'});
  const scope={organizationId:org,actorUserId:requester,sessionId};
  // Request/commercial authentication is simulated. The store must enforce
  // real persisted identities, review evidence, policy and one-attempt rows.
  const store=createAgentActionExecutionStore(f.db,{assertCurrent:async()=>{}});
  return{org,scope,proposal,store};
 }
 it('claims once, keeps an unknown outcome consumed, and preserves original review rows',async()=>{
  const t=await fixture(),before=await f.db.agentActionProposal.findUnique({where:{id:t.proposal.id}}),op=await t.store.prepare(t.scope,t.proposal.id);
  expect(op).toMatchObject({state:'prepared',attemptCount:0});const results=await Promise.all([t.store.claim(t.scope,op.id),t.store.claim(t.scope,op.id)]),winner=results.find(r=>r.claimed);
  expect(results.filter(r=>r.claimed)).toHaveLength(1);expect(winner).toBeTruthy();
  const binding=await t.store.beforeDispatch(t.scope,winner.claim);expect(binding).toMatchObject({toolName:'open_github_pull_request',args:{repositoryFullName:'fixture/repository'}});
  await t.store.complete(winner.claim,'unknown',{code:'provider_outcome_unknown'});
  expect(await t.store.get(t.scope,op.id)).toMatchObject({state:'unknown',attemptCount:1,version:2});expect((await t.store.claim(t.scope,op.id)).claimed).toBe(false);
  expect(await f.db.agentActionProposal.findUnique({where:{id:t.proposal.id}})).toEqual(before);
 });
 it('does not create another execution when the same requester has a new paired session',async()=>{
  const t=await fixture(),op=await t.store.prepare(t.scope,t.proposal.id),next={...t.scope,sessionId:t.scope.sessionId+'-new'};
  await f.db.desktopSessionRecord.create({data:{id:next.sessionId,organizationId:t.org,userId:next.actorUserId,expiresAt:new Date(Date.now()+60000)}});
  await expect(t.store.prepare(next,t.proposal.id)).rejects.toThrow();await expect(t.store.claim(next,op.id)).rejects.toThrow();expect(await t.store.get(next,op.id)).toMatchObject({id:op.id,attemptCount:0});
  expect(await f.db.durableAgentWorkflow.count({where:{organizationId:t.org,workflowKind:'agent_action_execution_v1'}})).toBe(1);
 });
 it('refuses old approval history without the new review marker',async()=>{
  const t=await fixture();const audit=await f.db.secureAuditRecord.findFirst({where:{organizationId:t.org,action:'approval.grant'}}),{decisionFormat,...old}=audit.detail;
  await f.db.secureAuditRecord.update({where:{id:audit.id},data:{detail:old}});
  await expect(t.store.prepare(t.scope,t.proposal.id)).rejects.toThrow();expect(await f.db.durableAgentWorkflow.count({where:{organizationId:t.org}})).toBe(0);
 });
 it('refuses reviewer role revocation before claim without consuming an attempt',async()=>{
  const t=await fixture(),op=await t.store.prepare(t.scope,t.proposal.id);await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:'reviewer'}},data:{role:'read_only'}});
  await expect(t.store.claim(t.scope,op.id)).rejects.toThrow();expect(await t.store.get(t.scope,op.id)).toMatchObject({state:'prepared',attemptCount:0});
 });
 it('refuses changed content after claim, and still records the private claimed refusal',async()=>{
  const t=await fixture(),op=await t.store.prepare(t.scope,t.proposal.id),claimed=await t.store.claim(t.scope,op.id);
  await f.db.agentActionProposal.update({where:{id:t.proposal.id},data:{argsJson:{repositoryFullName:'different/repository'}}});
  await expect(t.store.beforeDispatch(t.scope,claimed.claim)).rejects.toThrow();await t.store.complete(claimed.claim,'refused',{code:'pre_dispatch_refused'});
  expect(await t.store.get(t.scope,op.id)).toMatchObject({state:'refused',attemptCount:1});
 });
 it('rejects copied claim objects and tenant or actor substitution',async()=>{
  const t=await fixture(),op=await t.store.prepare(t.scope,t.proposal.id),claimed=await t.store.claim(t.scope,op.id);
  await expect(t.store.beforeDispatch(t.scope,{...claimed.claim})).rejects.toThrow();await expect(t.store.complete({...claimed.claim},'unknown',{code:'provider_outcome_unknown'})).rejects.toThrow();
  await expect(t.store.get({...t.scope,organizationId:'other'},op.id)).rejects.toThrow();await expect(t.store.get({...t.scope,actorUserId:'other'},op.id)).rejects.toThrow();
 });
 it('retains unknown outcome recording after current session revocation and never stores raw result fields',async()=>{
  const t=await fixture(),op=await t.store.prepare(t.scope,t.proposal.id),claimed=await t.store.claim(t.scope,op.id);
  await expect(t.store.complete(claimed.claim,'unknown',{code:'provider_outcome_unknown',token:'PRIVATE_FIXTURE'})).rejects.toThrow();
  await f.db.desktopSessionRecord.update({where:{id:t.scope.sessionId},data:{revokedAt:new Date()}});
  await t.store.complete(claimed.claim,'unknown',{code:'provider_outcome_unknown'});
  const row=await f.db.durableAgentWorkflow.findUnique({where:{id:op.id}});expect(row).toMatchObject({attemptCount:1,currentStep:'unknown'});expect(JSON.stringify(row)).not.toContain('PRIVATE_FIXTURE');
 });
 it('refuses an altered earlier state digest even if a later link is rewritten to match',async()=>{
  const t=await fixture(),op=await t.store.prepare(t.scope,t.proposal.id);await t.store.claim(t.scope,op.id);
  const events=await f.db.durableAgentWorkflowEvent.findMany({where:{workflowRunId:op.id},orderBy:{sequence:'asc'}});
  await f.db.durableAgentWorkflowEvent.update({where:{id:events[0].id},data:{detailJson:{...events[0].detailJson,stateDigest:'a'.repeat(64)}}});
  await f.db.durableAgentWorkflowEvent.update({where:{id:events[1].id},data:{detailJson:{...events[1].detailJson,previousStateDigest:'a'.repeat(64)}}});
  await expect(t.store.get(t.scope,op.id)).rejects.toThrow();
 });
 it('refuses disabled Agent policy before claim and preserves cancellation without execution rights',async()=>{
  const t=await fixture(),op=await t.store.prepare(t.scope,t.proposal.id);
  await f.db.workspaceAgentIdentity.update({where:{organizationId:t.org},data:{enabled:false}});
  await expect(t.store.claim(t.scope,op.id)).rejects.toThrow();
  await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:t.scope.actorUserId}},data:{role:'read_only'}});
  expect(await t.store.cancel(t.scope,op.id)).toMatchObject({state:'cancelled',attemptCount:0,version:1});
 });
 it('refuses newly enrolled scope before dispatch and retains the already consumed attempt',async()=>{
  const t=await fixture(),op=await t.store.prepare(t.scope,t.proposal.id),claimed=await t.store.claim(t.scope,op.id);
  await f.db.durableAgentWorkflow.create({data:{id:'governance_active_'+randomUUID(),organizationId:t.org,workflowKind:'conflicting_fixture',objective:'Fixture only',autonomyLevel:'observe',inputJson:{},stateJson:{},requestedByUserId:'reviewer'}});
  await expect(t.store.beforeDispatch(t.scope,claimed.claim)).rejects.toThrow();await t.store.complete(claimed.claim,'refused',{code:'pre_dispatch_refused'});
  expect(await t.store.get(t.scope,op.id)).toMatchObject({state:'refused',attemptCount:1});
 });

 it('classifies a lost process after the real lease elapses without resetting or rewriting history',async()=>{
  const t=await fixture(),op=await t.store.prepare(t.scope,t.proposal.id),claimed=await t.store.claim(t.scope,op.id);
  await f.db.$queryRawUnsafe('SELECT 1 FROM pg_sleep(30.1)');
  const restarted=createAgentActionExecutionStore(f.db,{assertCurrent:async()=>{}}),before=await f.db.durableAgentWorkflow.findUnique({where:{id:op.id}});
  expect(await restarted.get(t.scope,op.id)).toMatchObject({state:'dispatching',recoveryState:'lease_elapsed_unconfirmed',attemptCount:1});
  expect((await restarted.claim(t.scope,op.id)).claimed).toBe(false);
  expect(await f.db.durableAgentWorkflow.findUnique({where:{id:op.id}})).toEqual(before);
  await expect(restarted.complete(claimed.claim,'unknown',{code:'provider_outcome_unknown'})).rejects.toThrow();
  await t.store.complete(claimed.claim,'unknown',{code:'provider_outcome_unknown'});
  expect(await restarted.get(t.scope,op.id)).toMatchObject({state:'unknown',recoveryState:'unknown',attemptCount:1});
 },40000);

 it.each(['requester','reviewer','policy'])('refuses %s authority removal after claim without allowing another attempt',async target=>{
  const t=await fixture(),op=await t.store.prepare(t.scope,t.proposal.id),claimed=await t.store.claim(t.scope,op.id);
  if(target==='policy')await f.db.workspaceAgentIdentity.update({where:{organizationId:t.org},data:{enabled:false}});
  else await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:target}},data:{role:'read_only'}});
  await expect(t.store.beforeDispatch(t.scope,claimed.claim)).rejects.toThrow();await t.store.complete(claimed.claim,'refused',{code:'pre_dispatch_refused'});
  expect(await t.store.get(t.scope,op.id)).toMatchObject({state:'refused',attemptCount:1});
 });
 it('refuses expiry during the final request-authority await while retaining prepared history',async()=>{
  const t=await fixture(1000),op=await t.store.prepare(t.scope,t.proposal.id),delayed=createAgentActionExecutionStore(f.db,{assertCurrent:async()=>{await f.db.$queryRawUnsafe('SELECT 1 FROM pg_sleep(1.1)')}});
  await expect(delayed.claim(t.scope,op.id)).rejects.toThrow();expect(await t.store.get(t.scope,op.id)).toMatchObject({state:'prepared',attemptCount:0});
 });
 it('allows cancellation, never execution adoption, from a new current requester session',async()=>{
  const t=await fixture(),op=await t.store.prepare(t.scope,t.proposal.id),next={...t.scope,sessionId:t.scope.sessionId+'-stop'};
  await f.db.desktopSessionRecord.create({data:{id:next.sessionId,organizationId:t.org,userId:next.actorUserId,expiresAt:new Date(Date.now()+60000)}});
  await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:next.actorUserId}},data:{role:'read_only'}});
  expect(await t.store.cancel(next,op.id)).toMatchObject({state:'cancelled',attemptCount:0});
 });

 it('recovers the original preparation from its proposal without adopting changed source authority',async()=>{
  const t=await fixture(),op=await t.store.prepare(t.scope,t.proposal.id);
  await f.db.agentActionProposal.update({where:{id:t.proposal.id},data:{argsJson:{repositoryFullName:'changed/repository'}}});
  expect(await t.store.lookup(t.scope,t.proposal.id)).toMatchObject({id:op.id,attemptCount:0});
  await expect(t.store.claim(t.scope,op.id)).rejects.toThrow();
 });
 it('returns a validated absent lookup without creating or claiming work',async()=>{
  const t=await fixture();expect(await t.store.lookup(t.scope,t.proposal.id)).toBeNull();expect(await f.db.durableAgentWorkflow.count({where:{organizationId:t.org}})).toBe(0);
 });

 it('composed paired service preserves recovery and real current membership without provider calls',async()=>{
  const t=await fixture(60000,'create_environment',()=>({slug:'qa',name:'QA',tier:'qa'}));await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:t.scope.actorUserId}},data:{role:'admin'}});f.principal={id:t.scope.sessionId,userId:t.scope.actorUserId,organizationId:t.org,credentialKind:'desktop_session'};f.commercial=true;
  const previous=process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED;
  try{
   process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED='true';
   const service=createAgentActionExecutionRequestService(new Request('https://fixture.test') as any,f.db,t.scope),op=await service.prepare(t.proposal.id);
   delete process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED;
   expect(await service.lookup(t.proposal.id)).toMatchObject({id:op.id,state:'prepared',attemptCount:0});
   await expect(service.prepare(t.proposal.id)).rejects.toThrow();
   await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:t.scope.actorUserId}},data:{role:'read_only'}});
   expect(await service.get(op.id)).toMatchObject({id:op.id,state:'prepared'});
   process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED='true';await expect(service.prepare(t.proposal.id)).rejects.toThrow();
   expect(await service.cancel(op.id)).toMatchObject({state:'cancelled',attemptCount:0});
   expect(await f.db.durableAgentWorkflow.count({where:{organizationId:t.org,workflowKind:'agent_action_execution_v1'}})).toBe(1);
  }finally{if(previous===undefined)delete process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED;else process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED=previous;f.principal=null;}
 });
 it('composed paired service refuses commercial or identity loss without leaving preparation behind',async()=>{
  const t=await fixture();f.principal={id:t.scope.sessionId,userId:t.scope.actorUserId,organizationId:t.org,credentialKind:'desktop_session'};const previous=process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED;
  try{
   process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED='true';f.commercial=false;
   const service=createAgentActionExecutionRequestService(new Request('https://fixture.test') as any,f.db,t.scope);
   await expect(service.prepare(t.proposal.id)).rejects.toThrow();
   f.commercial=true;f.principal={...f.principal,id:'different'};await expect(service.prepare(t.proposal.id)).rejects.toThrow();
   expect(await f.db.durableAgentWorkflow.count({where:{organizationId:t.org,workflowKind:'agent_action_execution_v1'}})).toBe(0);
  }finally{if(previous===undefined)delete process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED;else process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED=previous;f.principal=null;f.commercial=true;}
 });

 it('inspects exact prepared execution authority without claiming or exposing mutable stored source',async()=>{
  const t=await fixture(),op=await t.store.prepare(t.scope,t.proposal.id),before=await f.db.durableAgentWorkflow.findUnique({where:{id:op.id}});
  const source=await t.store.inspectForExecution(t.scope,op.id);expect(source).toMatchObject({toolName:'open_github_pull_request',args:{repositoryFullName:'fixture/repository'}});
  source.args.repositoryFullName='mutated/local';
  expect((await t.store.inspectForExecution(t.scope,op.id)).args.repositoryFullName).toBe('fixture/repository');
  expect(await f.db.durableAgentWorkflow.findUnique({where:{id:op.id}})).toEqual(before);
  await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:'reviewer'}},data:{role:'read_only'}});
  await expect(t.store.inspectForExecution(t.scope,op.id)).rejects.toThrow();
 });
 it('does not inspect consumed or changed source as new execution authority',async()=>{
  const t=await fixture(),op=await t.store.prepare(t.scope,t.proposal.id);await t.store.claim(t.scope,op.id);
  await expect(t.store.inspectForExecution(t.scope,op.id)).rejects.toThrow();
  const changed=await fixture(),other=await changed.store.prepare(changed.scope,changed.proposal.id);
  await f.db.agentActionProposal.update({where:{id:changed.proposal.id},data:{argsJson:{repositoryFullName:'other/repository'}}});
  await expect(changed.store.inspectForExecution(changed.scope,other.id)).rejects.toThrow();
  expect(await changed.store.get(changed.scope,other.id)).toMatchObject({attemptCount:0,state:'prepared'});
 });

 it('atomically applies a fixed database mutation and records its only outcome',async()=>{
  const t=await fixture(60000,'create_environment');await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:t.scope.actorUserId}},data:{role:'admin'}});
  const op=await t.store.prepare(t.scope,t.proposal.id),claimed=await t.store.claim(t.scope,op.id);let calls=0;
  const outcome=await t.store.applyDatabase(claimed.claim,async(tx:any,source:any)=>{
   calls++;expect(source.toolName).toBe('create_environment');
   await tx.$queryRaw`UPDATE "AgentConversation" SET "title"='fixture mutation committed' WHERE "id"=${t.proposal.conversationId} RETURNING "id"`;
   return{code:'action_completed' as const,references:[{kind:'environment' as const,id:'fixture-environment'}]};
  });
  expect(outcome).toMatchObject({state:'confirmed',attemptCount:1});expect(calls).toBe(1);
  expect((await f.db.agentConversation.findUnique({where:{id:t.proposal.conversationId}})).title).toBe('fixture mutation committed');
  await expect(t.store.applyDatabase(claimed.claim,async()=>{calls++;return{code:'action_completed'}})).rejects.toThrow();expect(calls).toBe(1);
 });
 it('rolls back database mutation and keeps consumed uncertainty if final authority is lost',async()=>{
  const t=await fixture(60000,'create_environment');await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:t.scope.actorUserId}},data:{role:'admin'}});
  const op=await t.store.prepare(t.scope,t.proposal.id),claimed=await t.store.claim(t.scope,op.id);const guarded=createAgentActionExecutionStore(f.db,{assertCurrent:async()=>{}});
  // Private proof cannot be adopted by a different store, even for the same ID.
  await expect(guarded.applyDatabase(claimed.claim,async()=>({code:'action_completed'}))).rejects.toThrow();
  await expect(t.store.applyDatabase(claimed.claim,async(tx:any)=>{
   await tx.$queryRaw`UPDATE "AgentConversation" SET "title"='must roll back' WHERE "id"=${t.proposal.conversationId} RETURNING "id"`;
   await tx.$queryRaw`UPDATE "WorkspaceAgentIdentity" SET "enabled"=false WHERE "organizationId"=${t.org} RETURNING "organizationId"`;
   return{code:'action_completed' as const};
  })).rejects.toThrow();
  expect((await f.db.agentConversation.findUnique({where:{id:t.proposal.conversationId}})).title).toBeNull();
  const retry=vi.fn();await expect(t.store.applyDatabase(claimed.claim,retry)).rejects.toThrow();expect(retry).not.toHaveBeenCalled();
  expect(await t.store.get(t.scope,op.id)).toMatchObject({state:'dispatching',attemptCount:1});
 });
 it('refuses external tools at the database mutation boundary before invoking the callback',async()=>{
  const t=await fixture(),op=await t.store.prepare(t.scope,t.proposal.id),claimed=await t.store.claim(t.scope,op.id);const write=vi.fn();await expect(t.store.applyDatabase(claimed.claim,write)).rejects.toThrow();expect(write).not.toHaveBeenCalled();
 });

 it('binds the final GitHub check to current exact installation and source authority together',async()=>{
  const t=await fixture(),revision=new Date();const connection={id:t.org+'-installation',githubInstallationId:'123',updatedAt:revision};
  await f.db.gitHubInstallation.create({data:{...connection,organizationId:t.org,status:'active',accountLogin:'fixture',installedAt:revision}});
  const op=await t.store.prepare(t.scope,t.proposal.id),claimed=await t.store.claim(t.scope,op.id);
  expect(await t.store.beforeGithubDispatch(t.scope,claimed.claim,connection)).toMatchObject({toolName:'open_github_pull_request'});
  await f.db.gitHubInstallation.update({where:{id:connection.id},data:{updatedAt:new Date(revision.getTime()+1)}});
  await expect(t.store.beforeGithubDispatch(t.scope,claimed.claim,connection)).rejects.toThrow();
  await f.db.gitHubInstallation.update({where:{id:connection.id},data:{updatedAt:revision}});
  await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:'reviewer'}},data:{role:'read_only'}});
  await expect(t.store.beforeGithubDispatch(t.scope,claimed.claim,connection)).rejects.toThrow();
 });
 it('refuses a replaced installation even if its old row remains active',async()=>{
  const t=await fixture(),revision=new Date(),connection={id:t.org+'-old',githubInstallationId:'123',updatedAt:revision};
  await f.db.gitHubInstallation.create({data:{...connection,organizationId:t.org,status:'active',accountLogin:'fixture',installedAt:revision}});
  const op=await t.store.prepare(t.scope,t.proposal.id),claimed=await t.store.claim(t.scope,op.id);
  await f.db.gitHubInstallation.create({data:{id:t.org+'-new',organizationId:t.org,status:'active',accountLogin:'fixture',githubInstallationId:'456',updatedAt:revision,installedAt:new Date(revision.getTime()+1)}});
  await expect(t.store.beforeGithubDispatch(t.scope,claimed.claim,connection)).rejects.toThrow();
 });

 it('binds deployment to the reviewed target, actual reservation and unchanged policy snapshot',async()=>{
  const revision=new Date(),sha='a'.repeat(40);
  const buildArgs=(org:string)=>({repositoryFullName:'fixture/repository',environmentId:org+'-env',sourceRef:'main',sourceKind:'branch',_review:{kind:'ecs_restart_target',organizationId:org,environmentId:org+'-env',environmentTier:'dev',targetId:org+'-target',provider:'aws',targetUpdatedAt:revision.toISOString(),roleArn:'arn:aws:iam::123456789012:role/fixture',region:'us-east-1',ecsCluster:'cluster',ecsService:'service'}});
  const t=await fixture(60000,'trigger_aws_deploy',buildArgs),args=buildArgs(t.org),target=args._review,connection={id:t.org+'-gh',githubInstallationId:'123',updatedAt:revision};
  let insertLate=false;
  const hooked={$transaction:(fn:any,options:any)=>f.db.$transaction(async(tx:any)=>fn(new Proxy(tx,{get(object,key){
   if(key==='$queryRaw')return async(...query:any[])=>{const rows=await object.$queryRaw(...query);if(insertLate&&String(query[0]).startsWith('SELECT "environmentId","repositoryFullName"')){insertLate=false;await f.db.branchEnvironmentPolicy.create({data:{id:t.org+'-late-policy',organizationId:t.org,repositoryId:t.org+'-repo',environmentId:args.environmentId,enabled:true,branchPattern:'main',requireReleaseTag:false,requireCodeowners:false,requirePrLink:false,requireChangeTicket:false,requirePromotionFromEnvironmentId:null,requireTestsPassing:true,priority:1}})}return rows};
   const value=object[key];return typeof value==='function'?value.bind(object):value;
  }})),options)};
  t.store=createAgentActionExecutionStore(hooked as any,{assertCurrent:async()=>{}});
  await f.db.environment.create({data:{id:args.environmentId,organizationId:t.org,tier:'dev'}});
  await f.db.deploymentTarget.create({data:{id:target.targetId,environmentId:args.environmentId,organizationId:t.org,provider:'aws',updatedAt:revision,roleArn:target.roleArn,region:target.region,ecsCluster:target.ecsCluster,ecsService:target.ecsService}});
  await f.db.gitHubInstallation.create({data:{...connection,organizationId:t.org,status:'active',accountLogin:'fixture',installedAt:revision}});
  const op=await t.store.prepare(t.scope,t.proposal.id),claimed=await t.store.claim(t.scope,op.id);
  const policySnapshotDigest=await readAgentDeploymentAuthoritySnapshot(f.db,t.org,args.environmentId);
  const input={target,policySnapshotDigest,sourceCommitSha:sha};
  await expect(t.store.beforeDeploymentDispatch(t.scope,claimed.claim,connection,input)).rejects.toThrow();
  await f.db.deploymentExecution.create({data:{id:t.org+'-reservation',organizationId:t.org,idempotencyKey:op.id,environmentId:args.environmentId,repositoryFullName:args.repositoryFullName,sourceRef:'main',sourceKind:'branch',sourceCommitSha:sha,source:'agent',triggeredByUserId:t.scope.actorUserId,status:'reserved'}});
  expect(await t.store.beforeDeploymentDispatch(t.scope,claimed.claim,connection,input)).toMatchObject({toolName:'trigger_aws_deploy'});
  await f.db.repository.create({data:{id:t.org+'-repo',organizationId:t.org,provider:'github',remoteOwner:'fixture',remoteName:'repository'}});
  await expect(t.store.beforeDeploymentDispatch(t.scope,claimed.claim,connection,input)).rejects.toThrow();
  const fresh={...input,policySnapshotDigest:await readAgentDeploymentAuthoritySnapshot(f.db,t.org,args.environmentId)};
  expect(await t.store.beforeDeploymentDispatch(t.scope,claimed.claim,connection,fresh)).toMatchObject({toolName:'trigger_aws_deploy'});
  await f.db.deploymentExecution.update({where:{id:t.org+'-reservation'},data:{sourceCommitSha:'b'.repeat(40)}});
  await expect(t.store.beforeDeploymentDispatch(t.scope,claimed.claim,connection,fresh)).rejects.toThrow();
  await f.db.deploymentExecution.update({where:{id:t.org+'-reservation'},data:{sourceCommitSha:sha}});
  insertLate=true;await expect(t.store.beforeDeploymentDispatch(t.scope,claimed.claim,connection,fresh)).rejects.toThrow();
  const afterLate={...input,policySnapshotDigest:await readAgentDeploymentAuthoritySnapshot(f.db,t.org,args.environmentId)};
  expect(await t.store.beforeDeploymentDispatch(t.scope,claimed.claim,connection,afterLate)).toMatchObject({toolName:'trigger_aws_deploy'});
  await f.db.deploymentTarget.update({where:{id:target.targetId},data:{ecsService:'changed'}});
  await expect(t.store.beforeDeploymentDispatch(t.scope,claimed.claim,connection,afterLate)).rejects.toThrow();
 });

 it('reads current requester readiness without preparing or claiming an action',async()=>{
  const t=await fixture(),ready=await t.store.readExecutionReadiness(t.scope,t.proposal.id);
  expect(ready).toMatchObject({source:{toolName:'open_github_pull_request'},operation:null,sessionMatches:true});
  expect(await f.db.durableAgentWorkflow.count({where:{organizationId:t.org}})).toBe(0);
  const op=await t.store.prepare(t.scope,t.proposal.id);
  expect(await t.store.readExecutionReadiness(t.scope,t.proposal.id)).toMatchObject({operation:{id:op.id,state:'prepared',attemptCount:0},sessionMatches:true});
  const next={...t.scope,sessionId:t.scope.sessionId+'-next'};await f.db.desktopSessionRecord.create({data:{id:next.sessionId,organizationId:t.org,userId:t.scope.actorUserId,expiresAt:new Date(Date.now()+60000)}});
  expect(await t.store.readExecutionReadiness(next,t.proposal.id)).toMatchObject({operation:{id:op.id},sessionMatches:false});
  await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:'reviewer'}},data:{role:'read_only'}});
  await expect(t.store.readExecutionReadiness(t.scope,t.proposal.id)).rejects.toThrow();
 });

 it('composes paired eligibility prepare execute and recovery HTTP with real current database authority',async()=>{
  const t=await fixture(60000,'create_environment',()=>({slug:'reviewed-qa',name:'Reviewed QA',tier:'qa'}));
  await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:t.scope.actorUserId}},data:{role:'admin'}});
  f.principal={id:t.scope.sessionId,userId:t.scope.actorUserId,organizationId:t.org,credentialKind:'desktop_session'};f.commercial=true;const previous=process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED;
  const compose=(request:any,scope:any)=>createAgentActionExecutionRequestService(request,f.db,scope),handle=createAgentActionExecutionHttp(compose),eligibility=createAgentActionEligibilityHttp(compose);
  const get=()=>new NextRequest('https://fixture.test/api/desktop/agent/action-executions/eligibility?proposalId='+t.proposal.id),post=(body:unknown)=>new NextRequest('https://fixture.test/api/desktop/agent/action-executions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  try{
   process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED='true';
   const first=await(await eligibility(get())).json();expect(first.data).toMatchObject({proposalId:t.proposal.id,canPrepare:true,canExecute:false});expect(first.data).not.toHaveProperty('source');
   const prepared=await handle(post({operation:'prepare',proposalId:t.proposal.id}));expect(prepared.status).toBe(201);const id=(await prepared.json()).data.id;
   expect((await(await eligibility(get())).json()).data).toMatchObject({operationId:id,canPrepare:false,canExecute:true});
   expect((await handle(post({operation:'execute',id,approved:true}))).status).toBe(400);
   const executed=await handle(post({operation:'execute',id}));expect(executed.status).toBe(200);expect((await executed.json()).data).toMatchObject({id,state:'confirmed',attemptCount:1});
   expect(await f.db.environment.findMany({where:{organizationId:t.org}})).toMatchObject([{slug:'reviewed-qa',name:'Reviewed QA'}]);
   expect((await(await eligibility(get())).json()).data).toMatchObject({canPrepare:false,canExecute:false,reason:'operation_consumed'});
   await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:t.scope.actorUserId}},data:{role:'read_only'}});f.commercial=false;delete process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED;
   const read=await handle(new NextRequest('https://fixture.test/api/desktop/agent/action-executions?proposalId='+t.proposal.id));expect(read.status).toBe(200);expect((await read.json()).data).toMatchObject({id,state:'confirmed',attemptCount:1});
  }finally{if(previous===undefined)delete process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED;else process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED=previous;f.principal=null;f.commercial=true;}
 });

 it.each(['requester','reviewer'])('refuses paired HTTP execution after %s authority is revoked following displayed readiness',async revoked=>{
  const t=await fixture(60000,'create_environment',()=>({slug:'qa',name:'QA',tier:'qa'}));
  await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:t.scope.actorUserId}},data:{role:'admin'}});
  f.principal={id:t.scope.sessionId,userId:t.scope.actorUserId,organizationId:t.org,credentialKind:'desktop_session'};f.commercial=true;const previous=process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED;
  const compose=(request:any,scope:any)=>createAgentActionExecutionRequestService(request,f.db,scope),handle=createAgentActionExecutionHttp(compose),eligibility=createAgentActionEligibilityHttp(compose);
  const post=(body:unknown)=>new NextRequest('https://fixture.test/operations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  try{
   process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED='true';
   const id=(await(await handle(post({operation:'prepare',proposalId:t.proposal.id}))).json()).data.id;
   expect((await(await eligibility(new NextRequest('https://fixture.test/readiness?proposalId='+t.proposal.id))).json()).data.canExecute).toBe(true);
   const before=await f.db.durableAgentWorkflow.findUnique({where:{id}});
   await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:revoked==='requester'?t.scope.actorUserId:'reviewer'}},data:{role:'read_only'}});
   expect((await handle(post({operation:'execute',id}))).status).toBe(409);
   expect(await f.db.environment.count({where:{organizationId:t.org}})).toBe(0);expect(await f.db.durableAgentWorkflow.findUnique({where:{id}})).toEqual(before);
  }finally{if(previous===undefined)delete process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED;else process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED=previous;f.principal=null;f.commercial=true;}
 });
 it('does not let an independently reviewing administrator adopt the requester through HTTP',async()=>{
  const t=await fixture(60000,'create_environment',()=>({slug:'qa',name:'QA',tier:'qa'}));
  await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:t.scope.actorUserId}},data:{role:'admin'}});
  f.principal={id:t.scope.sessionId,userId:t.scope.actorUserId,organizationId:t.org,credentialKind:'desktop_session'};const previous=process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED;
  const compose=(request:any,scope:any)=>createAgentActionExecutionRequestService(request,f.db,scope),handle=createAgentActionExecutionHttp(compose),eligibility=createAgentActionEligibilityHttp(compose),post=(body:unknown)=>new NextRequest('https://fixture.test/operations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  try{
   process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED='true';const id=(await(await handle(post({operation:'prepare',proposalId:t.proposal.id}))).json()).data.id;
   await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:'reviewer'}},data:{role:'admin'}});
   const session=t.org+'-reviewer';await f.db.desktopSessionRecord.create({data:{id:session,organizationId:t.org,userId:'reviewer',expiresAt:new Date(Date.now()+60000)}});f.principal={id:session,organizationId:t.org,userId:'reviewer',credentialKind:'desktop_session'};
   expect((await(await eligibility(new NextRequest('https://fixture.test/readiness?proposalId='+t.proposal.id))).json()).data).toMatchObject({canPrepare:false,canExecute:false});
   expect((await handle(post({operation:'execute',id}))).status).toBe(409);expect(await f.db.environment.count({where:{organizationId:t.org}})).toBe(0);
   expect(await f.db.durableAgentWorkflow.findUnique({where:{id}})).toMatchObject({attemptCount:0,currentStep:'prepared'});
  }finally{if(previous===undefined)delete process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED;else process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED=previous;f.principal=null;f.commercial=true;}
 });

 it('composes the paired execute HTTP path with the real fixed file transport and pinned installation',async()=>{
  const t=await fixture(60000,'commit_github_file',()=>({repositoryFullName:'fixture/repository',branch:'reviewed',path:'app.txt',content:'new',message:'Reviewed change',_review:{kind:'github_file',baseSha:'a'.repeat(40),baseContent:'old'}}));
  const connection={id:t.org+'-gh',githubInstallationId:'123',updatedAt:new Date()};await f.db.gitHubInstallation.create({data:{...connection,organizationId:t.org,status:'active',accountLogin:'fixture',installedAt:new Date()}});
  f.principal={id:t.scope.sessionId,userId:t.scope.actorUserId,organizationId:t.org,credentialKind:'desktop_session',capabilities:['workspace:read','github:write']};f.commercial=true;f.token.mockReset();f.token.mockImplementation(async(org:string,repo:unknown,expected:any)=>{expect(org).toBe(t.org);expect(repo).toEqual({owner:'fixture',repo:'repository'});expect(expected).toMatchObject(connection);return{ok:true,token:'SIMULATED_PRIVATE_TOKEN'}});
  const previous=process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED,compose=(request:any,scope:any)=>createAgentActionExecutionRequestService(request,f.db,scope),handle=createAgentActionExecutionHttp(compose),post=(body:unknown)=>new NextRequest('https://fixture.test/operations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});let writes=0;
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:any)=>{
   expect(url.startsWith('https://api.github.com/repos/fixture/repository')).toBe(true);
   if(init.method==='GET')return url.endsWith('/repository')?Response.json({default_branch:'main'}):Response.json({sha:'a'.repeat(40)});
   expect(init.method).toBe('PUT');expect(JSON.parse(init.body)).toMatchObject({branch:'reviewed',sha:'a'.repeat(40),content:Buffer.from('new').toString('base64')});writes++;return Response.json({content:{sha:'b'.repeat(40),html_url:'https://github.com/fixture/repository/blob/reviewed/app.txt'}});
  }));
  try{
   process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED='true';const prepared=await handle(post({operation:'prepare',proposalId:t.proposal.id}));expect(prepared.status).toBe(201);const id=(await prepared.json()).data.id;
   const executed=await handle(post({operation:'execute',id}));expect(executed.status).toBe(200);expect((await executed.json()).data).toMatchObject({id,state:'confirmed',attemptCount:1});expect(writes).toBe(1);expect(f.token).toHaveBeenCalledOnce();
   expect((await handle(post({operation:'execute',id}))).status).toBe(409);expect(writes).toBe(1);expect(JSON.stringify(await f.db.durableAgentWorkflow.findUnique({where:{id}}))).not.toContain('SIMULATED_PRIVATE_TOKEN');
  }finally{if(previous===undefined)delete process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED;else process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED=previous;f.principal=null;f.commercial=true;}
 });

 it.each([false,true])('composes branch requester HTTP with exact commit and changed-source refusal=%s',async changed=>{
  const t=await fixture(60000,'create_github_branch',()=>({repositoryFullName:'fixture/repository',baseBranch:'main',newBranchName:'reviewed',_review:{kind:'github_branch',baseBranch:'main',newBranchName:'reviewed',baseSha:'a'.repeat(40)}}));
  const original=await f.db.agentActionProposal.findUnique({where:{id:t.proposal.id}});
  const connection={id:t.org+'-gh',githubInstallationId:'123',updatedAt:new Date()};await f.db.gitHubInstallation.create({data:{...connection,organizationId:t.org,status:'active',accountLogin:'fixture',installedAt:new Date()}});
  f.principal={id:t.scope.sessionId,userId:t.scope.actorUserId,organizationId:t.org,credentialKind:'desktop_session',capabilities:['workspace:read','github:write']};f.commercial=true;f.token.mockReset();f.token.mockImplementation(async(org:string,repo:unknown,expected:any)=>{expect(org).toBe(t.org);expect(repo).toEqual({owner:'fixture',repo:'repository'});expect(expected).toMatchObject(connection);return{ok:true,token:'SIMULATED_PRIVATE_TOKEN'}});
  const previous=process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED,compose=(request:any,scope:any)=>createAgentActionExecutionRequestService(request,f.db,scope),handle=createAgentActionExecutionHttp(compose),eligibility=createAgentActionEligibilityHttp(compose),get=()=>new NextRequest('https://fixture.test/readiness?proposalId='+t.proposal.id),post=(body:unknown)=>new NextRequest('https://fixture.test/operations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});let writes=0;
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:any)=>{
   expect(url.startsWith('https://api.github.com/repos/fixture/repository/')).toBe(true);
   if(init.method==='GET')return Response.json({object:{type:'commit',sha:(changed?'b':'a').repeat(40)}});
   expect(init.method).toBe('POST');expect(JSON.parse(init.body)).toEqual({ref:'refs/heads/reviewed',sha:'a'.repeat(40)});writes++;return Response.json({ref:'refs/heads/reviewed',object:{sha:'a'.repeat(40)}});
  }));
  try{
   process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED='true';
   const initial=await(await eligibility(get())).json();expect(initial.data).toMatchObject({canPrepare:true,canExecute:false,reason:'ready_to_prepare'});expect(initial.data).not.toHaveProperty('args');expect(initial.data).not.toHaveProperty('source');
   const prepared=await handle(post({operation:'prepare',proposalId:t.proposal.id}));expect(prepared.status).toBe(201);const id=(await prepared.json()).data.id;
   expect((await(await eligibility(get())).json()).data).toMatchObject({operationId:id,canExecute:true,canPrepare:false});
   const executed=await handle(post({operation:'execute',id}));expect(executed.status).toBe(200);expect((await executed.json()).data).toMatchObject({id,state:changed?'refused':'confirmed',attemptCount:1});expect(writes).toBe(changed?0:1);
   expect((await handle(post({operation:'execute',id}))).status).toBe(409);expect(writes).toBe(changed?0:1);expect(await f.db.agentActionProposal.findUnique({where:{id:t.proposal.id}})).toEqual(original);
   expect((await(await eligibility(get())).json()).data).toMatchObject({canPrepare:false,canExecute:false,reason:'operation_consumed'});
  }finally{if(previous===undefined)delete process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED;else process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED=previous;f.principal=null;f.commercial=true;}
 });

 it.each(['confirmed','head_changed','response_changed','legacy'])('composes pull-request requester HTTP source binding: %s',async mode=>{
  const args={repositoryFullName:'fixture/repository',head:'reviewed',base:'main',title:'Reviewed change',...(mode==='legacy'?{}:{_review:{kind:'github_pull_request',head:'reviewed',base:'main',headSha:'a'.repeat(40),baseSha:'b'.repeat(40)}})};
  const t=await fixture(60000,'open_github_pull_request',()=>args),original=await f.db.agentActionProposal.findUnique({where:{id:t.proposal.id}});
  const connection={id:t.org+'-gh',githubInstallationId:'123',updatedAt:new Date()};await f.db.gitHubInstallation.create({data:{...connection,organizationId:t.org,status:'active',accountLogin:'fixture',installedAt:new Date()}});
  f.principal={id:t.scope.sessionId,userId:t.scope.actorUserId,organizationId:t.org,credentialKind:'desktop_session',capabilities:['workspace:read','github:write']};f.commercial=true;f.token.mockReset();f.token.mockImplementation(async(org:string,repo:unknown,expected:any)=>{expect(org).toBe(t.org);expect(repo).toEqual({owner:'fixture',repo:'repository'});expect(expected).toMatchObject(connection);return{ok:true,token:'SIMULATED_PRIVATE_TOKEN'}});
  const previous=process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED,compose=(request:any,scope:any)=>createAgentActionExecutionRequestService(request,f.db,scope),handle=createAgentActionExecutionHttp(compose),eligibility=createAgentActionEligibilityHttp(compose),get=()=>new NextRequest('https://fixture.test/readiness?proposalId='+t.proposal.id),post=(body:unknown)=>new NextRequest('https://fixture.test/operations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});let writes=0;
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:any)=>{
   expect(url.startsWith('https://api.github.com/repos/fixture/repository/')).toBe(true);
   if(init.method==='GET')return Response.json({object:{type:'commit',sha:(url.endsWith('/reviewed')?(mode==='head_changed'?'c':'a'):'b').repeat(40)}});
   expect(init.method).toBe('POST');expect(JSON.parse(init.body)).toEqual({head:'reviewed',base:'main',title:'Reviewed change',body:''});writes++;
   return Response.json({number:42,html_url:'https://github.com/fixture/repository/pull/42',head:{ref:'reviewed',sha:(mode==='response_changed'?'c':'a').repeat(40),repo:{full_name:'fixture/repository'}},base:{ref:'main',sha:'b'.repeat(40),repo:{full_name:'fixture/repository'}}});
  }));
  try{
   process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED='true';const first=(await(await eligibility(get())).json()).data;expect(first.canPrepare).toBe(mode!=='legacy');expect(first).not.toHaveProperty('source');
   const prepared=await handle(post({operation:'prepare',proposalId:t.proposal.id}));
   if(mode==='legacy'){expect(prepared.status).toBe(409);expect(await f.db.durableAgentWorkflow.count({where:{organizationId:t.org,workflowKind:'agent_action_execution_v1'}})).toBe(0);expect(writes).toBe(0);expect(f.token).not.toHaveBeenCalled();return;}
   expect(prepared.status).toBe(201);const id=(await prepared.json()).data.id;expect((await(await eligibility(get())).json()).data).toMatchObject({canExecute:true,operationId:id});
   const executed=await handle(post({operation:'execute',id}));expect(executed.status).toBe(200);expect((await executed.json()).data).toMatchObject({id,state:mode==='confirmed'?'confirmed':mode==='head_changed'?'refused':'unknown',attemptCount:1});expect(writes).toBe(mode==='head_changed'?0:1);
   const recovery=await(await handle(new NextRequest('https://fixture.test/operations?id='+id))).json();expect(recovery.data.receipt.references).toEqual(mode==='confirmed'?[{kind:'github_pull_request',id:'42'}]:undefined);
   expect((await handle(post({operation:'execute',id}))).status).toBe(409);expect(writes).toBe(mode==='head_changed'?0:1);expect(await f.db.agentActionProposal.findUnique({where:{id:t.proposal.id}})).toEqual(original);
   expect((await(await eligibility(get())).json()).data).toMatchObject({canPrepare:false,canExecute:false,reason:'operation_consumed'});
  }finally{if(previous===undefined)delete process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED;else process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED=previous;f.principal=null;f.commercial=true;}
 });

});
