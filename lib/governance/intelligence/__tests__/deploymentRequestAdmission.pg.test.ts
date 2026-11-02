import {createHash} from 'node:crypto';
import {createReleaseDeploymentExecutionStore} from '@/lib/tauri/releaseDeploymentExecutionStore';
import {createReleaseDeploymentGithubReaders} from '@/lib/tauri/releaseDeploymentGithubReaders';
import {createImmutableReleasePolicyReader} from '@/lib/tauri/releaseImmutableReleasePolicy';
import {createGovernanceDeploymentBindingReader} from '../deploymentBindingReader';
import {createDeploymentProviderPreflight,createGovernanceDeploymentRequestAdmission} from '../deploymentRequestAdmission';
import {createGovernedReleaseDeploymentExecutor} from '../governedReleaseDeployment';
import {createReleaseDeploymentApprovalStore} from '@/lib/tauri/releaseDeploymentApprovalStore';
import {createReleaseDeploymentAuthority} from '@/lib/desktop/releaseDeploymentAuthority';
import {releaseOperationPlanId} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {completeReleaseIntake} from '@/lib/tauri/__tests__/fixtures/completeReleaseIntake';
import {buildReleaseMergePlan} from '@/lib/tauri/releaseMergePlan';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {createRequire} from 'node:module';import {randomUUID} from 'node:crypto';import {realpathSync,statSync} from 'node:fs';
vi.mock('../requestAuthority',()=>({createGovernanceRequestAuthority:(request:any)=>async(tx:any,s:any,role:string)=>{if(request.principal.organizationId!==s.organizationId||request.principal.actorUserId!==s.actorUserId||request.principal.sessionId!==s.sessionId)throw Error('fixture_session_required');const rows=await tx.$queryRaw`SELECT "role","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${s.organizationId} AND "userId"=${s.actorUserId} FOR SHARE`;const m=rows[0];if(!m?.acceptedAt||['collector','policy_admin'].includes(role)&&!['owner','admin'].includes(m.role)||role==='approver'&&!['owner','admin','security_reviewer'].includes(m.role)||role==='github_reader'&&!['owner','admin','security_reviewer','operator','read_only'].includes(m.role))throw Error('fixture_capability_required')}}));
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:async(request:any)=>({credentialKind:'desktop_session',id:request.principal.sessionId,userId:request.principal.actorUserId,organizationId:request.principal.organizationId,capabilities:['github:read','deploy:execute','agent:approve']})}));
vi.mock('@/lib/connectors/github/githubAppAuth',()=>({resolveReleaseInstallationToken:vi.fn(async()=>({token:'synthetic',expiresAt:Date.now()+60000,permissions:{administration:'read',contents:'read',metadata:'read'}}))}));
import {createGovernanceRequestService} from '../requestService';
import {createGovernanceRevisionStore} from '../revisionStore';
const socket=process.env.AXIOM_TICKET_GOVERNANCE_PG_SOCKET;
/** Actual artifact/revision/audit stores and locked source rows. Request-session
 * verification and provider responses are explicit simulations, never live. */
