import {describe,beforeAll,afterAll,it,expect} from 'vitest';
import {createRequire} from 'node:module';import {randomUUID} from 'node:crypto';import {realpathSync,statSync} from 'node:fs';
import {createReleaseDeploymentApprovalStore} from '../releaseDeploymentApprovalStore';import {createReleaseDeploymentExecutionStore} from '../releaseDeploymentExecutionStore';import {sha256ContentHash} from '../contentHash';
const socket=process.env.AXIOM_PROVIDER_APPROVAL_PG_SOCKET;
describe.skipIf(!socket)('deployment-purpose approval on owned local PostgreSQL',()=>{
 let client:any;
 beforeAll(async()=>{const generated=process.env.AXIOM_PROVIDER_APPROVAL_PG_CLIENT;if(!socket||!/^\/private\/tmp\/axiom-provider-approval-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||!generated||!/^\/private\/tmp\/axiom-provider-approval-pg-evidence-[^/]+\/generated\/index\.js$/.test(generated))throw Error('owned_fixture_required');const Client=createRequire(import.meta.url)(generated).PrismaClient;client=new Client({datasources:{db:{url:`postgresql://recovery_fixture@localhost/neondb?host=${encodeURIComponent(socket)}`}}});const [r]=await client.$queryRawUnsafe("SELECT current_database()='neondb' AND current_user='recovery_fixture' AND current_setting('listen_addresses')='' AS private");if(!r?.private)throw Error('private_fixture_required')});afterAll(async()=>{await client?.$disconnect()});
 function fixture(){const organizationId='org-'+randomUUID(),now=Date.now(),scope={organizationId,actorUserId:'executor',sessionId:'exec-session'},reviewer={organizationId,actorUserId:'reviewer',sessionId:'review-session'};const plan:any={purpose:'release_deployment',organizationId,releaseId:'release',releaseVersion:1,intakeDigest:'a'.repeat(64),planId:'release_plan_'+'b'.repeat(64),creatorUserId:'creator',requesterUserId:'requester',executorUserId:'executor',repositoryFullName:'owner/fixture',connectionId:'connection',connectionRevision:new Date(now-60000).toISOString(),installationId:'123',workflowPath:'.github/workflows/deploy.yml',workflowBlobSha:'b'.repeat(40),sourceCommitSha:'a'.repeat(40),refKind:'tag',ref:'axiom-release-fixture',inputs:{},sourcePolicy:'github_protected_tag_v1',windowStart:new Date(now-10000).toISOString(),expiresAt:new Date(now+600000).toISOString()};let rejectAfterConsume=false;const approval=createReleaseDeploymentApprovalStore(client,{assertCurrent:async()=>{},readCurrentPlan:async()=>plan});const execution=createReleaseDeploymentExecutionStore(client,{assertCurrent:async(tx:any)=>{if(rejectAfterConsume){const row=await tx.durableAgentWorkflow.findFirst({where:{organizationId,workflowKind:'release_deployment_approval_v1'}});if(row?.currentStep==='consumed')throw Error('authority_revoked')}},readCurrentPlan:async()=>plan,verifySupportedSourcePolicy:async()=>({kind:'verified_release_deployment_source_policy_v1',planDigest:sha256ContentHash(plan),sourcePolicy:plan.sourcePolicy}),readIndependentApproval:approval.readIndependentApproval,consumeIndependentApproval:approval.consumeIndependentApproval});return{scope,reviewer,plan,approval,execution,revokeDuringClaim:()=>{rejectAfterConsume=true}}}
 it('persists approval across a fresh store and permits one concurrent execution claim',async()=>{const f=fixture(),a=await f.approval.issue(f.reviewer,f.plan,randomUUID()),p=await f.execution.prepare(f.scope,f.plan);const claims=await Promise.all([f.execution.claim(f.scope,p.id),f.execution.claim(f.scope,p.id)]);expect(claims.filter(v=>v.claimed)).toHaveLength(1);expect(await client.durableAgentWorkflow.findUnique({where:{id:a.id}})).toMatchObject({currentStep:'consumed',version:1});expect(await client.durableAgentWorkflow.findUnique({where:{id:p.id}})).toMatchObject({attemptCount:1,currentStep:'dispatching'});expect((await f.execution.claim(f.scope,p.id)).claimed).toBe(false)});
 it('rolls approval consumption and attempt back together on lost authority',async()=>{const f=fixture(),a=await f.approval.issue(f.reviewer,f.plan,randomUUID()),p=await f.execution.prepare(f.scope,f.plan);f.revokeDuringClaim();await expect(f.execution.claim(f.scope,p.id)).rejects.toThrow();expect(await client.durableAgentWorkflow.findUnique({where:{id:a.id}})).toMatchObject({currentStep:'approved',version:0});expect(await client.durableAgentWorkflow.findUnique({where:{id:p.id}})).toMatchObject({attemptCount:0,currentStep:'prepared'});expect(await client.durableAgentWorkflowEvent.count({where:{workflowRunId:a.id}})).toBe(1)});
 it('revokes without deleting immutable approval evidence',async()=>{const f=fixture(),a=await f.approval.issue(f.reviewer,f.plan,randomUUID());await f.approval.revoke(f.reviewer,a.id,0);expect(await client.durableAgentWorkflow.findUnique({where:{id:a.id}})).toMatchObject({currentStep:'revoked',version:1});expect(await client.durableAgentWorkflowEvent.count({where:{workflowRunId:a.id}})).toBe(2);await expect(f.approval.readIndependentApproval(client,f.scope,f.plan)).rejects.toThrow()});
 it('reads immutable accepted provenance after original execution expiry without another approval consumption',async()=>{
  const f=fixture();await f.approval.issue(f.reviewer,f.plan,randomUUID());const prepared=await f.execution.prepare(f.scope,f.plan);await f.execution.claim(f.scope,prepared.id);await f.execution.finish(f.scope,prepared.id,{state:'accepted',receipt:{repositoryFullName:f.plan.repositoryFullName,workflowPath:f.plan.workflowPath,headSha:f.plan.sourceCommitSha,ref:f.plan.ref,runId:'123',runAttempt:1}});
  const historical=createReleaseDeploymentExecutionStore(client,{now:()=>new Date(Date.parse(f.plan.expiresAt)+1000),assertCurrent:async()=>{},readCurrentPlan:async()=>f.plan,verifySupportedSourcePolicy:async()=>({kind:'verified_release_deployment_source_policy_v1',planDigest:sha256ContentHash(f.plan),sourcePolicy:f.plan.sourcePolicy}),readIndependentApproval:async()=>{throw Error('must not renew approval')},consumeIndependentApproval:async()=>{throw Error('must not consume approval')}});
  expect((await historical.readAcceptedEvidenceSource(f.scope,prepared.id)).receipt.runId).toBe('123');expect((await historical.claim(f.scope,prepared.id)).claimed).toBe(false);expect(await client.durableAgentWorkflow.findUnique({where:{id:prepared.id}})).toMatchObject({currentStep:'accepted',attemptCount:1});
 });

 it('permits read-only session validation under a share lock while a separate heartbeat writer blocks',async()=>{
  await client.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "EvidenceSessionLockFixture" ("id" TEXT PRIMARY KEY, "lastSeenAt" TIMESTAMP NOT NULL)');
  const id=randomUUID();await client.$executeRaw`INSERT INTO "EvidenceSessionLockFixture" ("id","lastSeenAt") VALUES (${id},clock_timestamp())`;
  let release!:()=>void,locked!:()=>void;const held=new Promise<void>(resolve=>{release=resolve}),ready=new Promise<void>(resolve=>{locked=resolve});
  const reader=client.$transaction(async(tx:any)=>{await tx.$queryRaw`SELECT * FROM "EvidenceSessionLockFixture" WHERE "id"=${id} FOR SHARE`;locked();await held});
  await ready;
  try{
   await expect(client.$transaction(async(tx:any)=>{await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '150ms'");await tx.$executeRaw`UPDATE "EvidenceSessionLockFixture" SET "lastSeenAt"=clock_timestamp() WHERE "id"=${id}`})).rejects.toThrow();
   expect(await client.$queryRaw`SELECT "id" FROM "EvidenceSessionLockFixture" WHERE "id"=${id}`).toEqual([{id}]);
  }finally{release();await reader}
 });

 it('persists an exact baseline binding and rolls back the attempt when locked current baseline changes',async()=>{
  const f=fixture(),digest='c'.repeat(64),policyId='test-only-baseline-'+randomUUID();
  // Fixture-only current-head authority in the same durable tables. This is not
  // a production baseline verifier, coverage receipt or enrolled scope.
  await client.durableAgentWorkflow.create({data:{id:policyId,organizationId:f.scope.organizationId,workflowKind:'test_only_current_baseline',objective:'Fixture baseline head',requestedByUserId:'reviewer',status:'completed',autonomyLevel:'observe',inputJson:{digest},stateJson:{},maxAttempts:1}});
  let rejectConsumed=false;
  const assertGovernanceBaseline=async(tx:any,scope:any,expected:string)=>{
   const rows=await tx.$queryRaw`SELECT "inputJson" FROM "DurableAgentWorkflow" WHERE "id"=${policyId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
   if(rows.length!==1||rows[0].inputJson.digest!==expected)throw Error('baseline_changed');
   if(rejectConsumed&&await tx.durableAgentWorkflow.findFirst({where:{organizationId:scope.organizationId,workflowKind:'release_deployment_approval_v1',currentStep:'consumed'}}))throw Error('baseline_changed_after_consumption');
  };
  const dependencies={assertCurrent:async()=>{},readCurrentPlan:async()=>f.plan,assertGovernanceBaseline};
  const approval=createReleaseDeploymentApprovalStore(client,dependencies),a=await approval.issue(f.reviewer,f.plan,randomUUID(),digest);
  const fresh=createReleaseDeploymentApprovalStore(client,dependencies);
  expect((await fresh.readIndependentApproval(client,f.scope,f.plan)).governanceBaselineDigest).toBe(digest);
  const execution=createReleaseDeploymentExecutionStore(client,{assertCurrent:async()=>{},readCurrentPlan:async()=>f.plan,verifySupportedSourcePolicy:async()=>({kind:'verified_release_deployment_source_policy_v1',planDigest:sha256ContentHash(f.plan),sourcePolicy:f.plan.sourcePolicy}),readIndependentApproval:fresh.readIndependentApproval,consumeIndependentApproval:fresh.consumeIndependentApproval});
  const prepared=await execution.prepare(f.scope,f.plan);rejectConsumed=true;
  await expect(execution.claim(f.scope,prepared.id)).rejects.toThrow('baseline_changed_after_consumption');
  expect(await client.durableAgentWorkflow.findUnique({where:{id:a.id}})).toMatchObject({version:0,currentStep:'approved'});
  expect(await client.durableAgentWorkflow.findUnique({where:{id:prepared.id}})).toMatchObject({attemptCount:0,currentStep:'prepared'});
  expect(await client.durableAgentWorkflowEvent.count({where:{workflowRunId:a.id}})).toBe(1);
  rejectConsumed=false;await client.durableAgentWorkflow.update({where:{id:policyId},data:{inputJson:{digest:'d'.repeat(64)}}});
  await expect(execution.claim(f.scope,prepared.id)).rejects.toThrow('baseline_changed');
  await client.durableAgentWorkflow.update({where:{id:policyId},data:{inputJson:{digest}}});
  const claims=await Promise.all([execution.claim(f.scope,prepared.id),execution.claim(f.scope,prepared.id)]);
  expect(claims.filter(c=>c.claimed)).toHaveLength(1);
  const events=await client.durableAgentWorkflowEvent.findMany({where:{workflowRunId:a.id},orderBy:{sequence:'asc'}});
  expect(events).toHaveLength(2);expect(events[0].detailJson.bindingDigest).toBe(events[1].detailJson.bindingDigest);
 });

 it('refuses a live approval when its final baseline callback waits past actual database expiry',async()=>{
  const f=fixture(),digest='c'.repeat(64);f.plan.expiresAt=new Date(Date.now()+1200).toISOString();
  let checks=0,wait=false;
  const store=createReleaseDeploymentApprovalStore(client,{assertCurrent:async()=>{},readCurrentPlan:async()=>f.plan,assertGovernanceBaseline:async(tx:any)=>{
   if(wait&&++checks===2)await tx.$queryRaw`SELECT 1 AS done FROM pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM (${new Date(f.plan.expiresAt)}::timestamptz-clock_timestamp())))+0.02)`;
  }});
  const a=await store.issue(f.reviewer,f.plan,randomUUID(),digest);
  expect(Date.now()).toBeLessThan(Date.parse(a.expiresAt));wait=true;
  await expect(client.$transaction((tx:any)=>store.readIndependentApproval(tx,f.scope,f.plan))).rejects.toThrow();
  expect(await client.durableAgentWorkflow.findUnique({where:{id:a.id}})).toMatchObject({currentStep:'approved',version:0});
  expect(await client.durableAgentWorkflowEvent.count({where:{workflowRunId:a.id}})).toBe(1);
 });

});
