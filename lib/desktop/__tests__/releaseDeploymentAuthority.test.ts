import {it,expect,vi,beforeEach} from 'vitest';
const resolve=vi.hoisted(()=>vi.fn());
vi.mock('server-only',()=>({}));
vi.mock('../resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:resolve}));
import {createReleaseDeploymentAuthority} from '../releaseDeploymentAuthority';
const scope={organizationId:'org',actorUserId:'executor',sessionId:'session'};
const identity={credentialKind:'desktop_session',id:'session',userId:'executor',organizationId:'org',capabilities:['deploy:execute','github:read']};
function setup(){const query=vi.fn(async(q:TemplateStringsArray)=>q.join('').includes('OrgMembership')?[{organizationId:'org',userId:'executor',role:'owner',acceptedAt:new Date()}]:[{id:'session',organizationId:'org',userId:'executor',live:true}]);const tx:any={$queryRaw:query};const request:any={signal:new AbortController().signal};return{query,tx,authority:createReleaseDeploymentAuthority(request,{isEnabled:()=>true})}}
beforeEach(()=>{resolve.mockReset();resolve.mockResolvedValue(identity)});
it('checks the real caller session without writing a heartbeat under row locks',async()=>{const f=setup();await f.authority.assertCurrent(f.tx,scope,undefined);expect(resolve).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({recordHeartbeat:false,requireWorkspaceMembership:true,allowApiKey:false,requiredCapability:'deploy:execute'}));expect(f.query).toHaveBeenCalledTimes(2)});
it('defaults to unavailable before resolving any identity',async()=>{await expect(createReleaseDeploymentAuthority({signal:new AbortController().signal} as any).assertCurrent({} as any,scope,undefined)).rejects.toThrow();expect(resolve).not.toHaveBeenCalled()});
it.each([{...identity,userId:'other'},{...identity,id:'other'},{...identity,organizationId:'other'},{...identity,credentialKind:'api_key'},{...identity,capabilities:['github:read']}])('rejects changed request authority %#',async value=>{resolve.mockResolvedValue(value);const f=setup();await expect(f.authority.assertCurrent(f.tx,scope,undefined)).rejects.toThrow();expect(f.query).not.toHaveBeenCalled()});
it('rejects a revoked session read from the database',async()=>{const f=setup();f.query.mockResolvedValueOnce([{organizationId:'org',userId:'executor',role:'owner',acceptedAt:new Date()}] as any).mockResolvedValueOnce([{id:'session',organizationId:'org',userId:'executor',live:false}] as any);await expect(f.authority.assertCurrent(f.tx,scope,undefined)).rejects.toThrow()});
it('rejects membership removal despite a previously valid resolved session',async()=>{const f=setup();f.query.mockResolvedValueOnce([]);await expect(f.authority.assertCurrent(f.tx,scope,undefined)).rejects.toThrow()});

