import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
import {NextRequest} from 'next/server';
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
describe.skipIf(!socket)('actual provider merge coordinator on owned PostgreSQL',()=>{
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
 async function fixture(){
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
   calls.push({method:init.method,url:String(url)});if(init.method==='PUT'){merged=true;return Response.json({sha:'e'.repeat(40),merged:true})}
   if(afterTarget){const action=afterTarget;afterTarget=undefined;await action()}
   return Response.json({number:42,state:merged?'closed':'open',draft:false,merged,merge_commit_sha:merged?'e'.repeat(40):null,head:{sha:plan.pullRequest.headSha,ref:'feature',repo:{full_name:'team/service'}},base:{sha:plan.pullRequest.baseSha,ref:'main',repo:{full_name:'team/service'}}});
  });
  const credential=vi.fn(async()=>({organizationId:org,connectionId:connection.id,connectionRevision:plan.connectionRevision,repositoryFullName:'team/service',installationId:'123',token:'SIMULATED_TOKEN',expiresAt:Date.now()+120000,contentsWrite:true as const,pullRequestsRead:true as const}));
  const policy=vi.fn(async()=>({organizationId:org,connectionId:connection.id,connectionRevision:plan.connectionRevision,repositoryFullName:'team/service',pullRequestNumber:42,headSha:plan.pullRequest.headSha,baseSha:plan.pullRequest.baseSha,mergeQueueRequired:false as const,stacked:false as const,sourcePolicy:'expected_head_observed_base' as const}));
  const controller=new AbortController(),coordinator=createReleaseProviderMergeCoordinator(repo,new NextRequest('https://fixture.invalid/local',{signal:controller.signal}),{enabled:()=>true,readCredential:credential,readDirectMergeSupport:policy,fetch:fetcher as typeof fetch});
  const operation=await coordinator.prepare(record.id),saved=()=>other.durableAgentWorkflow.findUnique({where:{id:operation.id}}),savedApproval=()=>other.durableAgentWorkflow.findUnique({where:{id:approval.id}});
  return{org,identities,operation,coordinator,calls,credential,policy,saved,savedApproval,controller,afterTarget(action:()=>Promise<void>){afterTarget=action},onOrgLock(action:()=>void){firstOrgLock=action}};
 }
 it('confirms one PUT for positively unenrolled custom scope using original reviewer session and real consumed history',async()=>{
  const f=await fixture();expect(await f.coordinator.run(f.operation.id)).toMatchObject({state:'confirmed',attemptCount:1});expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(1);const approval=await f.savedApproval();expect(approval).toMatchObject({currentStep:'consumed',stateJson:{executionId:f.operation.id}});expect(await other.durableAgentWorkflowEvent.count({where:{workflowRunId:approval.id}})).toBe(2);expect(await f.coordinator.run(f.operation.id)).toMatchObject({state:'confirmed',attemptCount:1});expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(1);
 });
 it.each(['role','original-session'] as const)('refuses actual %s revocation after target observation before PUT',async kind=>{
  const f=await fixture();f.afterTarget(async()=>{if(kind==='role')await other.orgMembership.updateMany({where:{organizationId:f.org,userId:'approver'},data:{role:'read_only'}});else await other.desktopSessionRecord.update({where:{id:f.identities.approver.sessionId},data:{revokedAt:new Date()}})});
  expect(await f.coordinator.run(f.operation.id)).toMatchObject({state:'unknown',attemptCount:1});expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(0);expect(await f.savedApproval()).toMatchObject({currentStep:'consumed',stateJson:{executionId:f.operation.id}});
 });
 it('waits for org-first claim lock then refuses a new uncertain enrollment pointer without consuming approval or attempt',async()=>{
  const f=await fixture();let release!:()=>void,locked!:()=>void,attempting!:()=>void;const hold=new Promise<void>(r=>release=r),ready=new Promise<void>(r=>locked=r),atClaim=new Promise<void>(r=>attempting=r);
  const holder=other.$transaction(async(tx:any)=>{await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(f.org)}))`;locked();await hold;await tx.durableAgentWorkflow.create({data:{id:'governance_active_'+randomUUID(),organizationId:f.org,workflowKind:'uncertain_fixture_pointer',objective:'Malformed metadata refusal fixture',status:'running',autonomyLevel:'observe',currentStep:'unavailable',inputJson:{},stateJson:{},requestedByUserId:'creator',attemptCount:0,maxAttempts:1,version:0}})});
  await ready;f.onOrgLock(attempting);let settled=false;const pending=f.coordinator.run(f.operation.id).finally(()=>{settled=true});await atClaim;await new Promise(r=>setTimeout(r,25));expect(settled).toBe(false);release();await holder;await expect(pending).rejects.toThrow();expect(await f.saved()).toMatchObject({currentStep:'prepared',attemptCount:0,version:0});expect(await f.savedApproval()).toMatchObject({currentStep:'approved',version:0});expect(f.credential).not.toHaveBeenCalled();expect(f.calls).toHaveLength(0);
 });
 it('withholds PUT after request cancellation during final target observation',async()=>{const f=await fixture();f.afterTarget(async()=>f.controller.abort());await expect(f.coordinator.run(f.operation.id)).rejects.toThrow();expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(0);expect(await f.savedApproval()).toMatchObject({currentStep:'consumed'});});
});
