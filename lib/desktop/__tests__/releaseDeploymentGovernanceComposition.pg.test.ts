import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {realpathSync,statSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {completeReleaseIntake} from '@/lib/tauri/__tests__/fixtures/completeReleaseIntake';
import {buildReleaseMergePlan} from '@/lib/tauri/releaseMergePlan';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {releaseOperationPlanId} from '@/lib/agent/workflows/releaseOperationPlanStore';
const FIXTURE=vi.hoisted(()=>({db:null as any,metadataFailure:false,metadataFailures:0}));
// Bound owned database; only the explicit metadata-error scenario injects a read failure.
vi.mock('@/lib/db',()=>({get prisma(){return new Proxy(FIXTURE.db,{get(db,key){if(key==='durableAgentWorkflow')return new Proxy(db.durableAgentWorkflow,{get(model,method){if(method==='findMany')return async(args:any)=>{if(FIXTURE.metadataFailure&&args?.where?.OR){FIXTURE.metadataFailures++;throw Error('SIMULATED database metadata read failure')};return model.findMany(args)};const value=model[method];return typeof value==='function'?value.bind(model):value}});const value=db[key];return typeof value==='function'?value.bind(db):value}})}}));
// Pairing and provider credentials are SIMULATED. Real locked roles/sessions remain.
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:async(request:any)=>({credentialKind:'desktop_session',id:request.principal.sessionId,userId:request.principal.actorUserId,organizationId:request.principal.organizationId,capabilities:['workspace:read','policy:manage','github:read','deploy:execute','agent:approve']})}));
vi.mock('@/lib/connectors/github/githubAppAuth',()=>({resolveReleaseInstallationToken:vi.fn(async(input:any)=>({token:'SIMULATED_TOKEN',expiresAt:Date.now()+60000,permissions:input.purpose==='source_policy_read'?{administration:'read',contents:'read',metadata:'read'}:{contents:'read',metadata:'read',actions:input.purpose==='dispatch'?'write':'read'}}))}));
// Explicit FIXTURE coverage port ONLY: production readExecutionCoverage remains [].
// Every other service method, including evidence, metadata and final locks, is actual.
vi.mock('@/lib/governance/intelligence/requestService',async(importActual)=>{const actual:any=await importActual();return{...actual,createGovernanceRequestService:(...args:any[])=>{const service=actual.createGovernanceRequestService(...args);return{...service,readExecutionCoverage:async()=>({enrolled:true,coveredActions:['deployment.dispatch']})}}}});
import {createGovernanceRequestService} from '@/lib/governance/intelligence/requestService';
import {createGovernanceRevisionStore} from '@/lib/governance/intelligence/revisionStore';
import {createReleaseDeploymentServices} from '@/lib/desktop/releaseDeploymentServices';
import {handleReleaseDeploymentApproval} from '@/lib/desktop/releaseDeploymentApprovalHttp';
import {handleReleaseDeploymentExecution} from '@/lib/desktop/releaseDeploymentExecutionHttp';
function request(s:any,body?:unknown){const r=new NextRequest('https://fixture.invalid/api/local/deployment',{method:body===undefined?'GET':'POST',...(body===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)})});Object.assign(r,{principal:s});return r;}
const socket=process.env.AXIOM_TICKET_GOVERNANCE_PG_SOCKET;
/** Actual artifact/revision/audit stores and locked source rows. Request-session
 * verification and provider responses are explicit simulations, never live. */