import {completeReleaseIntake} from '@/lib/tauri/__tests__/fixtures/completeReleaseIntake';
import {buildReleaseMergePlan} from '@/lib/tauri/releaseMergePlan';
import {releaseOperationPlanId} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
function fullFixture(){
 const intake={...completeReleaseIntake(),tenantId:'org',repositoryUrls:['https://github.com/team/service'],productionPrUrls:['https://github.com/team/service/pull/42'],sourceBranch:'release/demo',targetBranch:'main',workflowSource:{repositoryFullName:'team/service',ref:'axiom-release-test',path:'.github/workflows/deploy.yml',blobSha:'c'.repeat(40)}};
 const release={id:intake.id,organizationId:'org',requesterUserId:'requester',version:3,status:'submitted',intakeJson:intake};
 const revision='2026-10-09T00:00:00.000Z',digest=sha256ContentHash({requestVersion:3,intake});
 const built=buildReleaseMergePlan(release,{organizationId:'org',requestId:release.id,expectedVersion:3,expectedDigest:digest,method:'squash',observation:{connectionId:'connection',connectionRevision:revision,repositoryFullName:'team/service',number:42,headRepositoryFullName:'team/service',headRef:'release/demo',headSha:'a'.repeat(40),baseRef:'main',baseSha:'b'.repeat(40),state:'open',draft:false,merged:false}});if(!built.ok)throw Error('invalid fixture');
 const id=releaseOperationPlanId('org',release.id,3,built.digest),createdAt=new Date('2026-10-09T12:00:00.000Z');
 const parent={id,organizationId:'org',workflowKind:'release_operation_plan_v1',version:1,currentStep:'reviewed',status:'completed',requestedByUserId:'creator',attemptCount:0,maxAttempts:1,leaseOwner:null,leaseExpiresAt:null,approvalProposalId:null,createdAt,inputJson:{format:1,plan:built.plan,planDigest:built.digest,releaseRequesterUserId:'requester',createdAt:createdAt.toISOString(),deadlineAt:intake.windowEndUtc},stateJson:{reviewStatus:'reviewed'}};
 const connection={id:'connection',organizationId:'org',status:'active',githubInstallationId:'123',updatedAt:new Date(revision),revokedAt:null,suspendedAt:null};
 const history=[{workflowRunId:id,organizationId:'org',sequence:0,actorKind:'user',actorId:'creator',eventType:'release_plan.created',occurredAt:createdAt,detailJson:{planDigest:built.digest}},{workflowRunId:id,organizationId:'org',sequence:1,actorKind:'user',actorId:'reviewer',eventType:'release_plan.reviewed',occurredAt:createdAt,detailJson:{actionId:'11111111-1111-4111-8111-111111111111',expectedVersion:0,requestedDecision:'reviewed'}}];
 const plan:any={purpose:'release_deployment',organizationId:'org',releaseId:release.id,releaseVersion:3,intakeDigest:digest,planId:id,creatorUserId:'creator',requesterUserId:'requester',executorUserId:'executor',repositoryFullName:'team/service',connectionId:'connection',connectionRevision:revision,installationId:'123',workflowPath:intake.workflowSource.path,workflowBlobSha:intake.workflowSource.blobSha,sourceCommitSha:'d'.repeat(40),refKind:'tag',ref:intake.workflowSource.ref,inputs:intake.workflowInputs,sourcePolicy:'github_protected_tag_v1',windowStart:intake.windowStartUtc,expiresAt:intake.windowEndUtc};
 const tx:any={$queryRaw:vi.fn(async(q:TemplateStringsArray,...v:any[])=>{const sql=q.join('');if(sql.includes('OrgMembership'))return[{organizationId:'org',userId:v[1],role:'owner',acceptedAt:createdAt}];if(sql.includes('DesktopSessionRecord'))return[{id:v[0],organizationId:'org',userId:v[2],live:true}];if(sql.includes('TauriDeploymentRequest'))return[release];if(sql.includes('DurableAgentWorkflow'))return[parent];if(sql.includes('GitHubInstallation'))return[connection];throw Error('unexpected SQL')}),durableAgentWorkflowEvent:{findMany:vi.fn(async()=>history)}};
 return{release,parent,connection,history,plan,tx,authority:createReleaseDeploymentAuthority({signal:new AbortController().signal} as any,{isEnabled:()=>true})};
}
it('reconstructs a deployment binding from the real intake and reviewed parent contract',async()=>{const f=fullFixture();expect(await f.authority.readCurrentPlan(f.tx,scope,f.plan)).toEqual(f.plan)});
it.each(['release','connection','workflow','reviewer'])('refuses changed %s during full parent reconstruction',async kind=>{const f=fullFixture();if(kind==='release')f.release.version++;if(kind==='connection')f.connection.status='revoked';if(kind==='workflow')f.plan.workflowBlobSha='e'.repeat(40);if(kind==='reviewer')f.history[1].actorId='requester';await expect(f.authority.readCurrentPlan(f.tx,scope,f.plan)).rejects.toThrow()});
it('refuses a fabricated parent review event without a valid reviewed action',async()=>{const f=fullFixture();f.history[1].detailJson={} as any;await expect(f.authority.readCurrentPlan(f.tx,scope,f.plan)).rejects.toThrow()});

