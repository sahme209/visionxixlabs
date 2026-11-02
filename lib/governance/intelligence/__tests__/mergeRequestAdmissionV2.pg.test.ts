import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
// Actual stores/provenance/metadata issuer; pairing/config/signing/provider replies
// and the explicitly enabled coverage port are SIMULATED local qualification.
vi.mock('node:crypto',async()=>({...await vi.importActual<typeof import('node:crypto')>('node:crypto'),createSign:()=>({update(){},end(){},sign:()=>Buffer.from('SIMULATED_SIGNATURE')})}));
vi.mock('@/lib/connectors/github/githubConfig',()=>({getGithubConfig:async()=>({appConfigured:true,appId:123}),resolveGithubAppPrivateKey:async()=>'SIMULATED_SIGNING_KEY'}));
import {readReleaseInstallationEligibility} from '@/lib/connectors/github/githubAppAuth';
import {createMergeProviderEligibility} from '../mergeProviderEligibility';
import {createReleaseMergeCredentialExposure} from '@/lib/desktop/releaseMergeCredentialExposure';
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
import {createGovernanceMergeRequestAdmissionV2 as createGovernanceMergeRequestAdmission} from '../mergeRequestAdmissionV2';
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
describe.skipIf(!socket)('actual V2 merge admission/exposure stores with SIMULATED GitHub/pairing',()=>{
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
   if(expireFinalSession&&++admissionBoundaries===3)await (tx as any).desktopSessionRecord.update({where:{id:identities.approver.sessionId},data:{expiresAt:new Date(Date.now()+250)}});
   const expiries:number[]=[];for(const actor of [identities.executor,identities.approver]){const rows=await tx.$queryRaw<Array<{id:string;expiresAt:Date;live:boolean}>>`SELECT "id","expiresAt",("revokedAt" IS NULL AND "expiresAt">clock_timestamp()) AS "live" FROM "DesktopSessionRecord" WHERE "id"=${actor.sessionId} AND "organizationId"=${org} AND "userId"=${actor.actorUserId} FOR SHARE`;if(rows.length!==1||!rows[0].live)throw Error('fixture_current_session_required');expiries.push(rows[0].expiresAt.getTime())}
   return()=>{const at=Date.now();if(!Number.isFinite(at)||expiries.some(expiry=>expiry<=at))throw Error('fixture_current_session_expired')};
  },readProviderApproval:approvals.readProviderApproval,consumeProviderApproval:async(tx,s,id,op)=>{await approvals.consumeProviderApproval(tx,s,id,op);if(onConsume)await onConsume(tx)}}),operation=await store.prepare(scope,planRecord.id);
  let eligibilityMode='valid',unknownMint=false,pendingBeforeMint=false,exactProviderExpiry=0;
  let merged=false,afterTarget:(()=>Promise<void>)|undefined;
  const calls:Array<{url:string;method:string;attempt:number}>=[];
  const pr=()=>({number:42,state:merged?'closed':'open',draft:false,merged,merge_commit_sha:merged?'e'.repeat(40):null,head:{sha:plan.pullRequest.headSha,ref:'feature',repo:{full_name:'team/service'}},base:{sha:plan.pullRequest.baseSha,ref:'main',repo:{full_name:'team/service'}}});
  const fetcher=vi.fn(async(url:any,init:any)=>{
   // An independent transaction must acquire both operation and reviewed-plan
   // locks immediately: provider traffic cannot occur under either store lock.
   await db.$transaction(async(tx:any)=>{await tx.$queryRaw`SELECT "id" FROM "DurableAgentWorkflow" WHERE "id" IN (${operation.id},${planRecord.id}) FOR UPDATE NOWAIT`;});
   const row=await db.durableAgentWorkflow.findUnique({where:{id:operation.id}});calls.push({url:String(url),method:init.method,attempt:row.attemptCount});
   if(String(url).endsWith('/installation')||String(url).endsWith('/app/installations/123')){if(eligibilityMode==='missing')return Response.json({},{status:404});return Response.json({id:123,app_id:123,account:{id:456,login:'team',type:'Organization'},suspended_at:eligibilityMode==='revoked'?new Date().toISOString():null,repository_selection:'selected',permissions:{contents:'write',pull_requests:'read',metadata:'read'}})}
   if(init.method==='PUT'){merged=true;return Response.json({sha:'e'.repeat(40),merged:true});}
   if(String(url).endsWith('/access_tokens')){
    expect(row.attemptCount).toBe(1);expect(row.currentStep).toBe('dispatching');
    const exposures=await db.durableAgentWorkflow.findMany({where:{organizationId:org,workflowKind:'release_credential_exposure_v1'}});expect(exposures).toHaveLength(1);expect(exposures[0].currentStep).toBe('pending');pendingBeforeMint=true;
    if(unknownMint)throw Error('SIMULATED lost mint acknowledgement');exactProviderExpiry=Date.now()+3600000;
    return Response.json({token:'FIXTURE_TOKEN',expires_at:new Date(exactProviderExpiry).toISOString(),permissions:{contents:'write',pull_requests:'read',metadata:'read'},repository_selection:'selected',repositories:[{name:'service',full_name:'team/service',owner:{login:'team'}}]},{status:201});
   }
   if(String(url).includes('/compare/'))return Response.json({status:'ahead',ahead_by:1,behind_by:0,total_commits:1,base_commit:{sha:plan.pullRequest.baseSha},merge_base_commit:{sha:plan.pullRequest.baseSha},commits:[{sha:plan.pullRequest.headSha,parents:[{sha:plan.pullRequest.baseSha}]}]});
   if(String(url).includes('/rulesets?')||String(url).includes('/rules/branches/'))return Response.json([]);
   if(String(url).endsWith('/protection'))return Response.json({message:'Not Found'},{status:404});
   if(String(url).includes('/pulls?'))return Response.json([pr()]);
   if(String(url).endsWith('/pulls/42')){if(afterTarget&&row.attemptCount===1){const action=afterTarget;afterTarget=undefined;await action();}return Response.json(pr());}
   return Response.json({id:12,full_name:'team/service',default_branch:'main',archived:false,disabled:false,allow_merge_commit:true,allow_squash_merge:true,allow_rebase_merge:true});
  });
  const adapterCurrent=async(actual:any,s:AbortSignal)=>{s.throwIfAborted();const row=await store.get(scope,operation.id),current=await(row.state==='prepared'?store.validatePrepared(scope,operation.id):store.beforeDispatch(scope,operation.id));if(sha256ContentHash(current)!==sha256ContentHash(actual))throw Error('plan_changed');};
  const rawReadCredential=createReleaseProviderMergeCredentialReader({isEnabled:()=>true,assertCurrent:adapterCurrent,readInstallation:async()=>connection,readAppAuthorization:async b=>({...b,jwt:'fixture.jwt.signature',expiresAt:Date.now()+60000}),fetch:fetcher as typeof fetch});
  const readCredential=createReleaseMergeCredentialExposure(db,scope,operation.id,store,{signal:new AbortController().signal,isEnabled:()=>true,readCredential:rawReadCredential});
  const topology=createReleaseMergeTopologyReader({isEnabled:()=>true,assertCurrent:adapterCurrent,readCredential:async()=>({organizationId:org,connectionId:connection.id,connectionRevision:plan.connectionRevision,repositoryFullName:'team/service',token:'FIXTURE_POLICY_TOKEN',expiresAt:Date.now()+3600000,permissions:{administration:'read',contents:'read',pull_requests:'read',metadata:'read'}}),fetch:fetcher as typeof fetch});
  const readDirectMergeSupport=createReleaseDirectMergeSupportReader({isEnabled:()=>true,assertCurrent:adapterCurrent,readTopologyEvidence:topology,fetch:fetcher as typeof fetch});
  const provider=createMergeProviderPreflight({assertCurrent:adapterCurrent,readCredential,readDirectMergeSupport}),readBinding=createGovernanceMergeBindingReader(db,store,async()=>{}),binding=await readBinding(scope,operation.id,new AbortController().signal);
  let coveredActions=['repository.merge'];
  const service={executionPolicies:policies('executor'),readActiveEvidence:async()=>({baseline:await baselines.readActive(scope,selection),evidence:[evidence],evidenceRefreshes:[],expiresAt:Date.now()+30000,executionAuthorized:false as const}),readScopeEnrollment:async()=>{const pointer=await db.durableAgentWorkflow.findFirst({where:{id:'governance_active_'+sha256ContentHash({organizationId:org,scope:selection})}});return pointer?{enrolled:true as const,baselineDigest:(await baselines.readActiveCandidate(scope,selection)).baseline.digest}:{enrolled:false as const}},readScopeEnrollmentLocked:async(tx:any)=>{await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(org)}))`;const pointer=await tx.durableAgentWorkflow.findFirst({where:{id:'governance_active_'+sha256ContentHash({organizationId:org,scope:selection})}});if(!pointer)return{enrolled:false as const};return{enrolled:true as const,baselineDigest:(await baselines.readActive(scope,selection,tx)).digest,evidenceExpiresAt:Date.now()+30000}},readExecutionCoverage:async()=>({enrolled:true,coveredActions})};
  let finalMutation:(()=>Promise<void>)|undefined,mutationPhase='',outsideLimits=0,enrollmentReads=0;
  const limitsReader=service.executionPolicies.readAuthority;service.executionPolicies.readAuthority=async(...args:Parameters<typeof limitsReader>)=>{const result=await limitsReader(...args);if(!args[3]&&++outsideLimits===6&&mutationPhase==='policy'&&finalMutation){const mutate=finalMutation;finalMutation=undefined;await mutate()}return result};
  const enrollmentReader=service.readScopeEnrollment;service.readScopeEnrollment=async()=>{const result=await enrollmentReader();if(++enrollmentReads===6&&mutationPhase==='enrollment'&&finalMutation){const mutate=finalMutation;finalMutation=undefined;await mutate()}return result};
  const eligibility=createMergeProviderEligibility({assertCurrent:adapterCurrent,
   // Fixed read-only policy token fixture; the actual policy/topology readers issue opaque provenance.
   readPolicyCredential:async()=>({organizationId:org,connectionId:connection.id,connectionRevision:plan.connectionRevision,repositoryFullName:'team/service',installationId:'123',token:'SIMULATED_READ_ONLY_POLICY_TOKEN',expiresAt:Date.now()+3600000,contentsRead:true,pullRequestsRead:true}),
   readEligibility:(p,c,s)=>readReleaseInstallationEligibility({organizationId:org,connectionId:p.connectionId,connectionRevision:p.connectionRevision,installationId:c.installationId,repositoryFullName:p.pullRequest.repositoryFullName,purpose:'merge',planDigest:sha256ContentHash(p),isEnabled:()=>true,assertCurrent:()=>adapterCurrent(p,s),fetch:fetcher as typeof fetch},s),readDirectMergeSupport,
  });
  const guard=createGovernanceMergeRequestAdmission(scope,operation.id,binding,db,store,approvals,service,provider,eligibility);
  const finalGuard=guard.assertFinal;guard.assertFinal=async(...args)=>{const fresh=await finalGuard(...args);if(expireFinalSession&&admissionBoundaries===3)delayFinalClock=true;return fresh};
  const run=(parent?:AbortSignal)=>createGovernedProviderMergeExecutor(store,{guard,readBinding,transport:{isEnabled:()=>true,assertCurrent:async(_id,p,s)=>{const current=await store.beforeDispatch(scope,operation.id);s.throwIfAborted();if(sha256ContentHash(current)!==sha256ContentHash(p))throw Error('plan_changed');},readCredential,readDirectMergeSupport,fetch:fetcher as typeof fetch}}).run(scope,operation.id,parent);
  async function claim(){const receipt=await guard.assert(binding.context,'before_claim',undefined,new AbortController().signal);return store.claimWithAdmission(scope,operation.id,(tx,p)=>guard.assertClaim(tx,p,receipt))}
  return{calls,store,scope,operation,run,plan,guard,claim,readCredential,
   setEligibility:(mode:string)=>{eligibilityMode=mode},setUnknownMint:()=>{unknownMint=true},
   evidence:()=>({pendingBeforeMint,exactProviderExpiry}),
   delayClaimReturn(){const original=store.claimWithAdmission.bind(store);store.claimWithAdmission=async(...args)=>{afterTransactionReturn=async()=>{await locker.$transaction(async(tx:any)=>{await tx.$queryRaw`SELECT "id" FROM "DurableAgentWorkflow" WHERE "id"=${operation.id} FOR UPDATE NOWAIT`});await locker.$queryRaw`SELECT true FROM pg_sleep(5.1)`};return original(...args)}},
   rows:()=>db.durableAgentWorkflow.findMany({where:{organizationId:org,workflowKind:'release_credential_exposure_v1'}}),
   saved:()=>db.durableAgentWorkflow.findUnique({where:{id:operation.id}}),
   approval:()=>db.durableAgentWorkflow.findFirst({where:{organizationId:org,workflowKind:'release_provider_merge_approval_v1'}}),
  };
 }
 const writes=(f:any)=>f.calls.filter((c:any)=>c.url.endsWith('/access_tokens'));
 it('actual opaque eligibility and atomic claim consume one approval without requesting any write credential',async()=>{const f=await fixture();expect(await f.claim()).toMatchObject({claimed:true});expect(writes(f)).toHaveLength(0);expect(await f.rows()).toEqual([]);expect(await f.saved()).toMatchObject({attemptCount:1,currentStep:'dispatching'});expect(await f.approval()).toMatchObject({currentStep:'consumed'})});
 it.each(['missing','revoked'])('unavailable %s metadata cannot claim, mint or consume approval',async mode=>{const f=await fixture();f.setEligibility(mode);await expect(f.run()).rejects.toThrow();expect(writes(f)).toHaveLength(0);expect(await f.rows()).toEqual([]);expect(await f.saved()).toMatchObject({attemptCount:0,currentStep:'prepared'});expect(await f.approval()).toMatchObject({currentStep:'approved'})});
 it('actual post-COMMIT5.1s eligibility expiry preserves consumed claim without mint or PUT',async()=>{const f=await fixture();f.delayClaimReturn();await expect(f.run()).rejects.toThrow();expect(writes(f)).toHaveLength(0);expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(0);expect(await f.saved()).toMatchObject({attemptCount:1,currentStep:'dispatching'});expect(await f.approval()).toMatchObject({currentStep:'consumed'})},20000);
 it('actual claimed authority refuses preclaim issuer access without even reserving an exposure',async()=>{const f=await fixture();await expect(db.$transaction((tx:any)=>f.store.assertClaimedCredentialAuthority(tx,f.scope,f.operation.id,f.plan))).rejects.toThrow();expect(await f.readCredential(f.plan,new AbortController().signal)).toBeNull();expect(writes(f)).toHaveLength(0);expect(await f.rows()).toEqual([]);expect(await f.saved()).toMatchObject({attemptCount:0})});
 it('lost actual mint reply leaves one pending exposure and is never reminted in the request',async()=>{const f=await fixture();await f.claim();f.setUnknownMint();expect(await f.readCredential(f.plan,new AbortController().signal)).toBeNull();expect(await f.readCredential(f.plan,new AbortController().signal)).toBeNull();expect(writes(f)).toHaveLength(1);expect(f.evidence().pendingBeforeMint).toBe(true);expect(await f.rows()).toMatchObject([{currentStep:'pending',version:0}]);expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(0)});
 it('actual V2 exact merge issues only after claim, records real provider expiry, performs one PUT and never resends',async()=>{const f=await fixture();expect(await f.run()).toMatchObject({state:'confirmed'});expect(writes(f)).toHaveLength(1);expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(1);expect(f.evidence().pendingBeforeMint).toBe(true);const rows=await f.rows();expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({currentStep:'issued',version:1});expect(rows[0].stateJson.providerExpiresAt).toBe(f.evidence().exactProviderExpiry);expect(JSON.stringify(rows)).not.toContain('FIXTURE_TOKEN');// This core guard refuses terminal binding re-entry; mounted coordinator owns history projection.
  await expect(f.run()).rejects.toThrow('governance_merge_binding_unavailable');expect(writes(f)).toHaveLength(1);expect(f.calls.filter(c=>c.method==='PUT')).toHaveLength(1)});
});