describe.skipIf(!socket)('LOCAL actual HTTP and services composition; SIMULATED pairing/provider/FIXTURE coverage',()=>{let db:any,locker:any;
 beforeAll(async()=>{const generated=process.env.AXIOM_TICKET_GOVERNANCE_PG_CLIENT;if(!socket||!/^\/private\/tmp\/axiom-ticket-governance-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||!generated||!/^\/private\/tmp\/axiom-provider-approval-pg-evidence-[^/]+\/generated\/index\.js$/.test(generated))throw Error('owned_fixture_required');const Client=createRequire(import.meta.url)(generated).PrismaClient;db=new Client({datasources:{db:{url:`postgresql://recovery_fixture@localhost/neondb?host=${encodeURIComponent(socket)}&connection_limit=1`}}});locker=new Client({datasources:{db:{url:`postgresql://recovery_fixture@localhost/neondb?host=${encodeURIComponent(socket)}&connection_limit=1`}}});FIXTURE.db=db;const[r]=await db.$queryRawUnsafe("SELECT current_database()='neondb' AND current_user='recovery_fixture' AND current_setting('listen_addresses')='' AS private");if(!r?.private)throw Error('owned_fixture_required');await db.$executeRawUnsafe('CREATE TEMP TABLE \"TauriDeploymentRequest\" (\"id\" TEXT PRIMARY KEY, \"organizationId\" TEXT NOT NULL, \"requesterUserId\" TEXT NOT NULL DEFAULT \'owner\', \"version\" INTEGER NOT NULL, \"status\" TEXT NOT NULL, \"intakeJson\" JSONB NOT NULL)');await db.$executeRawUnsafe('CREATE TEMP TABLE \"GitHubInstallation\" (\"id\" TEXT PRIMARY KEY, \"organizationId\" TEXT NOT NULL, \"githubInstallationId\" TEXT NOT NULL, \"accountLogin\" TEXT NOT NULL DEFAULT \'synthetic-company\', \"status\" TEXT NOT NULL, \"updatedAt\" TIMESTAMPTZ NOT NULL, \"revokedAt\" TIMESTAMPTZ, \"suspendedAt\" TIMESTAMPTZ)');await db.$executeRawUnsafe('CREATE TEMP TABLE \"CloudAccount\" (\"id\" TEXT PRIMARY KEY, \"organizationId\" TEXT NOT NULL, \"provider\" TEXT NOT NULL, \"externalAccountId\" TEXT NOT NULL, \"regions\" TEXT[] NOT NULL, \"updatedAt\" TIMESTAMPTZ NOT NULL, \"credentialRef\" TEXT, \"enabled\" BOOLEAN NOT NULL)');await db.$executeRawUnsafe('CREATE TEMP TABLE \"CloudAccountCredential\" (\"id\" TEXT PRIMARY KEY, \"organizationId\" TEXT NOT NULL, \"requesterUserId\" TEXT NOT NULL DEFAULT \'owner\', \"version\" INTEGER NOT NULL, \"revokedAt\" TIMESTAMPTZ)')});afterAll(async()=>{vi.restoreAllMocks();await locker?.$disconnect();await db?.$disconnect()});

 async function fixture(legacy=false){
  const yaml='name: Synthetic dispatch\non:\n  workflow_dispatch:\n    inputs:\n      branch:\n        type: string\n      environment:\n        type: string\n      client:\n        type: string\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo synthetic\n';
  const org='deploy-baseline-'+randomUUID(),connection='connection-'+randomUUID(),at=new Date(),owner={organizationId:org,actorUserId:'owner',sessionId:'owner-session'},reviewer={...owner,actorUserId:'reviewer',sessionId:'reviewer-session'};
  for(const[userId,role]of [['owner','owner'],['creator','owner'],['reviewer','security_reviewer']])await db.orgMembership.create({data:{organizationId:org,userId,role,acceptedAt:at}});
  for(const s of [owner,reviewer])await db.desktopSessionRecord.create({data:{id:s.sessionId+'-'+org,organizationId:org,userId:s.actorUserId,expiresAt:new Date(Date.now()+600000)}});
  owner.sessionId+='-'+org;reviewer.sessionId+='-'+org;
  await db.$executeRaw`INSERT INTO "GitHubInstallation"("id","organizationId","githubInstallationId","status","updatedAt") VALUES (${connection},${org},'123','active',${at})`;
  const selected={repositoryId:'team/repo',resourceId:'github:repository:team/repo',environment:'production'},network=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('no provider IO'));
  const service=(s:any)=>createGovernanceRequestService(request(s),db,s,()=>true),requester=service(owner),independent=service(reviewer);
  const bytes=new TextEncoder().encode('Deployments require verified evidence.'),doc={name:'deploy.md',selection:selected,utf8Bytes:bytes,expectedVersion:null,requestId:randomUUID()},artifact=await requester.uploadDocument(doc);
  const proposal=await requester.propose({organizationId:org,parentDigest:null,scopes:[selected],evidenceDigests:[artifact.snapshot.digest],rules:[{id:'deploy-rule',actions:['deployment.dispatch'],scope:selected,decision:'require_approval',requirements:['verified_evidence'],evidenceDigests:[artifact.snapshot.digest]}]},randomUUID());
  await independent.approve(proposal.id,0,proposal.baseline.digest,randomUUID());
  // Only this owned fixture supplies activation/coverage authority; production refuses.
  const fixtureActivation=createGovernanceRevisionStore(db,{assertCurrent:async()=>{},verifyEvidence:async()=>true,verifyCoverage:async()=>true});if(!legacy)await fixtureActivation.activate(owner,proposal.id,null,randomUUID());
  const intake={...completeReleaseIntake(),tenantId:org,targetEnvironment:legacy?'sandbox-east':'production',repositoryUrls:['https://github.com/team/repo'],productionPrUrls:['https://github.com/team/repo/pull/42'],sourceBranch:'release/demo',targetBranch:'main',windowStartUtc:new Date(Date.now()-60000).toISOString(),windowEndUtc:new Date(Date.now()+600000).toISOString(),workflowSource:{repositoryFullName:'team/repo',ref:'axiom-release-fixture',path:'.github/workflows/deploy.yml',blobSha:createHash('sha1').update('blob '+Buffer.byteLength(yaml)+'\0'+yaml).digest('hex')}};
  const release={id:'release-'+randomUUID(),organizationId:org,version:3,status:'submitted',intakeJson:{...intake,id:''}};intake.id=release.id;release.intakeJson=intake;
  const built=buildReleaseMergePlan(release,{organizationId:org,requestId:release.id,expectedVersion:3,expectedDigest:sha256ContentHash({requestVersion:3,intake}),method:'squash',observation:{connectionId:connection,connectionRevision:at.toISOString(),repositoryFullName:'team/repo',number:42,headRepositoryFullName:'team/repo',headRef:'release/demo',headSha:'a'.repeat(40),baseRef:'main',baseSha:'b'.repeat(40),state:'open',draft:false,merged:false}});if(!built.ok)throw Error('fixture');
  const planId=releaseOperationPlanId(org,release.id,3,built.digest),createdAt=new Date();
  await db.$executeRaw`INSERT INTO "TauriDeploymentRequest"("id","organizationId","requesterUserId","version","status","intakeJson") VALUES (${release.id},${org},'owner',3,'submitted',${JSON.stringify(intake)}::jsonb)`;
  await db.durableAgentWorkflow.create({data:{id:planId,organizationId:org,workflowKind:'release_operation_plan_v1',objective:'Fixture reviewed parent',version:1,currentStep:'reviewed',status:'completed',autonomyLevel:'observe',requestedByUserId:'creator',attemptCount:0,maxAttempts:1,createdAt,inputJson:{format:1,plan:built.plan,planDigest:built.digest,releaseRequesterUserId:'owner',createdAt:createdAt.toISOString(),deadlineAt:intake.windowEndUtc},stateJson:{reviewStatus:'reviewed'}}});
  for(const[sequence,actorId,eventType,detailJson]of [[0,'creator','release_plan.created',{planDigest:built.digest}],[1,'reviewer','release_plan.reviewed',{actionId:randomUUID(),expectedVersion:0,requestedDecision:'reviewed'}]]as const)await db.durableAgentWorkflowEvent.create({data:{workflowRunId:planId,organizationId:org,sequence,actorKind:'user',actorId,eventType,detailJson,occurredAt:createdAt}});
  const plan:any={purpose:'release_deployment',organizationId:org,releaseId:release.id,releaseVersion:3,intakeDigest:built.plan.intakeDigest,planId,creatorUserId:'creator',requesterUserId:'owner',executorUserId:'owner',repositoryFullName:'team/repo',connectionId:connection,connectionRevision:at.toISOString(),installationId:'123',workflowPath:intake.workflowSource.path,workflowBlobSha:intake.workflowSource.blobSha,sourceCommitSha:'d'.repeat(40),refKind:'tag',ref:intake.workflowSource.ref,inputs:intake.workflowInputs,sourcePolicy:'github_immutable_release_v1',windowStart:intake.windowStartUtc,expiresAt:intake.windowEndUtc};


  // A real reviewed numeric execution policy; no permission bypass.
  const numeric=await requester.executionPolicies.propose({organizationId:org,scope:selected,parentDigest:null,autonomyLevel:4,actions:['deployment.dispatch'],executorUserIds:['owner'],expiresAt:new Date(Date.now()+600000).toISOString()},randomUUID());
  await independent.executionPolicies.approve(numeric.id,0,numeric.policy.digest,randomUUID());await requester.executionPolicies.activate(numeric.id,null,null,randomUUID());
  const posts:string[]=[];
  const fetcher=vi.fn(async(url:any,init:any)=>{
   // Separate connection proves provider I/O never runs under parent row locks.
   await locker.$transaction(async(tx:any)=>{await tx.$queryRaw`SELECT "id" FROM "DurableAgentWorkflow" WHERE "id"=${planId} FOR UPDATE NOWAIT`});
   const u=new URL(String(url));expect(u.origin).toBe('https://api.github.com');
   if(init.method==='POST'){expect(u.pathname).toBe('/repos/team/repo/actions/workflows/'+encodeURIComponent(plan.workflowPath.split('/').at(-1)!)+'/dispatches');posts.push(u.pathname);return Response.json({workflow_run_id:123,run_url:'https://api.github.com/repos/team/repo/actions/runs/123',html_url:'https://github.com/team/repo/actions/runs/123'})}
   if(u.pathname==='/repos/team/repo/contents/'+plan.workflowPath)return Response.json({type:'file',path:plan.workflowPath,sha:plan.workflowBlobSha,encoding:'base64',content:Buffer.from(yaml).toString('base64')});
   if(u.pathname==='/repos/team/repo/git/ref/tags/'+plan.ref)return Response.json({ref:'refs/tags/'+plan.ref,object:{type:'commit',sha:plan.sourceCommitSha}});
   if(u.pathname==='/repos/team/repo/releases/tags/'+plan.ref)return Response.json({id:99,tag_name:plan.ref,draft:false,immutable:true,published_at:at.toISOString()});
   if(u.pathname==='/repos/team/repo/actions/runs/123/attempts/1')return Response.json({id:123,run_attempt:1,workflow_id:7,event:'workflow_dispatch',path:plan.workflowPath,head_sha:plan.sourceCommitSha,head_branch:plan.ref,repository:{full_name:'team/repo'},head_repository:{full_name:'team/repo'}});
   if(u.pathname==='/repos/team/repo/actions/workflows/7')return Response.json({id:7,path:plan.workflowPath});
   if(u.pathname==='/repos/team/repo')return Response.json({full_name:'team/repo',archived:false,disabled:false});
   throw Error('Unexpected SIMULATED GitHub path: '+u.pathname);
  })as unknown as typeof fetch;
  const factory=(r:any,repo:any,s:any)=>{const actual=createReleaseDeploymentServices(r,repo,s,{isEnabled:()=>true,sourcePolicy:'github_immutable_release_v1',allowImmutableTagDispatch:()=>true,actorPurpose:s.actorUserId==='reviewer'?'approver':'executor',fetch:fetcher});return actual};
  const approval=(body?:unknown)=>handleReleaseDeploymentApproval(request(reviewer,body),release.id,planId,factory);
  const execution=(body?:unknown)=>handleReleaseDeploymentExecution(request(owner,body),release.id,planId,(r,repo,s)=>factory(r,repo,s).ports);
  const action=(name:string)=>({action:name,expectedVersion:0,clientRequestId:randomUUID()});
  const previewResponse=await approval();expect(await previewResponse.clone().json(), 'actual service preview').toMatchObject({ok:true});expect(previewResponse.status).toBe(200);const preview=(await previewResponse.json()).data;
  return {org,owner,reviewer,proposal,preview,approval,execution,action,posts,network,planId,approve:()=>approval({plan:preview.plan,clientRequestId:randomUUID(),reviewedExactAction:true,...(preview.governanceBaselineDigest?{governanceBaselineDigest:preview.governanceBaselineDigest}:{})})};
 }
 it('returns active digest, refuses missing exact baseline, issues reviewed approval and dispatches exactly once through actual HTTP/services',async()=>{
  const f=await fixture();expect(f.preview.governanceBaselineDigest).toBe(f.proposal.baseline.digest);
  const missing=await f.approval({plan:f.preview.plan,clientRequestId:randomUUID(),reviewedExactAction:true});expect(missing.status).toBe(409);expect(await db.durableAgentWorkflow.count({where:{organizationId:f.org,workflowKind:'release_deployment_approval_v1'}})).toBe(0);
  const approved=await f.approve();expect(await approved.clone().json()).toMatchObject({ok:true,data:{approval:{governanceBaselineDigest:f.proposal.baseline.digest}}});expect(approved.status).toBe(201);
  const prepared=await f.execution(f.action('prepare'));expect(await prepared.clone().json()).toMatchObject({ok:true,data:{operation:{state:'prepared',attemptCount:0}}});expect(prepared.status).toBe(200);
  const executed=await f.execution(f.action('execute'));const result=await executed.clone().json();expect(result).toMatchObject({ok:true,data:{operation:{state:'accepted',attemptCount:1,deploymentSucceeded:false}}});expect(executed.status).toBe(200);expect(f.posts).toHaveLength(1);const approvalId=(await approved.json()).data.approval.id;expect(await db.durableAgentWorkflow.findUnique({where:{id:approvalId}})).toMatchObject({currentStep:'consumed',version:1});
  expect(await (await f.execution()).json()).toMatchObject({ok:true,data:{operation:{id:result.data.operation.id,state:'accepted',attemptCount:1}}});expect((await f.execution(f.action('execute'))).status).toBe(409);expect(f.posts).toHaveLength(1);
  expect(await db.durableAgentWorkflow.findUnique({where:{id:result.data.operation.id}})).toMatchObject({attemptCount:1,currentStep:'accepted'});expect(f.network).not.toHaveBeenCalled();
 });
 it('retains custom-environment legacy execution only with positively absent enrollment and a real independent approval',async()=>{
  const f=await fixture(true);expect(f.preview.governanceBaselineDigest).toBeUndefined();expect((await f.approve()).status).toBe(201);
  expect((await f.execution(f.action('prepare'))).status).toBe(200);const response=await f.execution(f.action('execute'));expect(await response.clone().json()).toMatchObject({ok:true,data:{operation:{state:'accepted',attemptCount:1,deploymentSucceeded:false}}});expect(response.status).toBe(200);expect(f.posts).toHaveLength(1);expect((await f.execution(f.action('execute'))).status).toBe(409);expect(f.posts).toHaveLength(1);expect(f.network).not.toHaveBeenCalled();
 });
 it.each(['reviewer','metadata'])('refuses %s authority failure before provider POST without legacy fallback',async(kind)=>{
  const f=await fixture();expect((await f.approve()).status).toBe(201);expect((await f.execution(f.action('prepare'))).status).toBe(200);
  if(kind==='reviewer')await db.orgMembership.updateMany({where:{organizationId:f.org,userId:'reviewer'},data:{role:'read_only'}});else FIXTURE.metadataFailure=true;
  try{const failures=FIXTURE.metadataFailures;expect((await f.execution(f.action('execute'))).status).toBe(409);expect(f.posts).toHaveLength(0);if(kind==='metadata')expect(FIXTURE.metadataFailures).toBeGreaterThan(failures);const rows=await db.durableAgentWorkflow.findMany({where:{organizationId:f.org,workflowKind:'release_deployment_execution_v1'}});expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({attemptCount:0,currentStep:'prepared'})}finally{FIXTURE.metadataFailure=false}
 });
});
