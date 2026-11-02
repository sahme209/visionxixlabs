import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
import {NextRequest} from 'next/server';
vi.mock('node:crypto',async()=>({...await vi.importActual<typeof import('node:crypto')>('node:crypto'),createSign:()=>({update(){},end(){},sign:()=>Buffer.from('SIMULATED_RSA_SIGNATURE')})}));
vi.mock('@/lib/connectors/github/githubConfig',()=>({getGithubConfig:async()=>({appConfigured:true,appId:123}),resolveGithubAppPrivateKey:async()=>'SIMULATED_RSA_KEY'}));
const auth=vi.hoisted(()=>({principal:null as any}));
vi.mock('../resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:async()=>auth.principal}));
import {createReleaseProviderMergeCoordinator} from '../releaseProviderMergeCoordinator';
import {completeReleaseIntake} from '@/lib/tauri/__tests__/fixtures/completeReleaseIntake';
import {buildReleaseMergePlan} from '@/lib/tauri/releaseMergePlan';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {createReleaseOperationPlan,reviewReleaseOperationPlan} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {createReleaseProviderMergeApprovalStore} from '@/lib/tauri/releaseProviderMergeApprovalStore';
const socket=process.env.AXIOM_MERGE_COORDINATOR_PG_SOCKET;
/** Actual coordinator, stores, approval/history and Governance metadata/authority.
 * Paired/commercial auth, initial human review and provider credential/policy/IO
 * are simulated. No coverage/enrollment activation or live merge qualification. */
describe.skipIf(!socket)('actual coordinator legacy exposure handoff on owned PostgreSQL; provider/pairing simulated',()=>{
 let db:any,other:any,network:ReturnType<typeof vi.spyOn>;
 beforeAll(async()=>{
  const generated=process.env.AXIOM_MERGE_COORDINATOR_PG_CLIENT;
  if(!socket||!/^\/private\/tmp\/axiom-merge-coordinator-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||!generated||generated!==socket.slice(0,-7)+'/generated/index.js'||realpathSync(generated)!==generated)throw Error('owned_fixture_required');
  const Client=createRequire(import.meta.url)(generated).PrismaClient,url=`postgresql://merge_coordinator_fixture@localhost/merge_coordinator_fixture?host=${encodeURIComponent(socket)}`;
  db=new Client({transactionOptions:{timeout:15000},datasources:{db:{url}}});other=new Client({transactionOptions:{timeout:15000},datasources:{db:{url}}});
  const[r]=await db.$queryRawUnsafe("SELECT current_database()='merge_coordinator_fixture' AND current_user='merge_coordinator_fixture' AND current_setting('listen_addresses')='' AS private");if(r?.private!==true)throw Error('owned_fixture_required');
  network=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('live provider forbidden'));
  vi.stubEnv('AXIOM_GOVERNANCE_INTELLIGENCE_ENABLED','false');
 });
 afterAll(async()=>{expect(network).not.toHaveBeenCalled();network?.mockRestore();vi.unstubAllEnvs();await other?.$disconnect();await db?.$disconnect()});
 async function fixture(builtIn=false){
  const org='coordinator-'+randomUUID(),at=Date.now();
  const identities=Object.fromEntries(['creator','requester','reviewer','approver','executor'].map(userId=>[userId,{organizationId:org,actorUserId:userId,sessionId:org+'-'+userId}]));
  for(const[userId,role]of [['creator','admin'],['requester','operator'],['reviewer','security_reviewer'],['approver','security_reviewer'],['executor','operator']]){
   await db.orgMembership.create({data:{organizationId:org,userId,role,acceptedAt:new Date(at)}});await db.desktopSessionRecord.create({data:{id:identities[userId].sessionId,organizationId:org,userId,expiresAt:new Date(at+120000)}});
  }
  const intake={...completeReleaseIntake(),id:'release-'+randomUUID(),tenantId:org,targetEnvironment:'custom-staging',windowStartUtc:new Date(at-60000).toISOString(),windowEndUtc:new Date(at+120000).toISOString(),repositoryUrls:['https://github.com/team/service'],productionPrUrls:['https://github.com/team/service/pull/42'],sourceBranch:'feature',targetBranch:'main'};
  const release={id:intake.id,organizationId:org,requesterUserId:'requester',status:'submitted',version:1,intakeJson:intake},connection={id:'connection-'+randomUUID(),organizationId:org,githubInstallationId:'123',accountLogin:'team',status:'active',updatedAt:new Date(at),revokedAt:null,suspendedAt:null};
  await db.tauriDeploymentRequest.create({data:release});await db.gitHubInstallation.create({data:connection});
  const built=buildReleaseMergePlan(release,{organizationId:org,requestId:release.id,expectedVersion:1,expectedDigest:sha256ContentHash({requestVersion:1,intake}),method:'squash',observation:{connectionId:connection.id,connectionRevision:connection.updatedAt.toISOString(),repositoryFullName:'team/service',number:42,headRepositoryFullName:'team/service',headRef:'feature',headSha:'a'.repeat(40),baseRef:'main',baseSha:'b'.repeat(40),state:'open',draft:false,merged:false}});if(!built.ok)throw Error('fixture_plan_invalid');
  const plan=built.plan,record=await createReleaseOperationPlan(db,{organizationId:org,actorUserId:'creator',assertCurrent:async()=>{},plan,planDigest:built.digest});
  await reviewReleaseOperationPlan(db,{organizationId:org,actorUserId:'reviewer',assertCurrent:async()=>{},id:record.id,expectedVersion:0,clientRequestId:randomUUID(),decision:'reviewed',currentPlan:plan,currentPlanDigest:built.digest});
  // Initial independent decision is a synthetic fixture boundary. All subsequent
  // consumption/current-role/original-session checks use actual coordinator code.
  const approvals=createReleaseProviderMergeApprovalStore(db,{assertCurrent:async(tx,input)=>{
   const rows=await tx.$queryRaw<Array<{role:string}>>`SELECT "role" FROM "OrgMembership" WHERE "organizationId"=${org} AND "userId"=${input.actorUserId} FOR SHARE`;
   if(rows.length!==1||input.role==='approver'&&rows[0].role!=='security_reviewer'||input.role==='executor'&&rows[0].role!=='operator')throw Error('fixture_issuer_authority_required');
  }});
  const approval=await approvals.issue(identities.approver,{planId:record.id,expectedPlanVersion:1,sourcePolicy:'expected_head_observed_base',executorUserId:'executor',clientRequestId:randomUUID()});
  auth.principal={id:identities.executor.sessionId,userId:'executor',organizationId:org,credentialKind:'desktop_session',capabilities:['workspace:read','github:read','deploy:execute']};
  let firstOrgLock:(()=>void)|undefined;
  const repo=new Proxy(db,{get(target,key){if(key==='$transaction')return(fn:any)=>target.$transaction((tx:any)=>fn(new Proxy(tx,{get(inner,method){if(method==='$queryRaw')return async(q:TemplateStringsArray,...args:any[])=>{if(firstOrgLock&&q.join('').includes('pg_advisory_xact_lock')){const hook=firstOrgLock;firstOrgLock=undefined;hook()}return inner.$queryRaw(q,...args)};const value=inner[method];return typeof value==='function'?value.bind(inner):value}})));const value=target[key];return typeof value==='function'?value.bind(target):value}});
  const calls:Array<{method:string;url:string}>=[];let merged=false;let afterTarget:(()=>Promise<void>)|undefined;
  const fetcher=vi.fn(async(url:any,init:any)=>{
   await other.$transaction(async(tx:any)=>{await tx.$queryRaw`SELECT "id" FROM "DurableAgentWorkflow" WHERE "id" IN (${record.id},${operation.id}) FOR UPDATE NOWAIT`;});
   calls.push({method:init.method,url:String(url)});
   if(String(url).endsWith('/access_tokens')){
    expect(init.method).toBe('POST');expect(JSON.parse(init.body)).toEqual({repositories:['service'],permissions:{contents:'write',pull_requests:'read',metadata:'read'}});
    expect(await other.durableAgentWorkflow.findUnique({where:{id:operation.id}})).toMatchObject({currentStep:'dispatching',attemptCount:1});
    const pending=await other.durableAgentWorkflow.findMany({where:{organizationId:org,workflowKind:'release_credential_exposure_v1'}});expect(pending).toHaveLength(1);expect(pending[0]).toMatchObject({currentStep:'pending',version:0});pendingObserved=true;actualReturnedExpiry=Date.now()+120000;
    return Response.json({token:'SIMULATED_BUILTIN_TOKEN',expires_at:new Date(actualReturnedExpiry).toISOString(),permissions:{contents:'write',pull_requests:'read',metadata:'read'},repository_selection:'selected',repositories:[{name:'service',full_name:'team/service',owner:{login:'team'}}]},{status:201});
   }
   if(init.method==='PUT'){merged=true;return Response.json({sha:'e'.repeat(40),merged:true})}
   if(afterTarget){const action=afterTarget;afterTarget=undefined;await action()}
   return Response.json({number:42,state:merged?'closed':'open',draft:false,merged,merge_commit_sha:merged?'e'.repeat(40):null,head:{sha:plan.pullRequest.headSha,ref:'feature',repo:{full_name:'team/service'}},base:{sha:plan.pullRequest.baseSha,ref:'main',repo:{full_name:'team/service'}}});
  });
  let actualReturnedExpiry=0,pendingObserved=false;
  const credential=vi.fn(async()=>{
   // This is the actual selected issuer callback boundary; ledger reservation
   // and claim authority must already be committed and no store lock held.
   await other.$transaction(async(tx:any)=>{await tx.$queryRaw`SELECT "id" FROM "DurableAgentWorkflow" WHERE "id" IN (${record.id},${operation.id}) FOR UPDATE NOWAIT`;});
   const current=await other.durableAgentWorkflow.findUnique({where:{id:operation.id}});expect(current).toMatchObject({currentStep:'dispatching',attemptCount:1});
   const pending=await other.durableAgentWorkflow.findMany({where:{organizationId:org,workflowKind:'release_credential_exposure_v1'}});expect(pending).toHaveLength(1);expect(pending[0]).toMatchObject({currentStep:'pending',version:0});pendingObserved=true;actualReturnedExpiry=Date.now()+120000;
   return{organizationId:org,connectionId:connection.id,connectionRevision:plan.connectionRevision,repositoryFullName:'team/service',installationId:'123',token:'SIMULATED_TOKEN',expiresAt:actualReturnedExpiry,contentsWrite:true as const,pullRequestsRead:true as const};
  });
  const policy=vi.fn(async()=>({organizationId:org,connectionId:connection.id,connectionRevision:plan.connectionRevision,repositoryFullName:'team/service',pullRequestNumber:42,headSha:plan.pullRequest.headSha,baseSha:plan.pullRequest.baseSha,mergeQueueRequired:false as const,stacked:false as const,sourcePolicy:'expected_head_observed_base' as const}));
  const controller=new AbortController(),coordinator=createReleaseProviderMergeCoordinator(repo,new NextRequest('https://fixture.invalid/local',{signal:controller.signal}),{enabled:()=>true,...(builtIn?{useScopedInstallationTokens:true}:{readCredential:credential}),readDirectMergeSupport:policy,fetch:fetcher as typeof fetch});
  const operation=await coordinator.prepare(record.id),saved=()=>other.durableAgentWorkflow.findUnique({where:{id:operation.id}}),savedApproval=()=>other.durableAgentWorkflow.findUnique({where:{id:approval.id}});
  return{org,identities,operation,coordinator,calls,credential,policy,saved,savedApproval,controller,evidence:()=>({actualReturnedExpiry,pendingObserved}),afterTarget(action:()=>Promise<void>){afterTarget=action},onOrgLock(action:()=>void){firstOrgLock=action}};
 }
 it('commits pending exposure before the actual coordinator issuer callback, then records its exact expiry before one legacy custom-scope merge',async()=>{
  const f=await fixture();expect(f.credential).not.toHaveBeenCalled();expect(await other.durableAgentWorkflow.count({where:{organizationId:f.org,workflowKind:'release_credential_exposure_v1'}})).toBe(0);
  expect(await f.coordinator.run(f.operation.id)).toMatchObject({state:'confirmed',attemptCount:1});expect(f.evidence().pendingObserved).toBe(true);expect(f.credential).toHaveBeenCalledOnce();expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(1);
  const rows=await other.durableAgentWorkflow.findMany({where:{organizationId:f.org,workflowKind:'release_credential_exposure_v1'}});expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({currentStep:'issued',version:1});expect(rows[0].stateJson.providerExpiresAt).toBe(f.evidence().actualReturnedExpiry);expect(JSON.stringify(rows)).not.toContain('SIMULATED_TOKEN');expect(await other.durableAgentWorkflowEvent.count({where:{workflowRunId:rows[0].id}})).toBe(2);
  expect(await f.coordinator.run(f.operation.id)).toMatchObject({state:'confirmed',attemptCount:1});expect(f.credential).toHaveBeenCalledOnce();expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(1);expect(await other.durableAgentWorkflow.count({where:{organizationId:f.org,workflowKind:'release_credential_exposure_v1'}})).toBe(1);
 });
 it('built-in scoped token issuer reaches real current authority and tracks one provider expiry before one exact PUT',async()=>{
  const f=await fixture(true);expect(await f.coordinator.run(f.operation.id)).toMatchObject({state:'confirmed',attemptCount:1});expect(f.credential).not.toHaveBeenCalled();expect(f.evidence().pendingObserved).toBe(true);expect(f.calls.filter(c=>c.url.endsWith('/access_tokens'))).toHaveLength(1);expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(1);
  const rows=await other.durableAgentWorkflow.findMany({where:{organizationId:f.org,workflowKind:'release_credential_exposure_v1'}});expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({currentStep:'issued',version:1});expect(rows[0].stateJson.providerExpiresAt).toBe(f.evidence().actualReturnedExpiry);expect(JSON.stringify(rows)).not.toContain('SIMULATED_BUILTIN_TOKEN');await f.coordinator.run(f.operation.id);expect(f.calls.filter(c=>c.url.endsWith('/access_tokens'))).toHaveLength(1);expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(1);
 });
});
