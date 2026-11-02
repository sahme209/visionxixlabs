import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
import {NextRequest} from 'next/server';
vi.mock('../requestAuthority',()=>({createGovernanceRequestAuthority:()=>async(tx:any,s:any,role:string)=>{
 const rows=await tx.$queryRaw`SELECT "role" FROM "OrgMembership" WHERE "organizationId"=${s.organizationId} AND "userId"=${s.actorUserId}`;
 const expected=role==='policy_admin'?'admin':role==='approver'?'security_reviewer':null;
 if(rows.length!==1||expected&&rows[0].role!==expected)throw Error('fixture_paired_authority_refused');
}}));
import {compileBaseline,parseEvidenceSnapshot} from '../contracts';
import {createGovernanceRevisionStore} from '../revisionStore';
import {createGovernanceExecutionPolicyRequestService} from '../executionPolicyRequestService';
import {createGovernanceMergeRequestAdmission} from '../mergeRequestAdmission';
import {createMergeProviderPreflight} from '../mergeProviderPreflight';
import {createGovernedProviderMergeExecutor} from '../governedProviderMerge';
import {createGovernanceMergeBindingReader} from '../mergeBindingReader';
import {completeReleaseIntake} from '@/lib/tauri/__tests__/fixtures/completeReleaseIntake';
import {buildReleaseMergePlan} from '@/lib/tauri/releaseMergePlan';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {createReleaseOperationPlan,reviewReleaseOperationPlan} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {createReleaseProviderMergeApprovalStore} from '@/lib/tauri/releaseProviderMergeApprovalStore';
import {createReleaseProviderMergeStore} from '@/lib/tauri/releaseProviderMergeStore';
import {createReleaseProviderMergeCredentialReader} from '@/lib/tauri/releaseProviderMergeCredential';
import {createReleaseDirectMergeSupportReader} from '@/lib/tauri/releaseDirectMergeSupport';
import {createReleaseMergeTopologyReader} from '@/lib/tauri/releaseMergeTopology';
const socket=process.env.AXIOM_EXECUTION_POLICY_PG_SOCKET;
describe.skipIf(!socket)('actual merge admission stores with simulated GitHub',()=>{
 let db:any,locker:any;
 beforeAll(async()=>{
  const generated=process.env.AXIOM_EXECUTION_POLICY_PG_CLIENT;
  if(!socket||!/^\/private\/tmp\/axiom-execution-policy-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||!generated||!generated.startsWith(socket.slice(0,-7)+'/generated/'))throw Error('owned_fixture_required');
  const Client=createRequire(import.meta.url)(generated).PrismaClient;
  locker=new Client({transactionOptions:{timeout:15000},datasources:{db:{url:`postgresql://policy_fixture@localhost/policy_fixture?host=${encodeURIComponent(socket)}`}}});
  db=new Client({transactionOptions:{timeout:15000},datasources:{db:{url:`postgresql://policy_fixture@localhost/policy_fixture?host=${encodeURIComponent(socket)}`}}});
  const[r]=await db.$queryRawUnsafe("SELECT current_database()='policy_fixture' AND current_user='policy_fixture' AND current_setting('listen_addresses')='' AS private");if(!r?.private)throw Error('owned_fixture_required');
 });
 afterAll(async()=>{await locker?.$disconnect();await db?.$disconnect()});
 async function fixture(legacy=false){
  const org='merge-'+randomUUID(),now=Date.now(),selection={repositoryId:'team/service',resourceId:'github:repository:team/service',environment:'production' as const};
  const identities=Object.fromEntries(['owner','reviewer','executor','creator','requester','approver'].map(userId=>[userId,{organizationId:org,actorUserId:userId,sessionId:org+'-'+userId}]));
  for(const[userId,role]of [['owner','admin'],['reviewer','security_reviewer'],['executor','operator'],['creator','admin'],['requester','operator'],['approver','security_reviewer']]){
   await db.orgMembership.create({data:{organizationId:org,userId,role,acceptedAt:new Date()}});
   await db.desktopSessionRecord.create({data:{id:identities[userId].sessionId,organizationId:org,userId,expiresAt:new Date(now+3600000)}});
  }
  const scope=identities.executor,intake={...completeReleaseIntake(),id:'release-'+randomUUID(),tenantId:org,targetEnvironment:'production',windowStartUtc:new Date(now-60000).toISOString(),windowEndUtc:new Date(now+3600000).toISOString(),repositoryUrls:['https://github.com/team/service'],productionPrUrls:['https://github.com/team/service/pull/42'],sourceBranch:'feature',targetBranch:'main'};
  const release={id:intake.id,organizationId:org,requesterUserId:'requester',status:'submitted',version:1,intakeJson:intake},connection={id:'connection-'+randomUUID(),organizationId:org,githubInstallationId:'123',accountLogin:'team',status:'active',updatedAt:new Date(now),revokedAt:null,suspendedAt:null};
  await db.tauriDeploymentRequest.create({data:release});await db.gitHubInstallation.create({data:connection});
  const built=buildReleaseMergePlan(release,{organizationId:org,requestId:release.id,expectedVersion:1,expectedDigest:sha256ContentHash({requestVersion:1,intake}),method:'squash',observation:{connectionId:connection.id,connectionRevision:connection.updatedAt.toISOString(),repositoryFullName:'team/service',number:42,headRepositoryFullName:'team/service',headRef:'feature',headSha:'a'.repeat(40),baseRef:'main',baseSha:'b'.repeat(40),state:'open',draft:false,merged:false}});if(!built.ok)throw Error('fixture_plan_invalid');
  const plan=built.plan,planRecord=await createReleaseOperationPlan(db,{organizationId:org,actorUserId:'creator',assertCurrent:async()=>{},plan,planDigest:built.digest});
  await reviewReleaseOperationPlan(db,{organizationId:org,actorUserId:'reviewer',assertCurrent:async()=>{},id:planRecord.id,expectedVersion:0,clientRequestId:randomUUID(),decision:'reviewed',currentPlan:plan,currentPlanDigest:built.digest});
  const evidence=parseEvidenceSnapshot({organizationId:org,source:'github',connectionId:connection.id,connectionRevision:connection.updatedAt.toISOString(),collectorVersion:'fixture',selection,observedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+3600000).toISOString(),completeness:'complete',sourceDigest:'f'.repeat(64),facts:[]});
  const baseline=compileBaseline({organizationId:org,parentDigest:null,scopes:[selection],evidenceDigests:[evidence.digest],rules:[{id:'exact-merge',actions:['repository.merge'],scope:selection,decision:'require_approval',requirements:['verified_evidence'],evidenceDigests:[evidence.digest]}]});
  const baselines=createGovernanceRevisionStore(db,{assertCurrent:async()=>{},verifyEvidence:async()=>true,verifyCoverage:async()=>true});
  const proposal=await baselines.propose(identities.owner,baseline,randomUUID());await baselines.approve(identities.reviewer,proposal.id,0,baseline.digest,randomUUID());if(!legacy)await baselines.activate(identities.owner,proposal.id,null,randomUUID());
  const policies=(user:string)=>createGovernanceExecutionPolicyRequestService(new NextRequest('https://app.test/local'),db,identities[user],()=>true);
  const policy=await policies('owner').propose({organizationId:org,scope:selection,parentDigest:null,autonomyLevel:4,actions:['repository.merge'],executorUserIds:['executor'],expiresAt:new Date(now+3600000).toISOString()},randomUUID());
  await policies('reviewer').approve(policy.id,0,policy.policy.digest,randomUUID());await policies('owner').activate(policy.id,null,null,randomUUID());
  const approvals=createReleaseProviderMergeApprovalStore(db,{assertCurrent:async(tx,input)=>{
   const members=await tx.$queryRaw<Array<{role:string}>>`SELECT "role" FROM "OrgMembership" WHERE "organizationId"=${org} AND "userId"=${input.actorUserId} FOR SHARE`;
   if(members.length!==1||input.role==='approver'&&members[0].role!=='security_reviewer'||input.role==='executor'&&members[0].role!=='operator')throw Error('fixture_provider_authority_refused');
   const sessionId=input.approverSessionId??(input.actorUserId===input.scope.actorUserId?input.scope.sessionId:undefined);
   if(sessionId){const sessions=await tx.$queryRaw<Array<{live:boolean}>>`SELECT ("revokedAt" IS NULL AND "expiresAt">clock_timestamp()) AS "live" FROM "DesktopSessionRecord" WHERE "id"=${sessionId} AND "organizationId"=${org} AND "userId"=${input.actorUserId} FOR SHARE`;if(sessions.length!==1||sessions[0].live!==true)throw Error('fixture_provider_session_refused')}

  },assertGovernanceBaseline:async(tx,s,digest)=>{if((await baselines.readActive(s,selection,tx)).digest!==digest)throw Error('baseline_changed');}});
  await approvals.issue(identities.approver,{planId:planRecord.id,expectedPlanVersion:1,sourcePolicy:'expected_head_observed_base',executorUserId:'executor',clientRequestId:randomUUID(),...(legacy?{}:{governanceBaselineDigest:baseline.digest})});
  let afterTransactionReturn:(()=>Promise<void>)|undefined,postReturnLiveBefore=false,postReturnWaited=false,postReturnError:unknown;
  let onConsume:((tx:any)=>Promise<void>)|undefined,delayFinalClock=false,expireFinalSession=false,admissionBoundaries=0;
  const storeRepo=new Proxy(db,{get(target,key){if(key==='$transaction')return async(fn:any)=>{const result=await target.$transaction(async(tx:any)=>fn(new Proxy(tx,{get(inner,method){if(method==='$queryRaw')return async(q:TemplateStringsArray,...args:any[])=>{if(delayFinalClock&&q.join('').includes('clock_timestamp')){delayFinalClock=false;await inner.$queryRaw`SELECT true AS delayed FROM pg_sleep(0.3)`}return inner.$queryRaw(q,...args)};return Reflect.get(inner,method)}})));if(afterTransactionReturn){const wait=afterTransactionReturn;afterTransactionReturn=undefined;await wait()}return result};return Reflect.get(target,key)}});
  const store=createReleaseProviderMergeStore(storeRepo,{assertCurrent:async()=>{},assertCurrentForAdmission:async(tx,s,b)=>{
   await approvals.readProviderApproval(tx,s,b.planId,'release_merge_provider_'+sha256ContentHash({organizationId:org,planId:b.planId}));
   if(expireFinalSession&&++admissionBoundaries===3)await tx.desktopSessionRecord.update({where:{id:identities.approver.sessionId},data:{expiresAt:new Date(Date.now()+250)}});
   const expiries:number[]=[];for(const actor of [identities.executor,identities.approver]){const rows=await tx.$queryRaw<Array<{id:string;expiresAt:Date;live:boolean}>>`SELECT "id","expiresAt",("revokedAt" IS NULL AND "expiresAt">clock_timestamp()) AS "live" FROM "DesktopSessionRecord" WHERE "id"=${actor.sessionId} AND "organizationId"=${org} AND "userId"=${actor.actorUserId} FOR SHARE`;if(rows.length!==1||!rows[0].live)throw Error('fixture_current_session_required');expiries.push(rows[0].expiresAt.getTime())}
   return()=>{const at=Date.now();if(!Number.isFinite(at)||expiries.some(expiry=>expiry<=at))throw Error('fixture_current_session_expired')};
  },readProviderApproval:approvals.readProviderApproval,consumeProviderApproval:async(tx,s,id,op)=>{await approvals.consumeProviderApproval(tx,s,id,op);if(onConsume)await onConsume(tx)}}),operation=await store.prepare(scope,planRecord.id);
  let merged=false,afterTarget:(()=>Promise<void>)|undefined;
  const calls:Array<{url:string;method:string;attempt:number}>=[];
  const pr=()=>({number:42,state:merged?'closed':'open',draft:false,merged,merge_commit_sha:merged?'e'.repeat(40):null,head:{sha:plan.pullRequest.headSha,ref:'feature',repo:{full_name:'team/service'}},base:{sha:plan.pullRequest.baseSha,ref:'main',repo:{full_name:'team/service'}}});
  const fetcher=vi.fn(async(url:any,init:any)=>{
   // An independent transaction must acquire both operation and reviewed-plan
   // locks immediately: provider traffic cannot occur under either store lock.
   await db.$transaction(async(tx:any)=>{await tx.$queryRaw`SELECT "id" FROM "DurableAgentWorkflow" WHERE "id" IN (${operation.id},${planRecord.id}) FOR UPDATE NOWAIT`;});
   const row=await db.durableAgentWorkflow.findUnique({where:{id:operation.id}});calls.push({url:String(url),method:init.method,attempt:row.attemptCount});
   if(init.method==='PUT'){merged=true;return Response.json({sha:'e'.repeat(40),merged:true});}
   if(String(url).endsWith('/access_tokens'))return Response.json({token:'FIXTURE_TOKEN',expires_at:new Date(Date.now()+3600000).toISOString(),permissions:{contents:'write',pull_requests:'read',metadata:'read'},repository_selection:'selected',repositories:[{name:'service',full_name:'team/service',owner:{login:'team'}}]},{status:201});
   if(String(url).includes('/compare/'))return Response.json({status:'ahead',ahead_by:1,behind_by:0,total_commits:1,base_commit:{sha:plan.pullRequest.baseSha},merge_base_commit:{sha:plan.pullRequest.baseSha},commits:[{sha:plan.pullRequest.headSha,parents:[{sha:plan.pullRequest.baseSha}]}]});
   if(String(url).includes('/rulesets?')||String(url).includes('/rules/branches/'))return Response.json([]);
   if(String(url).endsWith('/protection'))return Response.json({message:'Not Found'},{status:404});
   if(String(url).includes('/pulls?'))return Response.json([pr()]);
   if(String(url).endsWith('/pulls/42')){if(afterTarget&&row.attemptCount===1){const action=afterTarget;afterTarget=undefined;await action();}return Response.json(pr());}
   return Response.json({id:12,full_name:'team/service',default_branch:'main',archived:false,disabled:false,allow_merge_commit:true,allow_squash_merge:true,allow_rebase_merge:true});
  });
  const adapterCurrent=async(actual:any,s:AbortSignal)=>{s.throwIfAborted();const row=await store.get(scope,operation.id),current=await(row.state==='prepared'?store.validatePrepared(scope,operation.id):store.beforeDispatch(scope,operation.id));if(sha256ContentHash(current)!==sha256ContentHash(actual))throw Error('plan_changed');};
  const readCredential=createReleaseProviderMergeCredentialReader({isEnabled:()=>true,assertCurrent:adapterCurrent,readInstallation:async()=>connection,readAppAuthorization:async b=>({...b,jwt:'fixture.jwt.signature',expiresAt:Date.now()+60000}),fetch:fetcher as typeof fetch});
  const topology=createReleaseMergeTopologyReader({isEnabled:()=>true,assertCurrent:adapterCurrent,readCredential:async()=>({organizationId:org,connectionId:connection.id,connectionRevision:plan.connectionRevision,repositoryFullName:'team/service',token:'FIXTURE_POLICY_TOKEN',expiresAt:Date.now()+3600000,permissions:{administration:'read',contents:'read',pull_requests:'read',metadata:'read'}}),fetch:fetcher as typeof fetch});
  const readDirectMergeSupport=createReleaseDirectMergeSupportReader({isEnabled:()=>true,assertCurrent:adapterCurrent,readTopologyEvidence:topology,fetch:fetcher as typeof fetch});
  const provider=createMergeProviderPreflight({assertCurrent:adapterCurrent,readCredential,readDirectMergeSupport}),readBinding=createGovernanceMergeBindingReader(db,store,async()=>{}),binding=await readBinding(scope,operation.id,new AbortController().signal);
  let coveredActions=['repository.merge'];
  const service={executionPolicies:policies('executor'),readActiveEvidence:async()=>({baseline:await baselines.readActive(scope,selection),evidence:[evidence],evidenceRefreshes:[],expiresAt:Date.now()+30000,executionAuthorized:false as const}),readScopeEnrollment:async()=>{const pointer=await db.durableAgentWorkflow.findFirst({where:{id:'governance_active_'+sha256ContentHash({organizationId:org,scope:selection})}});return pointer?{enrolled:true as const,baselineDigest:(await baselines.readActiveCandidate(scope,selection)).baseline.digest}:{enrolled:false as const}},readScopeEnrollmentLocked:async(tx:any)=>{await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(org)}))`;const pointer=await tx.durableAgentWorkflow.findFirst({where:{id:'governance_active_'+sha256ContentHash({organizationId:org,scope:selection})}});if(!pointer)return{enrolled:false as const};return{enrolled:true as const,baselineDigest:(await baselines.readActive(scope,selection,tx)).digest,evidenceExpiresAt:Date.now()+30000}},readExecutionCoverage:async()=>({enrolled:true,coveredActions})};
  let finalMutation:(()=>Promise<void>)|undefined,mutationPhase='',outsideLimits=0,enrollmentReads=0;
  const limitsReader=service.executionPolicies.readAuthority;service.executionPolicies.readAuthority=async(...args:Parameters<typeof limitsReader>)=>{const result=await limitsReader(...args);if(!args[3]&&++outsideLimits===6&&mutationPhase==='policy'&&finalMutation){const mutate=finalMutation;finalMutation=undefined;await mutate()}return result};
  const enrollmentReader=service.readScopeEnrollment;service.readScopeEnrollment=async()=>{const result=await enrollmentReader();if(++enrollmentReads===6&&mutationPhase==='enrollment'&&finalMutation){const mutate=finalMutation;finalMutation=undefined;await mutate()}return result};
  const guard=createGovernanceMergeRequestAdmission(scope,operation.id,binding,db,store,approvals,service,provider);
  const finalGuard=guard.assertFinal;guard.assertFinal=async(...args)=>{const fresh=await finalGuard(...args);if(expireFinalSession&&admissionBoundaries===3)delayFinalClock=true;return fresh};
  const run=(parent?:AbortSignal)=>createGovernedProviderMergeExecutor(store,{guard,readBinding,transport:{isEnabled:()=>true,assertCurrent:async(_id,p,s)=>{const current=await store.beforeDispatch(scope,operation.id);s.throwIfAborted();if(sha256ContentHash(current)!==sha256ContentHash(p))throw Error('plan_changed');},readCredential,readDirectMergeSupport,fetch:fetcher as typeof fetch}}).run(scope,operation.id,parent);
  return{calls,store,scope,operation,run,policy,policies,delayFinalTransactionReturn(kind:string){const original=store.beforeDispatchWithAdmission.bind(store);let boundaries=0;store.beforeDispatchWithAdmission=async(s,id,verify)=>{const final=++boundaries===2;if(final&&kind==='session')await db.desktopSessionRecord.update({where:{id:identities.approver.sessionId},data:{expiresAt:new Date(Date.now()+1000)}});try{return await original(s,id,async(tx,p)=>{const freshness=await verify(tx,p);if(final){freshness();postReturnLiveBefore=true;afterTransactionReturn=async()=>{await locker.$transaction(async(probe:any)=>{await probe.$queryRaw`SELECT "id" FROM "DurableAgentWorkflow" WHERE "id"=${operation.id} FOR UPDATE NOWAIT`});await locker.$queryRaw`SELECT true AS delayed FROM pg_sleep(${kind==='session'?1.1:5.1})`;postReturnWaited=true}}return freshness})}catch(error){postReturnError=error;throw error}}},postReturnEvidence(){return{postReturnLiveBefore,postReturnWaited,postReturnError}},onConsume(action:(tx:any)=>Promise<void>){onConsume=action},expireReviewerDuringFinalClock(){expireFinalSession=true},mutateFinal(kind:string,phase:string){mutationPhase=phase;finalMutation=async()=>{if(kind==='reviewer')await db.orgMembership.updateMany({where:{organizationId:org,userId:'approver'},data:{role:'read_only'}});else if(kind==='session')await db.desktopSessionRecord.update({where:{id:identities.approver.sessionId},data:{revokedAt:new Date()}});else await db.gitHubInstallation.update({where:{id:connection.id},data:{status:'revoked'}})}},duringClaim(kind:string){for(const method of ['claim','claimWithAdmission']as const){const original=(store as any)[method];if(typeof original!=='function')continue;(store as any)[method]=async(...args:any[])=>{let release!:()=>void,locked!:()=>void;const ready=new Promise<void>(r=>{locked=r}),hold=new Promise<void>(r=>{release=r});const holder=locker.$transaction(async(tx:any)=>{await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(org)}))`;await tx.$queryRaw`SELECT "id" FROM "DurableAgentWorkflow" WHERE "id"=${operation.id} FOR UPDATE`;locked();await hold;const nested=new Proxy(db,{get(target,key){return key==='$transaction'?async(fn:any)=>fn(tx):Reflect.get(target,key)}});if(kind==='policy')await createGovernanceExecutionPolicyRequestService(new NextRequest('https://app.test/fixture'),nested,identities.owner,()=>true).revoke(policy.id,1,randomUUID());else if(kind==='enrollment')await createGovernanceRevisionStore(nested,{assertCurrent:async()=>{},verifyEvidence:async()=>true,verifyCoverage:async()=>true}).activate(identities.owner,proposal.id,null,randomUUID());else if(kind==='baseline')await createGovernanceRevisionStore(nested,{assertCurrent:async()=>{},verifyEvidence:async()=>true}).revoke(identities.owner,proposal.id,1,randomUUID());else await tx.orgMembership.updateMany({where:{organizationId:org,userId:'approver'},data:{role:'read_only'}})});await ready;const pending=original.apply(store,args);await new Promise(r=>setTimeout(r,25));release();await holder;return pending}}},revokeBaselineAfterFinalLimits(){
   const original=service.executionPolicies.readAuthority;let reads=0;
   service.executionPolicies.readAuthority=async(...args:Parameters<typeof original>)=>{const result=await original(...args);if(++reads===3)await baselines.revoke(identities.owner,proposal.id,1,randomUUID());return result};
  },withoutCoverage(){coveredActions=[];},afterTarget(action:()=>Promise<void>){afterTarget=action;}};
 }
 it('proves provider authority before real claim and rechecks before the single actual-transport PUT',async()=>{
  const f=await fixture();expect(await f.run()).toMatchObject({state:'confirmed',attemptCount:1});
  expect(f.calls.some(c=>c.attempt===0&&c.url.includes('/compare/'))).toBe(true);
  expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(1);
  expect(f.calls.find(c=>c.method==='PUT')!.attempt).toBe(1);
  await expect(f.store.validatePrepared(f.scope,f.operation.id)).rejects.toThrow();
 });
 it('revocation after claim prevents PUT and retains the consumed one-attempt outcome',async()=>{
  const f=await fixture();f.afterTarget(async()=>{await f.policies('owner').revoke(f.policy.id,1,randomUUID());});
  expect(await f.run()).toMatchObject({state:'refused',attemptCount:1});expect(f.calls.some(c=>c.method==='PUT')).toBe(false);
  expect((await f.store.claim(f.scope,f.operation.id)).claimed).toBe(false);
 });
 it('a different approved policy revision at the same numeric level cannot replace the original claim authority',async()=>{
  const f=await fixture();f.afterTarget(async()=>{
   const {digest,...raw}=f.policy.policy;
   const replacement=await f.policies('owner').propose({...raw,parentDigest:digest},randomUUID());
   await f.policies('reviewer').approve(replacement.id,0,replacement.policy.digest,randomUUID());
   await f.policies('owner').activate(replacement.id,0,digest,randomUUID());
  });
  expect(await f.run()).toMatchObject({state:'refused',attemptCount:1});expect(f.calls.some(c=>c.method==='PUT')).toBe(false);
 });
 it('missing production-equivalent coverage refuses before a claim or provider credential proof',async()=>{
  const f=await fixture();f.withoutCoverage();await expect(f.run()).rejects.toThrow('governance_admission_unavailable');
  expect(f.calls).toHaveLength(0);expect(await f.store.get(f.scope,f.operation.id)).toMatchObject({state:'prepared',attemptCount:0});
 });

 it('refuses a real baseline revocation after the final action-authority await before claiming',async()=>{
  const f=await fixture();f.revokeBaselineAfterFinalLimits();
  await expect(f.run()).rejects.toThrow('governance_admission_unavailable');
  expect(f.calls.some(c=>c.method==='PUT')).toBe(false);
  expect(await f.store.get(f.scope,f.operation.id)).toMatchObject({state:'prepared',attemptCount:0});
 });

 it.each(['policy','enrollment','baseline','reviewer'])('merge coherent claim refuses %s changed during actual lock wait without consuming approval or attempt',async kind=>{
  const f=await fixture(kind==='enrollment');f.duringClaim(kind);await f.run().catch(error=>expect(error).toBeInstanceOf(Error));
  expect(f.calls.some(c=>c.method==='PUT')).toBe(false);expect(await db.durableAgentWorkflow.findUnique({where:{id:f.operation.id}})).toMatchObject({currentStep:'prepared',attemptCount:0,version:0});
  const approval=await db.durableAgentWorkflow.findFirst({where:{organizationId:f.scope.organizationId,workflowKind:'release_provider_merge_approval_v1'}});expect(approval).toMatchObject({currentStep:'approved',version:0});
 });
 it.each([['reviewer','policy'],['session','policy'],['installation','policy'],['reviewer','enrollment']])('merge coherent final PUT refuses %s changed during the final %s await',async(kind,phase)=>{
  const f=await fixture();f.mutateFinal(kind,phase);await f.run().catch(error=>expect(error).toBeInstanceOf(Error));expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(0);expect(await db.durableAgentWorkflow.findUnique({where:{id:f.operation.id}})).toMatchObject({attemptCount:1});
 });

 it('merge coherent claim cancellation during actual approval consumption restores approval and attempt',async()=>{
  const f=await fixture(),cancel=new AbortController();f.onConsume(async()=>cancel.abort(Error('merge_claim_cancelled')));
  await expect(f.run(cancel.signal)).rejects.toThrow('merge_claim_cancelled');expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(0);
  expect(await db.durableAgentWorkflow.findUnique({where:{id:f.operation.id}})).toMatchObject({currentStep:'prepared',attemptCount:0});
  expect(await db.durableAgentWorkflow.findFirst({where:{organizationId:f.scope.organizationId,workflowKind:'release_provider_merge_approval_v1'}})).toMatchObject({currentStep:'approved',version:0});
 });
 it('merge coherent claim rolls approval and attempt back when genuine provider proof expires during durable work',async()=>{
  const f=await fixture();f.onConsume(async(tx)=>{await tx.$queryRaw`SELECT true AS delayed FROM pg_sleep(5.1)`});
  await expect(f.run()).rejects.toThrow('governance_merge_provider_proof_unavailable');
  expect(await db.durableAgentWorkflow.findUnique({where:{id:f.operation.id}})).toMatchObject({currentStep:'prepared',attemptCount:0});
  expect(await db.durableAgentWorkflow.findFirst({where:{organizationId:f.scope.organizationId,workflowKind:'release_provider_merge_approval_v1'}})).toMatchObject({currentStep:'approved',version:0});expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(0);
 },20000);
 it('merge coherent final clock cannot outlive the actual original approver session expiry',async()=>{
  const f=await fixture();f.expireReviewerDuringFinalClock();await f.run().catch(error=>expect(error).toBeInstanceOf(Error));
  expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(0);expect(await db.durableAgentWorkflow.findUnique({where:{id:f.operation.id}})).toMatchObject({attemptCount:1});
 });

 it('merge coherent final database wait cannot renew a consumed genuine provider proof',async()=>{
  const f=await fixture(),original=f.store.beforeDispatchWithAdmission.bind(f.store);let boundaries=0,finalError:unknown;
  f.store.beforeDispatchWithAdmission=async(s,id,verify)=>{if(++boundaries===2)await db.$queryRaw`SELECT true AS delayed FROM pg_sleep(5.1)`;try{return await original(s,id,verify)}catch(error){finalError=error;throw error}};
  await f.run().catch(error=>expect(error).toBeInstanceOf(Error));expect(finalError).toMatchObject({message:'governance_merge_provider_proof_unavailable'});expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(0);
  expect(await db.durableAgentWorkflow.findUnique({where:{id:f.operation.id}})).toMatchObject({attemptCount:1});
 },20000);

 it.each(['provider','session'])('merge postcommit final result delay cannot outlive the original private %s bound',async kind=>{
  const f=await fixture();f.delayFinalTransactionReturn(kind);await f.run().catch(error=>expect(error).toBeInstanceOf(Error));
  expect(f.postReturnEvidence()).toMatchObject({postReturnLiveBefore:true,postReturnWaited:true});expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(0);
  expect(await db.durableAgentWorkflow.findUnique({where:{id:f.operation.id}})).toMatchObject({attemptCount:1});
  expect(await db.durableAgentWorkflow.findFirst({where:{organizationId:f.scope.organizationId,workflowKind:'release_provider_merge_approval_v1'}})).toMatchObject({currentStep:'consumed'});
 },20000);

});
