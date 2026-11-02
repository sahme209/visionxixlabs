import {afterAll,afterEach,beforeAll,describe,it,expect,vi} from 'vitest';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
import {NextRequest} from 'next/server';
const f=vi.hoisted(()=>({db:null as any,principal:null as any,authCalls:0,revokeAt:0,token:vi.fn()}));
// Authentication, commercial entitlement and independent human decision are
// simulated. Source review rows, membership, session, connection, locks, CAS,
// private claims, current SQL and fixed GitHub transport below are real.
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:async()=>{
 f.authCalls++;if(f.revokeAt===f.authCalls)await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:f.principal.organizationId,userId:'reviewer'}},data:{role:'read_only'}});return f.principal;
}}));
vi.mock('@/lib/connectors/github/resolveTenantScopedToken',async importActual=>({...await importActual<typeof import('@/lib/connectors/github/resolveTenantScopedToken')>(),resolveTenantScopedToken:f.token}));
vi.mock('@/lib/db',()=>({prisma:new Proxy({},{get(_t,key){const v=f.db[key];return typeof v==='function'?v.bind(f.db):v}})}));
vi.mock('../agentIdentityPolicy',()=>({readWorkspaceAgentIdentity:(org:string)=>f.db.workspaceAgentIdentity.findUnique({where:{organizationId:org}})}));
import {decideAgentAction} from '../browserApprovalDecision';
import {agentActionDigest} from '../proposalIntegrity';
import {createAgentActionExecutionStore} from '../agentActionExecutionStore';
import {createAgentActionExecutionCoordinator} from '../agentActionExecutionCoordinator';
const socket=process.env.AXIOM_EXECUTION_POLICY_PG_SOCKET;
describe.skipIf(!socket)('actual coordinator SQL/CAS/guard/fixed transport; simulated authentication, human review and provider',()=>{
 beforeAll(async()=>{
  const generated=process.env.AXIOM_EXECUTION_POLICY_PG_CLIENT;
  if(!socket||!/^\/private\/tmp\/axiom-execution-policy-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||!generated||!generated.startsWith(socket.slice(0,-7)+'/generated/'))throw Error('owned_fixture_required');
  const Client=createRequire(import.meta.url)(generated).PrismaClient;
  f.db=new Client({datasources:{db:{url:`postgresql://policy_fixture@localhost/policy_fixture?host=${encodeURIComponent(socket)}`}}});
  const [r]=await f.db.$queryRawUnsafe("SELECT current_database()='policy_fixture' AND current_user='policy_fixture' AND current_setting('listen_addresses')='' AS private");if(!r?.private)throw Error('owned_fixture_required');
 });
 afterEach(()=>vi.unstubAllGlobals());afterAll(async()=>f.db?.$disconnect());
 async function fixture(toolName='create_github_branch',buildArgs?:(org:string)=>Record<string,unknown>){
  f.authCalls=0;f.revokeAt=0;f.token.mockReset();
  const organizationId='agent-coordinator-'+randomUUID(),sessionId=organizationId+'-session',now=new Date();
  for(const [userId,role]of [['requester',['create_environment','configure_deployment_target','connect_identity_provider'].includes(toolName)?'admin':'operator'],['reviewer','security_reviewer']])await f.db.orgMembership.create({data:{organizationId,userId,role,acceptedAt:now}});
  await f.db.desktopSessionRecord.create({data:{id:sessionId,organizationId,userId:'requester',expiresAt:new Date(Date.now()+60000)}});
  await f.db.workspaceAgentIdentity.create({data:{organizationId,enabled:true,allowedTools:[toolName],updatedBy:'reviewer'}});
  const connection={id:organizationId+'-installation',githubInstallationId:'123',updatedAt:now};
  await f.db.gitHubInstallation.create({data:{...connection,organizationId,accountLogin:'fixture',status:'active',installedAt:now}});
  const conversation=await f.db.agentConversation.create({data:{organizationId,userId:'requester'}});
  const input={organizationId,conversationId:conversation.id,proposedByUserId:'requester',toolName,args:buildArgs?.(organizationId)??{repositoryFullName:'fixture/repository',baseBranch:'main',newBranchName:'reviewed'}};
  const {args,...source}=input;
  const proposal=await f.db.agentActionProposal.create({data:{...source,argsJson:args,actionDigest:agentActionDigest(input),riskLevel:'medium',approvalExpiresAt:new Date(Date.now()+60000)}});
  expect(await decideAgentAction({organizationId,proposalId:proposal.id,actorUserId:'reviewer',actorRole:'security_reviewer',decision:'approve'})).toEqual({ok:true,status:'approved'});
  const scope={organizationId,actorUserId:'requester',sessionId};
  const principal={id:sessionId,organizationId,userId:'requester',credentialKind:'desktop_session' as const,capabilities:toolName==='trigger_aws_deploy'?['deploy:execute' as const,'workspace:read' as const]:['github:write' as const,'workspace:read' as const]};f.principal=principal;
  const store=createAgentActionExecutionStore(f.db,{async assertCurrent(_tx,current){
   // Simulated request authentication only. Persisted store authority is not
   // replaced: store and final guard query actual rows independently.
   if(!f.principal||f.principal.id!==current.sessionId||f.principal.userId!==current.actorUserId||f.principal.organizationId!==current.organizationId)throw Error('simulated_authentication_refused');
  }});
  f.token.mockImplementation(async(org:string,target:unknown,expected:any,repo:unknown)=>{
   expect(org).toBe(organizationId);expect(target).toEqual({owner:'fixture',repo:'repository'});expect(expected).toMatchObject(connection);expect(expected.signal).toBeInstanceOf(AbortSignal);expect(repo).toBe(f.db);return{ok:true,token:'SIMULATED_PRIVATE_TOKEN'};
  });
  const operation=await store.prepare(scope,proposal.id),request=new NextRequest('https://fixture.test/local');
  const coordinator=createAgentActionExecutionCoordinator(request,principal,f.db,store,scope);
  let writes=0;let lost=false;
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:any)=>{
   expect(url.startsWith('https://api.github.com/repos/fixture/repository/')).toBe(true);
   if(init.method==='GET')return Response.json({object:{type:'commit',sha:'a'.repeat(40)}});
   expect(init.method).toBe('POST');expect(JSON.parse(init.body)).toEqual({ref:'refs/heads/reviewed',sha:'a'.repeat(40)});writes++;
   if(lost)throw Error('SIMULATED_PRIVATE_TOKEN lost provider response');
   return Response.json({ref:'refs/heads/reviewed',object:{sha:'a'.repeat(40)}});
  }));
  return{store,scope,proposal,operation,coordinator,connection,writes:()=>writes,loseResponse(){lost=true}};
 }
 it('completes one saved branch using pinned credentials and immutable original review',async()=>{
  const t=await fixture(),before=await f.db.agentActionProposal.findMany({where:{organizationId:t.scope.organizationId}});
  expect(await t.coordinator.execute(t.operation.id)).toMatchObject({state:'confirmed',attemptCount:1,receipt:{code:'action_completed'}});expect(t.writes()).toBe(1);expect(f.token).toHaveBeenCalledOnce();
  expect(await f.db.agentActionProposal.findMany({where:{organizationId:t.scope.organizationId}})).toEqual(before);
  const row=await f.db.durableAgentWorkflow.findUnique({where:{id:t.operation.id}});expect(row).toMatchObject({currentStep:'confirmed',attemptCount:1,version:2});expect(JSON.stringify(row)).not.toContain('SIMULATED_PRIVATE_TOKEN');
 });
 it('keeps one lost POST consumed unknown and re-execution issues zero additional writes',async()=>{
  const t=await fixture();t.loseResponse();expect(await t.coordinator.execute(t.operation.id)).toMatchObject({state:'unknown',attemptCount:1,receipt:{code:'provider_outcome_unknown'}});expect(t.writes()).toBe(1);
  const restarted=createAgentActionExecutionCoordinator(new NextRequest('https://fixture.test/local'),f.principal,f.db,t.store,t.scope);
  await expect(restarted.execute(t.operation.id)).rejects.toThrow('agent_execution_unavailable');expect(t.writes()).toBe(1);expect(f.token).toHaveBeenCalledOnce();expect(await t.store.get(t.scope,t.operation.id)).toMatchObject({state:'unknown',attemptCount:1,version:2});
 });
 it('refuses reviewer revocation committed during the later asynchronous guard with no POST',async()=>{
  const t=await fixture();f.revokeAt=7;
  expect(await t.coordinator.execute(t.operation.id)).toMatchObject({state:'refused',attemptCount:1,receipt:{code:'pre_dispatch_refused'}});expect(f.authCalls).toBeGreaterThanOrEqual(7);expect(t.writes()).toBe(0);
  const membership=await f.db.orgMembership.findUnique({where:{organizationId_userId:{organizationId:t.scope.organizationId,userId:'reviewer'}}});expect(membership.role).toBe('read_only');
 });
 it('competing coordinators can dispatch at most one provider write',async()=>{
  const t=await fixture(),other=createAgentActionExecutionCoordinator(new NextRequest('https://fixture.test/local'),f.principal,f.db,t.store,t.scope);
  const results=await Promise.allSettled([t.coordinator.execute(t.operation.id),other.execute(t.operation.id)]);
  expect(results.some(r=>r.status==='fulfilled'&&r.value.state==='confirmed')).toBe(true);expect(t.writes()).toBe(1);expect(f.token).toHaveBeenCalledOnce();expect(await t.store.get(t.scope,t.operation.id)).toMatchObject({state:'confirmed',attemptCount:1});
 });
 it.each(['create_environment','configure_deployment_target','connect_identity_provider'])('actual fixed database coordinator %s commits one mutation and outcome together without provider access',async toolName=>{
  const args=(org:string):Record<string,unknown>=>toolName==='create_environment'?{slug:'qa',name:'Reviewed QA',tier:'qa'}:toolName==='configure_deployment_target'?{environmentId:org+'-env',roleArn:'arn:aws:iam::123456789012:role/deploy',region:'us-east-1',ecsCluster:'cluster',ecsService:'service'}:{protocol:'oidc',issuerOrEntityId:'https://identity.fixture.test',metadataDocument:'fixture metadata',managedDomains:['fixture.test'],roleMapping:[{claimKey:'group',claimValue:'ops',role:'operator'}],requireMfaClaim:true};
  const t=await fixture(toolName,args);
  await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.scope.organizationId,userId:t.scope.actorUserId}},data:{role:'admin'}});
  if(toolName==='configure_deployment_target')await f.db.environment.create({data:{id:t.scope.organizationId+'-env',organizationId:t.scope.organizationId,tier:'qa',slug:'qa',name:'QA'}});
  const before=await f.db.agentActionProposal.findUnique({where:{id:t.proposal.id}});
  vi.stubGlobal('fetch',vi.fn(()=>{throw Error('database tool must not access provider')}));
  const result=await t.coordinator.execute(t.operation.id);
  expect(result).toMatchObject({state:'confirmed',attemptCount:1,receipt:{code:'action_completed'}});
  expect(await f.db.agentActionProposal.findUnique({where:{id:t.proposal.id}})).toEqual(before);
  expect(f.token).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
  if(toolName==='create_environment')expect(await f.db.environment.findMany({where:{organizationId:t.scope.organizationId}})).toMatchObject([{slug:'qa',name:'Reviewed QA',tier:'qa'}]);
  if(toolName==='configure_deployment_target')expect(await f.db.deploymentTarget.findMany({where:{organizationId:t.scope.organizationId}})).toMatchObject([{environmentId:t.scope.organizationId+'-env',roleArn:args(t.scope.organizationId).roleArn}]);
  if(toolName==='connect_identity_provider')expect(await f.db.tenantIdentityProvider.findMany({where:{organizationId:t.scope.organizationId}})).toMatchObject([{protocol:'oidc',configuredByUserId:t.scope.actorUserId,status:'pending'}]);
  await expect(t.coordinator.execute(t.operation.id)).rejects.toThrow();
  expect(await f.db.durableAgentWorkflow.findUnique({where:{id:t.operation.id}})).toMatchObject({attemptCount:1,status:'completed'});
 });

 it.each(['confirmed','lost','rejected'])('actual AWS coordinator policy/quota/store/fixed dispatch %s is one attempt',async mode=>{
  const revision=new Date();
  const args=(org:string)=>({repositoryFullName:'fixture/repository',environmentId:org+'-env',sourceRef:'main',sourceKind:'branch',_review:{kind:'ecs_restart_target',organizationId:org,environmentId:org+'-env',environmentTier:'qa',targetId:org+'-target',provider:'aws',targetUpdatedAt:revision.toISOString(),roleArn:'arn:aws:iam::123456789012:role/deploy',region:'us-east-1',ecsCluster:'cluster',ecsService:'service'}});
  const t=await fixture('trigger_aws_deploy',args),input=args(t.scope.organizationId),target=input._review;
  await f.db.environment.create({data:{id:input.environmentId,organizationId:t.scope.organizationId,tier:'qa',slug:'qa',name:'QA'}});
  await f.db.deploymentTarget.create({data:{id:target.targetId,environmentId:input.environmentId,organizationId:t.scope.organizationId,provider:'aws',updatedAt:revision,roleArn:target.roleArn,region:target.region,ecsCluster:target.ecsCluster,ecsService:target.ecsService}});
  await f.db.tenantBillingPlan.create({data:{organizationId:t.scope.organizationId,tier:'pro',status:'active'}});
  let posts=0;
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:any)=>{
   expect(url.startsWith('https://api.github.com/repos/fixture/repository/')).toBe(true);
   if(init.method==='GET')return Response.json({object:{type:'commit',sha:'a'.repeat(40)}});
   expect(init.method).toBe('POST');expect(JSON.parse(init.body)).toMatchObject({ref:'main',inputs:{role_arn:target.roleArn,region:target.region,cluster:target.ecsCluster,service:target.ecsService}});posts++;
   if(mode==='lost')throw Error('simulated response lost');if(mode==='rejected')return new Response('refused',{status:403});
   return Response.json({workflow_run_id:42,html_url:'https://github.com/fixture/repository/actions/runs/42'});
  }));
  const result=await t.coordinator.execute(t.operation.id);
  expect(result).toMatchObject({state:mode==='confirmed'?'confirmed':mode==='lost'?'unknown':'refused',attemptCount:1});expect(posts).toBe(1);
  const reservations=await f.db.deploymentExecution.findMany({where:{organizationId:t.scope.organizationId}});
  if(mode==='rejected')expect(reservations).toHaveLength(0);else expect(reservations).toMatchObject([{idempotencyKey:t.operation.id,triggeredByUserId:t.scope.actorUserId,sourceCommitSha:'a'.repeat(40),status:mode==='lost'?'reserved':'queued'}]);
  await expect(t.coordinator.execute(t.operation.id)).rejects.toThrow();expect(posts).toBe(1);
  expect(await f.db.durableAgentWorkflow.findUnique({where:{id:t.operation.id}})).toMatchObject({attemptCount:1});
 });

});