describe.skipIf(!socket)('actual deployment admission stores with simulated GitHub',()=>{let db:any,locker:any;
 beforeAll(async()=>{const generated=process.env.AXIOM_TICKET_GOVERNANCE_PG_CLIENT;if(!socket||!/^\/private\/tmp\/axiom-ticket-governance-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||!generated||!/^\/private\/tmp\/axiom-provider-approval-pg-evidence-[^/]+\/generated\/index\.js$/.test(generated))throw Error('owned_fixture_required');const Client=createRequire(import.meta.url)(generated).PrismaClient;db=new Client({datasources:{db:{url:`postgresql://recovery_fixture@localhost/neondb?host=${encodeURIComponent(socket)}&connection_limit=1`}}});locker=new Client({datasources:{db:{url:`postgresql://recovery_fixture@localhost/neondb?host=${encodeURIComponent(socket)}&connection_limit=1`}}});const[r]=await db.$queryRawUnsafe("SELECT current_database()='neondb' AND current_user='recovery_fixture' AND current_setting('listen_addresses')='' AS private");if(!r?.private)throw Error('owned_fixture_required');await db.$executeRawUnsafe('CREATE TEMP TABLE \"TauriDeploymentRequest\" (\"id\" TEXT PRIMARY KEY, \"organizationId\" TEXT NOT NULL, \"requesterUserId\" TEXT NOT NULL DEFAULT \'owner\', \"version\" INTEGER NOT NULL, \"status\" TEXT NOT NULL, \"intakeJson\" JSONB NOT NULL)');await db.$executeRawUnsafe('CREATE TEMP TABLE \"GitHubInstallation\" (\"id\" TEXT PRIMARY KEY, \"organizationId\" TEXT NOT NULL, \"githubInstallationId\" TEXT NOT NULL, \"accountLogin\" TEXT NOT NULL DEFAULT \'synthetic-company\', \"status\" TEXT NOT NULL, \"updatedAt\" TIMESTAMPTZ NOT NULL, \"revokedAt\" TIMESTAMPTZ, \"suspendedAt\" TIMESTAMPTZ)');await db.$executeRawUnsafe('CREATE TEMP TABLE \"CloudAccount\" (\"id\" TEXT PRIMARY KEY, \"organizationId\" TEXT NOT NULL, \"provider\" TEXT NOT NULL, \"externalAccountId\" TEXT NOT NULL, \"regions\" TEXT[] NOT NULL, \"updatedAt\" TIMESTAMPTZ NOT NULL, \"credentialRef\" TEXT, \"enabled\" BOOLEAN NOT NULL)');await db.$executeRawUnsafe('CREATE TEMP TABLE \"CloudAccountCredential\" (\"id\" TEXT PRIMARY KEY, \"organizationId\" TEXT NOT NULL, \"requesterUserId\" TEXT NOT NULL DEFAULT \'owner\', \"version\" INTEGER NOT NULL, \"revokedAt\" TIMESTAMPTZ)')});afterAll(async()=>{vi.restoreAllMocks();await locker?.$disconnect();await db?.$disconnect()});

 async function fixture(legacy=false){
  const yaml='name: Synthetic dispatch\non:\n  workflow_dispatch:\n    inputs:\n      branch:\n        type: string\n      environment:\n        type: string\n      client:\n        type: string\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo synthetic\n';
  const org='deploy-baseline-'+randomUUID(),connection='connection-'+randomUUID(),at=new Date(),owner={organizationId:org,actorUserId:'owner',sessionId:'owner-session'},reviewer={...owner,actorUserId:'reviewer',sessionId:'reviewer-session'};
  for(const[userId,role]of [['owner','owner'],['creator','owner'],['reviewer','security_reviewer']])await db.orgMembership.create({data:{organizationId:org,userId,role,acceptedAt:at}});
  for(const s of [owner,reviewer])await db.desktopSessionRecord.create({data:{id:s.sessionId+'-'+org,organizationId:org,userId:s.actorUserId,expiresAt:new Date(Date.now()+600000)}});
  owner.sessionId+='-'+org;reviewer.sessionId+='-'+org;
  await db.$executeRaw`INSERT INTO "GitHubInstallation"("id","organizationId","githubInstallationId","status","updatedAt") VALUES (${connection},${org},'123','active',${at})`;
  const selected={repositoryId:'team/repo',resourceId:'github:repository:team/repo',environment:'production'},network=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('no provider IO'));
  const service=(s:any)=>createGovernanceRequestService({principal:s,signal:new AbortController().signal}as any,db,s,()=>true),requester=service(owner),independent=service(reviewer);
  const bytes=new TextEncoder().encode('Deployments require verified evidence.'),doc={name:'deploy.md',selection:selected,utf8Bytes:bytes,expectedVersion:null,requestId:randomUUID()},artifact=await requester.uploadDocument(doc);
  const proposal=await requester.propose({organizationId:org,parentDigest:null,scopes:[selected],evidenceDigests:[artifact.snapshot.digest],rules:[{id:'deploy-rule',actions:['deployment.dispatch'],scope:selected,decision:'require_approval',requirements:['verified_evidence'],evidenceDigests:[artifact.snapshot.digest]}]},randomUUID());
  await independent.approve(proposal.id,0,proposal.baseline.digest,randomUUID());
  // Only this owned fixture supplies activation/coverage authority; production refuses.
  const fixtureActivation=createGovernanceRevisionStore(db,{assertCurrent:async()=>{},verifyEvidence:async()=>true,verifyCoverage:async()=>true});if(!legacy)await fixtureActivation.activate(owner,proposal.id,null,randomUUID());
  const intake={...completeReleaseIntake(),tenantId:org,targetEnvironment:'production',repositoryUrls:['https://github.com/team/repo'],productionPrUrls:['https://github.com/team/repo/pull/42'],sourceBranch:'release/demo',targetBranch:'main',windowStartUtc:new Date(Date.now()-60000).toISOString(),windowEndUtc:new Date(Date.now()+600000).toISOString(),workflowSource:{repositoryFullName:'team/repo',ref:'axiom-release-fixture',path:'.github/workflows/deploy.yml',blobSha:createHash('sha1').update('blob '+Buffer.byteLength(yaml)+'\0'+yaml).digest('hex')}};
  const release={id:'release-'+randomUUID(),organizationId:org,version:3,status:'submitted',intakeJson:{...intake,id:''}};intake.id=release.id;release.intakeJson=intake;
  const built=buildReleaseMergePlan(release,{organizationId:org,requestId:release.id,expectedVersion:3,expectedDigest:sha256ContentHash({requestVersion:3,intake}),method:'squash',observation:{connectionId:connection,connectionRevision:at.toISOString(),repositoryFullName:'team/repo',number:42,headRepositoryFullName:'team/repo',headRef:'release/demo',headSha:'a'.repeat(40),baseRef:'main',baseSha:'b'.repeat(40),state:'open',draft:false,merged:false}});if(!built.ok)throw Error('fixture');
  const planId=releaseOperationPlanId(org,release.id,3,built.digest),createdAt=new Date();
  await db.$executeRaw`INSERT INTO "TauriDeploymentRequest"("id","organizationId","requesterUserId","version","status","intakeJson") VALUES (${release.id},${org},'owner',3,'submitted',${JSON.stringify(intake)}::jsonb)`;
  await db.durableAgentWorkflow.create({data:{id:planId,organizationId:org,workflowKind:'release_operation_plan_v1',objective:'Fixture reviewed parent',version:1,currentStep:'reviewed',status:'completed',autonomyLevel:'observe',requestedByUserId:'creator',attemptCount:0,maxAttempts:1,createdAt,inputJson:{format:1,plan:built.plan,planDigest:built.digest,releaseRequesterUserId:'owner',createdAt:createdAt.toISOString(),deadlineAt:intake.windowEndUtc},stateJson:{reviewStatus:'reviewed'}}});
  for(const[sequence,actorId,eventType,detailJson]of [[0,'creator','release_plan.created',{planDigest:built.digest}],[1,'reviewer','release_plan.reviewed',{actionId:randomUUID(),expectedVersion:0,requestedDecision:'reviewed'}]]as const)await db.durableAgentWorkflowEvent.create({data:{workflowRunId:planId,organizationId:org,sequence,actorKind:'user',actorId,eventType,detailJson,occurredAt:createdAt}});
  const plan:any={purpose:'release_deployment',organizationId:org,releaseId:release.id,releaseVersion:3,intakeDigest:built.plan.intakeDigest,planId,creatorUserId:'creator',requesterUserId:'owner',executorUserId:'owner',repositoryFullName:'team/repo',connectionId:connection,connectionRevision:at.toISOString(),installationId:'123',workflowPath:intake.workflowSource.path,workflowBlobSha:intake.workflowSource.blobSha,sourceCommitSha:'d'.repeat(40),refKind:'tag',ref:intake.workflowSource.ref,inputs:intake.workflowInputs,sourcePolicy:'github_immutable_release_v1',windowStart:intake.windowStartUtc,expiresAt:intake.windowEndUtc};

  if(!legacy){await requester.readActiveEvidence(selected);await independent.readActiveEvidence(selected)}
  const reviewRequest={principal:reviewer,signal:new AbortController().signal}as any,request={principal:owner,signal:new AbortController().signal}as any;
  const reviewAuthority=createReleaseDeploymentAuthority(reviewRequest,{isEnabled:()=>true,sourcePolicy:'github_immutable_release_v1',actorPurpose:'approver'}),authority=createReleaseDeploymentAuthority(request,{isEnabled:()=>true,sourcePolicy:'github_immutable_release_v1'});
  const approvalStore=(a:any,service:any)=>createReleaseDeploymentApprovalStore(db,{...a,assertGovernanceBaseline:(tx,s,digest,p)=>service.assertDeploymentApprovalBaseline(tx,s,digest,p)});
  const approved=await approvalStore(reviewAuthority,independent).issue(reviewer,plan,randomUUID(),legacy?undefined:proposal.baseline.digest),approvals=approvalStore(authority,requester);
  const numeric=await requester.executionPolicies.propose({organizationId:org,scope:selected,parentDigest:null,autonomyLevel:4,actions:['deployment.dispatch'],executorUserIds:['owner'],expiresAt:new Date(Date.now()+600000).toISOString()},randomUUID());
  await independent.executionPolicies.approve(numeric.id,0,numeric.policy.digest,randomUUID());await requester.executionPolicies.activate(numeric.id,null,null,randomUUID());
  let proofExpires=0,proof:any;
  const store=createReleaseDeploymentExecutionStore(db,{...authority,readIndependentApproval:approvals.readIndependentApproval,consumeIndependentApproval:approvals.consumeIndependentApproval,verifySupportedSourcePolicy:async()=>{if(!proof||proofExpires<=Date.now())throw Error('fixture_policy_preflight_required');return proof}});
  const current=async(p:any,s:AbortSignal)=>{s.throwIfAborted();await db.$transaction(async(tx:any)=>{if(sha256ContentHash(await authority.readCurrentPlan(tx,owner,p))!==sha256ContentHash(plan))throw Error('plan_changed')});s.throwIfAborted()};
  const calls:Array<{method:string;attempt:number}>=[];let unknownPost=false;let operationId='',afterPolicy:(()=>Promise<void>)|undefined;
  const fetcher=vi.fn(async(url:any,init:any)=>{
   // A separate transaction must run immediately: no provider request may occur
   // from inside the approval, operation or numeric-policy transaction.
   await db.$transaction(async(tx:any)=>{await tx.$queryRaw`SELECT "id" FROM "DurableAgentWorkflow" WHERE "id"=${planId} FOR UPDATE NOWAIT`});
   const operation=operationId?await db.durableAgentWorkflow.findUnique({where:{id:operationId}}):null;calls.push({method:init.method,attempt:operation?.attemptCount??0});
   if(init.method==='POST'&&unknownPost)throw Error('lost_dispatch_acknowledgement');
   if(init.method==='POST')return Response.json({workflow_run_id:123,run_url:'https://api.github.com/repos/team/repo/actions/runs/123',html_url:'https://github.com/team/repo/actions/runs/123'});
   if(String(url).includes('/contents/'))return Response.json({type:'file',path:plan.workflowPath,sha:plan.workflowBlobSha,encoding:'base64',content:Buffer.from(yaml).toString('base64')});
   if(String(url).includes('/git/ref/tags/'))return Response.json({ref:'refs/tags/'+plan.ref,object:{type:'commit',sha:plan.sourceCommitSha}});
   if(String(url).includes('/releases/tags/')){if(afterPolicy&&operation?.attemptCount===1){const action=afterPolicy;afterPolicy=undefined;await action()}return Response.json({id:99,tag_name:plan.ref,draft:false,immutable:true,published_at:at.toISOString()})}
   if(String(url).includes('/actions/runs/'))return Response.json({id:123,run_attempt:1,workflow_id:7,event:'workflow_dispatch',path:plan.workflowPath,head_sha:plan.sourceCommitSha,head_branch:plan.ref,repository:{full_name:'team/repo'},head_repository:{full_name:'team/repo'}});
   if(String(url).includes('/actions/workflows/'))return Response.json({id:7,path:plan.workflowPath});
   return Response.json({full_name:'team/repo',archived:false,disabled:false});
  })as unknown as typeof fetch;
  const credential={organizationId:org,connectionId:connection,connectionRevision:at.toISOString(),repositoryFullName:'team/repo',installationId:'123',token:'FIXTURE_TOKEN',expiresAt:Date.now()+600000};
  const readers=createReleaseDeploymentGithubReaders({isEnabled:()=>true,assertCurrent:current,readCredential:async()=>({...credential,permissions:{contents:'read',actions:'read',metadata:'read'}}),fetch:fetcher});
  const policyReader=createImmutableReleasePolicyReader({isEnabled:()=>true,assertCurrent:current,readCredential:async()=>({...credential,permissions:{contents:'read',administration:'read',metadata:'read'}}),fetch:fetcher});
  const verifyPolicy=async(p:any,s:AbortSignal)=>{const actual=await policyReader(p,s);if(!actual)throw Error('source_policy_unavailable');proof=actual.proof;proofExpires=Date.parse(actual.evidence.expiresAt);return actual.proof};
  const transport={isEnabled:()=>true,allowImmutableTagDispatch:()=>true,readCredential:async()=>({...credential,actionsRead:true,actionsWrite:true}),readWorkflowContract:readers.readWorkflowContract,verifySourcePolicy:verifyPolicy,verifyRunReceipt:readers.verifyRunReceipt,fetch:fetcher};
  await verifyPolicy(plan,new AbortController().signal);const operation=await store.prepare(owner,plan);operationId=operation.id;
  const readBinding=createGovernanceDeploymentBindingReader(db,store,{assertCurrent:async(s,signal)=>{signal.throwIfAborted();await db.$transaction((tx:any)=>authority.assertCurrent(tx,s,plan))},readCurrentPlan:authority.readCurrentPlan});
  const binding=await readBinding(owner,operationId,new AbortController().signal),provider=createDeploymentProviderPreflight({assertCurrent:current,transport});let coveredActions=['deployment.dispatch'];
  let finalMutation:(()=>Promise<void>)|undefined,mutationPhase='',outsideLimits=0,enrollmentReads=0;
  const originalLimits=requester.executionPolicies.readAuthority;
  const coveredService={...requester,executionPolicies:{...requester.executionPolicies,readAuthority:async(...args:Parameters<typeof originalLimits>)=>{const result=await originalLimits(...args);if(!args[3]&&++outsideLimits===6&&mutationPhase==='policy'&&finalMutation){const mutate=finalMutation;finalMutation=undefined;await mutate()}return result}},readScopeEnrollment:async(selection:any)=>{const result=await requester.readScopeEnrollment(selection);if(++enrollmentReads===(legacy?3:6)&&mutationPhase==='enrollment'&&finalMutation){const mutate=finalMutation;finalMutation=undefined;await mutate()}return result},readExecutionCoverage:async()=>({enrolled:true,coveredActions})};
  const guard=createGovernanceDeploymentRequestAdmission(owner,operationId,binding,db,store,approvals,coveredService,{readBinding,provider});
  const run=()=>createGovernedReleaseDeploymentExecutor(store,{guard,readBinding,transport}).run(owner,operationId);
  return{run,calls,store,owner,operation,approved,guard,context:binding.context,requester,proposal,activateBaseline:()=>fixtureActivation.activate(owner,proposal.id,null,randomUUID()),setEnrollmentMutation(mutate:()=>Promise<void>){mutationPhase='enrollment';finalMutation=mutate},mutateFinal(kind:string,phase:string){mutationPhase=phase;finalMutation=async()=>{if(kind==='reviewer')await db.orgMembership.updateMany({where:{organizationId:org,userId:'reviewer'},data:{role:'read_only'}});else await db.$executeRaw`UPDATE "GitHubInstallation" SET "status"='revoked' WHERE "id"=${connection}`}},loseAcknowledgement(){unknownPost=true},withoutCoverage(){coveredActions=[]},revokeAfterClaim(){afterPolicy=()=>requester.revoke(proposal.id,1,randomUUID()).then(()=>{})},network};
 }
 it('uses actual baseline/numeric/approval/claim stores and fixed provider readers before one dispatch',async()=>{
  const f=await fixture();expect(await f.run()).toMatchObject({state:'accepted',attemptCount:1,deploymentSucceeded:false});
  expect(f.calls.some(c=>c.method==='GET'&&c.attempt===0)).toBe(true);expect(f.calls.filter(c=>c.method==='POST')).toEqual([{method:'POST',attempt:1}]);
  expect(await db.durableAgentWorkflow.findUnique({where:{id:f.approved.id}})).toMatchObject({currentStep:'consumed',version:1});expect((await f.store.claim(f.owner,f.operation.id)).claimed).toBe(false);expect(f.network).not.toHaveBeenCalled();
 });
 it('refuses missing authoritative coverage before claim or new provider proof',async()=>{
  const f=await fixture(),before=f.calls.length;f.withoutCoverage();await expect(f.run()).rejects.toThrow('governance_admission_unavailable');
  expect(f.calls).toHaveLength(before);expect(await db.durableAgentWorkflow.findUnique({where:{id:f.operation.id}})).toMatchObject({attemptCount:0,currentStep:'prepared'});
 });
 it('withholds dispatch after postclaim baseline revocation without restoring the consumed attempt',async()=>{
  const f=await fixture();f.revokeAfterClaim();expect(await f.run()).toMatchObject({state:'refused',attemptCount:1});expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(0);
  expect(await db.durableAgentWorkflow.findUnique({where:{id:f.approved.id}})).toMatchObject({currentStep:'consumed',version:1});
 });
 it('retains an uncertain dispatched outcome and the original consumed attempt without resend',async()=>{
  const f=await fixture();f.loseAcknowledgement();expect(await f.run()).toMatchObject({state:'unknown',attemptCount:1});
  expect(f.calls.filter(c=>c.method==='POST')).toEqual([{method:'POST',attempt:1}]);
  expect((await f.store.claim(f.owner,f.operation.id)).claimed).toBe(false);expect(await f.store.recover(f.owner,f.operation.id,2)).toMatchObject({state:'unknown',attemptCount:1});
  expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(1);expect(await db.durableAgentWorkflow.findUnique({where:{id:f.approved.id}})).toMatchObject({currentStep:'consumed',version:1});
 });

 it.each([['reviewer','policy'],['installation','policy'],['reviewer','enrollment'],['installation','enrollment']])('rechecks %s revoked during the final %s await in the coherent dispatch transaction',async(kind,phase)=>{
  const f=await fixture();f.mutateFinal(kind,phase);if(kind==='reviewer')await expect(f.run()).rejects.toThrow('authority_unavailable');else await f.run();expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(0);
  expect(await db.durableAgentWorkflow.findUnique({where:{id:f.operation.id}})).toMatchObject({attemptCount:1});expect(await db.durableAgentWorkflow.findUnique({where:{id:f.approved.id}})).toMatchObject({currentStep:'consumed'});
 });

 it('fuses positively absent scope authority and refuses an enrollment introduced during the last legacy await',async()=>{
  const f=await fixture(true);expect(await db.$transaction((tx:any)=>f.requester.readAnyEnrollmentLocked(tx))).toBe(false);
  // The scoped wrapper's internal port is captured through the fixture mutation
  // seam; activating at its final enrollment await must be caught under locks.
  f.setEnrollmentMutation(()=>f.activateBaseline().then(()=>{}));
  await f.run();expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(0);expect(await db.$transaction((tx:any)=>f.requester.readAnyEnrollmentLocked(tx))).toBe(true);expect(await db.durableAgentWorkflow.findUnique({where:{id:f.operation.id}})).toMatchObject({attemptCount:1});
 });
 it('takes the activation organization lock before dispatch rows, avoiding reversed-order lock waits',async()=>{
  const f=await fixture(),receipt=await f.guard.assert(f.context,'before_claim');await f.store.claim(f.owner,f.operation.id);
  let release!:()=>void,locked!:()=>void;const hold=new Promise<void>(resolve=>{release=resolve}),ready=new Promise<void>(resolve=>{locked=resolve});
  const holder=locker.$transaction(async(tx:any)=>{await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '250ms'");await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(f.owner.organizationId)}))`;locked();await hold;await tx.$queryRaw`SELECT "id" FROM "DurableAgentWorkflow" WHERE "id"=${'governance_active_'+sha256ContentHash({organizationId:f.owner.organizationId,scope:f.context.scope})} FOR UPDATE NOWAIT`;await tx.$queryRaw`SELECT "id" FROM "DurableAgentWorkflow" WHERE "id"=${f.operation.id} FOR UPDATE NOWAIT`});
  await ready;const dispatch=f.store.beforeDispatchWithAdmission(f.owner,f.operation.id,(tx,p)=>f.guard.assertFinal(tx,p,receipt));
  await new Promise(resolve=>setTimeout(resolve,30));release();await holder;expect(await dispatch).toMatchObject({planId:expect.any(String)});
 });

 it('withholds POST when actual provider proof expires during a later database boundary wait',async()=>{
  const f=await fixture(),original=f.store.beforeDispatchWithAdmission.bind(f.store);let delayed=false,boundaries=0,finalError:unknown;
  f.store.beforeDispatchWithAdmission=async(s,id,verify)=>{
   if(++boundaries===2){delayed=true;await db.$queryRaw`SELECT true AS delayed FROM pg_sleep(5.1)`}
   try{return await original(s,id,verify)}catch(error){finalError=error;throw error}
  };
  expect(await f.run()).toMatchObject({state:'refused',attemptCount:1});
  expect(delayed).toBe(true);expect(finalError).toMatchObject({message:'governance_deployment_provider_proof_unavailable'});expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(0);
  expect((await f.store.claim(f.owner,f.operation.id)).claimed).toBe(false);
  expect(await db.durableAgentWorkflow.findUnique({where:{id:f.approved.id}})).toMatchObject({currentStep:'consumed'});
 },20000);

});