it('allows an existing security reviewer only in the explicit approval composition',async()=>{
 const reviewer={...scope,actorUserId:'reviewer'};resolve.mockResolvedValue({...identity,userId:'reviewer',capabilities:['github:read','agent:approve']});
 const tx:any={$queryRaw:vi.fn(async(q:TemplateStringsArray)=>q.join('').includes('OrgMembership')?[{organizationId:'org',userId:'reviewer',role:'security_reviewer',acceptedAt:new Date()}]:[{id:'session',organizationId:'org',userId:'reviewer',live:true}])};
 const request:any={signal:new AbortController().signal};
 await createReleaseDeploymentAuthority(request,{isEnabled:()=>true,actorPurpose:'approver'}).assertCurrent(tx,reviewer,undefined);
 expect(resolve).toHaveBeenCalledWith(request,expect.objectContaining({requiredScope:'pipeline:read',requiredCapability:'agent:approve'}));
 await expect(createReleaseDeploymentAuthority(request,{isEnabled:()=>true}).assertCurrent(tx,reviewer,undefined)).rejects.toThrow();
});
it('refuses an operator as reviewer despite an injected approval capability',async()=>{
 resolve.mockResolvedValue({...identity,capabilities:['github:read','agent:approve','deploy:execute']});
 const f=setup();f.query.mockResolvedValueOnce([{organizationId:'org',userId:'executor',role:'operator',acceptedAt:new Date()}] as any);
 const authority=createReleaseDeploymentAuthority({signal:new AbortController().signal} as any,{isEnabled:()=>true,actorPurpose:'approver'});
 await expect(authority.assertCurrent(f.tx,scope,undefined)).rejects.toThrow();
});
it('keeps the executor separate from the current security-reviewer history authority',async()=>{
 const f=fullFixture(),original=f.tx.$queryRaw.getMockImplementation();
 f.tx.$queryRaw.mockImplementation(async(q:TemplateStringsArray,...v:any[])=>{
  if(q.join('').includes('OrgMembership'))return[{organizationId:'org',userId:v[1],role:v[1]==='reviewer'?'security_reviewer':v[1]==='executor'?'operator':'owner',acceptedAt:new Date()}];
  return original(q,...v);
 });
 await expect(f.authority.readCurrentPlan(f.tx,scope,f.plan)).resolves.toEqual(f.plan);
 f.tx.$queryRaw.mockImplementation(async(q:TemplateStringsArray,...v:any[])=>q.join('').includes('OrgMembership')?[{organizationId:'org',userId:v[1],role:v[1]==='reviewer'?'operator':'owner',acceptedAt:new Date()}]:original(q,...v));
 await expect(f.authority.readCurrentPlan(f.tx,scope,f.plan)).rejects.toThrow();
});
it('reuses only locked read-only plan reconstruction within one transaction and rechecks live authority',async()=>{
 const f=fullFixture(),authority=createReleaseDeploymentAuthority({signal:new AbortController().signal} as any,{isEnabled:()=>true,memoizeReadOnlyTransactionPlans:true});
 await authority.readCurrentPlan(f.tx,scope,f.plan);const reads=()=>f.tx.$queryRaw.mock.calls.filter(([q]:[TemplateStringsArray])=>q.join('').includes('TauriDeploymentRequest')).length;expect(reads()).toBe(1);const principals=resolve.mock.calls.length;await authority.readCurrentPlan(f.tx,scope,f.plan);expect(reads()).toBe(1);expect(resolve.mock.calls.length).toBeGreaterThan(principals);
 f.release.version++;await expect(authority.readCurrentPlan({...f.tx},scope,f.plan)).rejects.toThrow();
 resolve.mockResolvedValue({...identity,id:'revoked'});await expect(authority.readCurrentPlan(f.tx,scope,f.plan)).rejects.toThrow();
});
it('retains actual original executor and reviewer session expiry after all later awaits',async()=>{
 const f=fullFixture(),expiresAt=Date.now()+60000,original=f.tx.$queryRaw.getMockImplementation();
 f.tx.$queryRaw.mockImplementation(async(q:TemplateStringsArray,...v:any[])=>{const rows=await original(q,...v);return q.join('').includes('DesktopSessionRecord')?rows.map((row:any)=>({...row,expiresAt:new Date(expiresAt)})):rows});
 const approval:any={kind:'verified_release_deployment_approval_v1',purpose:'release_deployment',id:'approval',organizationId:'org',planDigest:sha256ContentHash(f.plan),executorUserId:'executor',approverUserId:'reviewer',approverSessionId:'reviewer-session',sourcePolicy:f.plan.sourcePolicy,expiresAt:f.plan.expiresAt};
 const fresh=await f.authority.assertCurrentForAdmission(f.tx,scope,f.plan,approval),clock=vi.spyOn(Date,'now').mockReturnValue(expiresAt+1);
 try{expect(()=>fresh()).toThrow('release_deployment_authority_unavailable')}finally{clock.mockRestore()}
});
