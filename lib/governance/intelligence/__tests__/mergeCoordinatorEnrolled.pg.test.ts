import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
// Actual stores/provenance/metadata issuer; pairing/config/signing/provider replies
// and the explicitly enabled coverage port are SIMULATED local qualification.
vi.mock('node:crypto',async()=>({...await vi.importActual<typeof import('node:crypto')>('node:crypto'),createSign:()=>({update(){},end(){},sign:()=>Buffer.from('SIMULATED_SIGNATURE')})}));
vi.mock('@/lib/connectors/github/githubConfig',()=>({getGithubConfig:async()=>({appConfigured:true,appId:123}),resolveGithubAppPrivateKey:async()=>'SIMULATED_SIGNING_KEY'}));
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
import {NextRequest} from 'next/server';
import {createGovernanceRevisionStore} from '../revisionStore';
import {createReleaseProviderMergeCoordinator} from '@/lib/desktop/releaseProviderMergeCoordinator';
import {createGovernanceRequestService} from '../requestService';
import {completeReleaseIntake} from '@/lib/tauri/__tests__/fixtures/completeReleaseIntake';
import {buildReleaseMergePlan} from '@/lib/tauri/releaseMergePlan';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {createReleaseOperationPlan,reviewReleaseOperationPlan} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {createReleaseProviderMergeApprovalStore} from '@/lib/tauri/releaseProviderMergeApprovalStore';
const FIXTURE=vi.hoisted(()=>({coverage:true,coverageReads:0,lastOrg:'',afterWarm:null as null|(()=>Promise<void>)}));
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:async(request:any)=>({credentialKind:'desktop_session',id:request.principal.sessionId,userId:request.principal.actorUserId,organizationId:request.principal.organizationId,capabilities:['workspace:read','policy:manage','github:read','deploy:execute','agent:approve']})}));
// ONLY this closed fixture extends actual empty production coverage. Every
// source/evidence/enrollment/authority/policy method remains actual requestService.
vi.mock('../requestService',async(importActual)=>{const actual:any=await importActual();return{...actual,createGovernanceRequestService:(...args:any[])=>{const service=actual.createGovernanceRequestService(...args);return{...service,readActiveEvidence:async(selection:any)=>{const result=await service.readActiveEvidence(selection);if(FIXTURE.afterWarm&&args[2].actorUserId==='executor'){const mutate=FIXTURE.afterWarm;FIXTURE.afterWarm=null;await mutate()}return result},readExecutionCoverage:async(selection:any)=>{const original=await service.readExecutionCoverage(selection);expect(original.coveredActions).toEqual([]);FIXTURE.coverageReads++;return{...original,coveredActions:FIXTURE.coverage&&original.enrolled?['repository.merge']:[]}}}}}});
function request(scope:any){const r=new NextRequest('https://fixture.invalid/local');Object.assign(r,{principal:scope});return r}
const socket=process.env.AXIOM_EXECUTION_POLICY_PG_SOCKET;
describe.skipIf(!socket)('actual enrolled coordinator selects V2; closed FIXTURE coverage/pairing/provider',()=>{
 let db:any,locker:any;
 beforeAll(async()=>{
  vi.stubEnv('AXIOM_GOVERNANCE_INTELLIGENCE_ENABLED','true');
  const generated=process.env.AXIOM_EXECUTION_POLICY_PG_CLIENT;
  if(!socket||!/^\/private\/tmp\/axiom-execution-policy-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||!generated||!generated.startsWith(socket.slice(0,-7)+'/generated/'))throw Error('owned_fixture_required');
  const Client=createRequire(import.meta.url)(generated).PrismaClient;
  locker=new Client({transactionOptions:{timeout:15000},datasources:{db:{url:`postgresql://policy_fixture@localhost/policy_fixture?host=${encodeURIComponent(socket)}`}}});
  db=new Client({transactionOptions:{timeout:15000},datasources:{db:{url:`postgresql://policy_fixture@localhost/policy_fixture?host=${encodeURIComponent(socket)}`}}});
  const[r]=await db.$queryRawUnsafe("SELECT current_database()='policy_fixture' AND current_user='policy_fixture' AND current_setting('listen_addresses')='' AS private");if(!r?.private)throw Error('owned_fixture_required');
 });
 afterAll(async()=>{vi.unstubAllEnvs();await locker?.$disconnect();await db?.$disconnect()});
 async function fixture(options:{missingBaseline?:boolean;otherScope?:boolean;expirySubject?:'executor'|'approver';sourceChangeAfterWarm?:boolean}={}){
  FIXTURE.coverage=true;FIXTURE.coverageReads=0;FIXTURE.afterWarm=null;
  const org='merge-'+randomUUID(),now=Date.now(),selection={repositoryId:'team/service',resourceId:'github:repository:team/service',environment:(options.otherScope?'staging':'production') as 'staging'|'production'};
  const identities=Object.fromEntries(['owner','reviewer','executor','creator','requester','approver'].map(userId=>[userId,{organizationId:org,actorUserId:userId,sessionId:org+'-'+userId}]));
  for(const[userId,role]of [['owner','admin'],['reviewer','security_reviewer'],['executor','operator'],['creator','admin'],['requester','operator'],['approver','security_reviewer']]){
   await db.orgMembership.create({data:{organizationId:org,userId,role,acceptedAt:new Date()}});
   await db.desktopSessionRecord.create({data:{id:identities[userId].sessionId,organizationId:org,userId,expiresAt:new Date(now+3600000)}});
  }
  FIXTURE.lastOrg=org;
  const scope=identities.executor,intake={...completeReleaseIntake(),id:'release-'+randomUUID(),tenantId:org,targetEnvironment:'production',windowStartUtc:new Date(now-60000).toISOString(),windowEndUtc:new Date(now+3600000).toISOString(),repositoryUrls:['https://github.com/team/service'],productionPrUrls:['https://github.com/team/service/pull/42'],sourceBranch:'feature',targetBranch:'main'};
  const release={id:intake.id,organizationId:org,requesterUserId:'requester',status:'submitted',version:1,intakeJson:intake},connection={id:'connection-'+randomUUID(),organizationId:org,githubInstallationId:'123',accountLogin:'team',status:'active',updatedAt:new Date(now),revokedAt:null,suspendedAt:null};
  await db.tauriDeploymentRequest.create({data:release});await db.gitHubInstallation.create({data:connection});
  const built=buildReleaseMergePlan(release,{organizationId:org,requestId:release.id,expectedVersion:1,expectedDigest:sha256ContentHash({requestVersion:1,intake}),method:'squash',observation:{connectionId:connection.id,connectionRevision:connection.updatedAt.toISOString(),repositoryFullName:'team/service',number:42,headRepositoryFullName:'team/service',headRef:'feature',headSha:'a'.repeat(40),baseRef:'main',baseSha:'b'.repeat(40),state:'open',draft:false,merged:false}});if(!built.ok)throw Error('fixture_plan_invalid');
  const plan=built.plan,planRecord=await createReleaseOperationPlan(db,{organizationId:org,actorUserId:'creator',assertCurrent:async()=>{},plan,planDigest:built.digest});
  await reviewReleaseOperationPlan(db,{organizationId:org,actorUserId:'reviewer',assertCurrent:async()=>{},id:planRecord.id,expectedVersion:0,clientRequestId:randomUUID(),decision:'reviewed',currentPlan:plan,currentPlanDigest:built.digest});
  const service=(actor:any)=>createGovernanceRequestService(request(actor),db,actor,()=>true),ownerService=service(identities.owner),reviewerService=service(identities.reviewer);
  const artifact=await ownerService.uploadDocument({name:'merge.md',selection,utf8Bytes:new TextEncoder().encode('Releases require verified evidence.'),expectedVersion:null,requestId:randomUUID()});
  const proposal=await ownerService.propose({organizationId:org,parentDigest:null,scopes:[selection],evidenceDigests:[artifact.snapshot.digest],rules:[{id:'merge-rule',actions:['repository.merge'],scope:selection,decision:'require_approval',requirements:['verified_evidence'],evidenceDigests:[artifact.snapshot.digest]}]},randomUUID());
  await reviewerService.approve(proposal.id,0,proposal.baseline.digest,randomUUID());
  // Explicit closed fixture activation only. Production has no coverage verifier.
  const fixtureActivation=createGovernanceRevisionStore(db,{assertCurrent:async()=>{},verifyEvidence:async()=>true,verifyCoverage:async()=>true});await fixtureActivation.activate(identities.owner,proposal.id,null,randomUUID());
  const policy=await ownerService.executionPolicies.propose({organizationId:org,scope:selection,parentDigest:null,autonomyLevel:4,actions:['repository.merge'],executorUserIds:['executor'],expiresAt:new Date(now+3600000).toISOString()},randomUUID());
  await reviewerService.executionPolicies.approve(policy.id,0,policy.policy.digest,randomUUID());await ownerService.executionPolicies.activate(policy.id,null,null,randomUUID());
  const approvalSource=service(identities.approver),executionSource=service(identities.executor);await approvalSource.readActiveEvidence(selection);await executionSource.readActiveEvidence(selection);
  const approvals=createReleaseProviderMergeApprovalStore(db,{assertGovernanceBaseline:(tx,sc,d,p)=>(sc.actorUserId==='approver'?approvalSource:executionSource).assertMergeApprovalBaseline(tx,sc,d,p),assertCurrent:async(tx,input)=>{
   const rows=await tx.$queryRaw<Array<{role:string;acceptedAt:Date}>>`SELECT "role","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${org} AND "userId"=${input.actorUserId} FOR SHARE`;
   if(rows.length!==1||!rows[0].acceptedAt||input.role==='approver'&&rows[0].role!=='security_reviewer'||input.role==='executor'&&rows[0].role!=='operator')throw Error('SIMULATED initial human issuer authority unavailable');
  }});
  await approvals.issue(identities.approver,{planId:planRecord.id,expectedPlanVersion:1,sourcePolicy:'expected_head_observed_base',executorUserId:'executor',...(!options.missingBaseline&&!options.otherScope?{governanceBaselineDigest:proposal.baseline.digest}:{}),clientRequestId:randomUUID()});
  // The real coordinator prepares this enrolled operation below.
  let operation:any;
  let mode='valid',merged=false,exactExpiry=0;const calls:Array<{method:string;url:string;profile?:string;attempt:number}>=[];
  const pr=()=>({number:42,state:merged?'closed':'open',draft:false,merged,merge_commit_sha:merged?'e'.repeat(40):null,head:{sha:plan.pullRequest.headSha,ref:'feature',repo:{full_name:'team/service'}},base:{sha:plan.pullRequest.baseSha,ref:'main',repo:{full_name:'team/service'}}});
  const fetcher=vi.fn(async(url:any,init:any)=>{
   await locker.$transaction(async(tx:any)=>{await tx.$queryRaw`SELECT "id" FROM "DurableAgentWorkflow" WHERE "id" IN (${operation.id},${planRecord.id}) FOR UPDATE NOWAIT`});
   const current=await db.durableAgentWorkflow.findUnique({where:{id:operation.id}}),target=String(url);const body=init.body?JSON.parse(init.body):null,profile=target.endsWith('/access_tokens')?(body.permissions.contents==='write'?'write':'read_only'):undefined;calls.push({method:init.method,url:target,profile,attempt:current.attemptCount});
   if(profile){if(profile==='write'){expect(current).toMatchObject({currentStep:'dispatching',attemptCount:1});expect(await db.durableAgentWorkflow.count({where:{organizationId:org,workflowKind:'release_credential_exposure_v1',currentStep:'pending'}})).toBe(1);exactExpiry=Date.now()+3600000}else expect(body.permissions).toEqual({administration:'read',contents:'read',pull_requests:'read',metadata:'read'});
    const permissions=mode==='profile_changed'&&profile==='read_only'?{...body.permissions,contents:'write'}:body.permissions;
    return Response.json({token:profile==='write'?'SIMULATED_WRITE_TOKEN':'SIMULATED_READ_TOKEN',expires_at:new Date(profile==='write'?exactExpiry:Date.now()+3600000).toISOString(),permissions,repository_selection:'selected',repositories:[{name:'service',full_name:'team/service',owner:{login:'team'}}]},{status:201});}
   if(target.endsWith('/installation')||target.endsWith('/app/installations/123')){if(mode==='metadata_missing')return Response.json({},{status:404});return Response.json({id:123,app_id:123,account:{id:456,login:'team',type:'Organization'},suspended_at:null,repository_selection:'selected',permissions:{contents:'write',pull_requests:'read',metadata:'read'}})}
   if(init.method==='PUT'){merged=true;return Response.json({sha:'e'.repeat(40),merged:true})}
   if(target.includes('/compare/'))return Response.json({status:'ahead',ahead_by:1,behind_by:0,total_commits:1,base_commit:{sha:plan.pullRequest.baseSha},merge_base_commit:{sha:plan.pullRequest.baseSha},commits:[{sha:plan.pullRequest.headSha,parents:[{sha:plan.pullRequest.baseSha}]}]});
   if(target.includes('/rulesets?')||target.includes('/rules/branches/'))return Response.json([]);
   if(target.endsWith('/protection'))return Response.json({},{status:404});
   if(target.includes('/pulls?'))return Response.json([pr()]);
   if(target.endsWith('/pulls/42'))return Response.json(pr());
   return Response.json({id:12,full_name:'team/service',default_branch:'main',archived:false,disabled:false,allow_merge_commit:true,allow_squash_merge:true,allow_rebase_merge:true});
  });
  const coordinatorRepo=options.expirySubject?new Proxy(db,{get(target,key){if(key==='$transaction')return async(fn:any,opts:any)=>{const result=await target.$transaction(fn,opts);if(result?.state==='prepared'&&result?.attemptCount===0)await locker.$queryRaw`SELECT true AS delayed FROM pg_sleep(1.1)`;return result};const value=target[key];return typeof value==='function'?value.bind(target):value}}):db;
  const coordinator=createReleaseProviderMergeCoordinator(coordinatorRepo,request(scope),{enabled:()=>true,useScopedInstallationTokens:true,useVerifiedLinearTopology:true,mergeTopologyPolicy:'empty_effective_target',fetch:fetcher as typeof fetch});
  if(options.expirySubject)await db.desktopSessionRecord.update({where:{id:identities[options.expirySubject].sessionId},data:{expiresAt:new Date(Date.now()+1000)}});
  if(options.sourceChangeAfterWarm)FIXTURE.afterWarm=async()=>{await ownerService.uploadDocument({name:'merge.md',selection,utf8Bytes:new TextEncoder().encode('Releases require independent approval.'),expectedVersion:artifact.headVersion,requestId:randomUUID()})};
  operation=await coordinator.prepare(planRecord.id);
  return{org,scope,operation,planRecord,calls,coordinator,setMode:(value:string)=>mode=value,exactExpiry:()=>exactExpiry,rows:()=>db.durableAgentWorkflow.findMany({where:{organizationId:org,workflowKind:'release_credential_exposure_v1'}}),saved:()=>db.durableAgentWorkflow.findUnique({where:{id:operation.id}})};
 }
 it('normal hasAnyEnrollment branch composes actual V2 eligibility, readonly source and one tracked postclaim write grant/PUT',async()=>{
  const f=await fixture();expect(await f.coordinator.run(f.operation.id)).toMatchObject({state:'confirmed',attemptCount:1});expect(FIXTURE.coverageReads).toBeGreaterThan(0);expect(f.calls.filter(c=>c.profile==='read_only'&&c.attempt===0).length).toBeGreaterThan(0);expect(f.calls.filter(c=>c.profile==='write')).toHaveLength(1);expect(f.calls.filter(c=>c.profile==='write').every(c=>c.attempt===1)).toBe(true);expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(1);
  const rows=await f.rows();expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({currentStep:'issued',version:1});expect(rows[0].stateJson.providerExpiresAt).toBe(f.exactExpiry());expect(JSON.stringify(rows)).not.toContain('SIMULATED_WRITE_TOKEN');await expect(f.coordinator.run(f.operation.id)).rejects.toThrow('governance_merge_binding_unavailable');expect(f.calls.filter(c=>c.profile==='write')).toHaveLength(1);expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(1);
 });
 it.each(['metadata_missing','profile_changed'])('actual enrolled coordinator refuses %s before claim or write issuance',async mode=>{const f=await fixture();f.setMode(mode);await expect(f.coordinator.run(f.operation.id)).rejects.toThrow();expect(f.calls.filter(c=>c.profile==='write')).toHaveLength(0);expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(0);expect(await f.rows()).toEqual([]);expect(await f.saved()).toMatchObject({currentStep:'prepared',attemptCount:0})});
 it('the actual production-empty coverage result still refuses when the closed fixture extension is disabled',async()=>{const f=await fixture();FIXTURE.coverage=false;await expect(f.coordinator.run(f.operation.id)).rejects.toThrow();expect(f.calls.filter(c=>c.profile==='write')).toHaveLength(0);expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(0);expect(await f.saved()).toMatchObject({attemptCount:0})});
 it('actual enrolled prepare requires the current exact baseline on the original independent approval',async()=>{await expect(fixture({missingBaseline:true})).rejects.toThrow();expect(await db.durableAgentWorkflow.count({where:{organizationId:FIXTURE.lastOrg,workflowKind:'release_provider_merge_v1'}})).toBe(0)});
 it('organization enrollment without selected-scope enrollment cannot silently use the legacy prepare path',async()=>{await expect(fixture({otherScope:true})).rejects.toThrow();expect(await db.durableAgentWorkflow.count({where:{organizationId:FIXTURE.lastOrg,workflowKind:'release_provider_merge_v1'}})).toBe(0)});
 it.each(['executor','approver'] as const)('actual enrolled prepare retains original %s expiry after committed result delivery',async expirySubject=>{await expect(fixture({expirySubject})).rejects.toThrow();const row=await db.durableAgentWorkflow.findFirst({where:{organizationId:FIXTURE.lastOrg,workflowKind:'release_provider_merge_v1'}});expect(row).toMatchObject({currentStep:'prepared',attemptCount:0});expect(await db.durableAgentWorkflow.count({where:{organizationId:FIXTURE.lastOrg,workflowKind:'release_credential_exposure_v1'}})).toBe(0);expect(await db.durableAgentWorkflow.findFirst({where:{organizationId:FIXTURE.lastOrg,workflowKind:'release_provider_merge_approval_v1'}})).toMatchObject({currentStep:'approved'})});

 it('actual current source head changed after outside-lock warmup refuses before enrolled preparation persists',async()=>{await expect(fixture({sourceChangeAfterWarm:true})).rejects.toThrow();expect(FIXTURE.afterWarm).toBeNull();expect(await db.durableAgentWorkflow.count({where:{organizationId:FIXTURE.lastOrg,workflowKind:'release_provider_merge_v1'}})).toBe(0);expect(await db.durableAgentWorkflow.count({where:{organizationId:FIXTURE.lastOrg,workflowKind:'release_credential_exposure_v1'}})).toBe(0)});

});
