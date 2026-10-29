import {beforeEach,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({authority:{assertCurrent:vi.fn(),readCurrentPlan:vi.fn()},approval:{readIndependentApproval:vi.fn(),consumeIndependentApproval:vi.fn(),issue:vi.fn(),revoke:vi.fn()},policy:vi.fn(),token:vi.fn(),tag:vi.fn(),workflow:vi.fn(),boundaries:[] as any[]}));
vi.mock('server-only',()=>({}));
vi.mock('../releaseDeploymentAuthority',()=>({createReleaseDeploymentAuthority:()=>mocks.authority}));
vi.mock('@/lib/tauri/releaseDeploymentApprovalStore',()=>({RELEASE_DEPLOYMENT_APPROVAL_KIND:'release_deployment_approval_v1',createReleaseDeploymentApprovalStore:()=>mocks.approval}));
vi.mock('@/lib/tauri/releaseProtectedTagPolicy',()=>({PROTECTED_TAG_POLICY:'github_protected_tag_v1',createProtectedTagPolicyReader:(deps:any)=>{mocks.boundaries.push(deps);return mocks.policy}}));
vi.mock('@/lib/tauri/releaseDeploymentGithubReaders',()=>({createReleaseDeploymentGithubReaders:(deps:any)=>{mocks.boundaries.push(deps);return{readSourceTag:mocks.tag,readWorkflowContract:mocks.workflow,verifyRunReceipt:vi.fn()}} }));
vi.mock('@/lib/tauri/releaseDeploymentTransportGithub',()=>({createReleaseDeploymentGithubTransport:(deps:any)=>{mocks.boundaries.push(deps);return{}}}));
vi.mock('@/lib/connectors/github/githubAppAuth',()=>({resolveReleaseInstallationToken:mocks.token}));
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {createReleaseDeploymentServices} from '../releaseDeploymentServices';
const scope={organizationId:'org',actorUserId:'executor',sessionId:'session'};
function setup(enabled?:()=>boolean){const findMany=vi.fn(async()=>[]);const tx={durableAgentWorkflow:{findMany}};const repo:any={$transaction:async(fn:any)=>fn(tx)};const request:any={signal:new AbortController().signal};return{service:createReleaseDeploymentServices(request,repo,scope,{isEnabled:enabled}),request,findMany}}
beforeEach(()=>{vi.clearAllMocks();mocks.boundaries.length=0});
it('is unavailable by default without resolving a credential or reading a plan',async()=>{const f=setup();expect(f.service.ports.enabled?.()).toBe(false);await expect(f.service.ports.readPlan!(scope,{} as any,f.request.signal)).rejects.toThrow();expect(f.findMany).not.toHaveBeenCalled();expect(mocks.token).not.toHaveBeenCalled()});
it('rejects a substituted executor session before reading stored approvals',async()=>{const f=setup(()=>true);await expect(f.service.ports.readPlan!({...scope,sessionId:'other'},{} as any,f.request.signal)).rejects.toThrow('identity_changed');expect(f.findMany).not.toHaveBeenCalled()});
it('becomes unavailable when the originating request is aborted',()=>{const f=setup(()=>true);expect(f.service.ports.enabled?.()).toBe(true);Object.defineProperty(f.request,'signal',{value:AbortSignal.abort()});expect(f.service.ports.enabled?.()).toBe(false)});
it('does not turn activation into an independent approval or credential grant',()=>{const f=setup(()=>true);expect(f.service.ports.dependencies?.consumeIndependentApproval).toBe(mocks.approval.consumeIndependentApproval);expect(mocks.approval.issue).not.toHaveBeenCalled();expect(mocks.token).not.toHaveBeenCalled()});

it('wires the server fetch boundary when no custom transport is supplied',()=>{setup(()=>true);expect(mocks.boundaries).toHaveLength(3);for(const boundary of mocks.boundaries)expect(boundary.fetch).toBe(globalThis.fetch);expect(mocks.token).not.toHaveBeenCalled()});

import {completeReleaseIntake} from '@/lib/tauri/__tests__/fixtures/completeReleaseIntake';
function previewFixture(){
 const intake={...completeReleaseIntake(),workflowSource:{repositoryFullName:'owner/fixture',ref:'axiom-release-test',path:'.github/workflows/deploy.yml',blobSha:'c'.repeat(40)}};
 const merge={kind:'merge_pull_request',organizationId:'org',requestId:'release',requestVersion:1,intakeDigest:'a'.repeat(64),connectionId:'connection',connectionRevision:'2026-10-09T00:00:00.000Z',window:{startUtc:intake.windowStartUtc,endUtc:intake.windowEndUtc},method:'squash',pullRequest:{repositoryFullName:'owner/fixture',number:42,url:'https://github.com/owner/fixture/pull/42',headRef:'feature',headSha:'a'.repeat(40),baseRef:'main',baseSha:'b'.repeat(40)}};
 const parent={requestedByUserId:'creator',inputJson:{format:1,plan:merge,planDigest:'a'.repeat(64),releaseRequesterUserId:'requester',createdAt:'2026-10-09T00:00:00.000Z',deadlineAt:intake.windowEndUtc}};
 const tx:any={durableAgentWorkflow:{findFirst:vi.fn(async()=>parent)},$queryRaw:vi.fn(async(q:TemplateStringsArray)=>q.join('').includes('TauriDeploymentRequest')?[{id:'release',requesterUserId:'requester',intakeJson:intake}]:[{githubInstallationId:'123'}])};
 const repo:any={$transaction:async(fn:any)=>fn(tx)};
 mocks.tag.mockResolvedValue('d'.repeat(40));mocks.policy.mockImplementation(async(p:any)=>({proof:{kind:'verified_release_deployment_source_policy_v1',planDigest:sha256ContentHash(p),sourcePolicy:p.sourcePolicy},evidence:{expiresAt:new Date(Date.now()+10000).toISOString()}}));mocks.workflow.mockResolvedValue({dispatchSupported:true});
 return createReleaseDeploymentServices({signal:new AbortController().signal} as any,repo,{...scope,actorUserId:'reviewer'},{isEnabled:()=>true});
}
it('builds the exact human review from server rows and the fixed provider tag, not caller fields',async()=>{const service=previewFixture(),result=await service.previewIndependentApproval('release_plan_'+'b'.repeat(64));expect(result.plan).toMatchObject({creatorUserId:'creator',requesterUserId:'requester',executorUserId:'requester',sourceCommitSha:'d'.repeat(40),repositoryFullName:'owner/fixture'});expect(result.canApprove).toBe(true);expect(mocks.policy).toHaveBeenCalledWith(expect.objectContaining({sourceCommitSha:'d'.repeat(40)}),expect.any(AbortSignal));expect(mocks.workflow).toHaveBeenCalled();expect(mocks.approval.issue).not.toHaveBeenCalled()});
it('refuses a proposal without verified source policy before showing a workflow approval',async()=>{const service=previewFixture();mocks.policy.mockResolvedValue(null);await expect(service.previewIndependentApproval('release_plan_'+'b'.repeat(64))).rejects.toMatchObject({code:'release_review_policy_unavailable'});expect(mocks.workflow).not.toHaveBeenCalled();expect(mocks.approval.issue).not.toHaveBeenCalled()});

it('requires provider preflight outside locked transactions, then checks only the bound fresh proof inside',async()=>{
 const service=previewFixture(),plan:any={purpose:'release_deployment',organizationId:'org',releaseId:'release',releaseVersion:1,intakeDigest:'a'.repeat(64),planId:'release_plan_'+'b'.repeat(64),creatorUserId:'creator',requesterUserId:'requester',executorUserId:'executor',repositoryFullName:'owner/fixture',connectionId:'connection',connectionRevision:'2026-10-09T00:00:00.000Z',installationId:'123',workflowPath:'.github/workflows/deploy.yml',workflowBlobSha:'c'.repeat(40),sourceCommitSha:'d'.repeat(40),refKind:'tag',ref:'axiom-release-test',inputs:{},sourcePolicy:'github_protected_tag_v1',windowStart:'2030-01-01T00:00:00Z',expiresAt:'2030-01-01T01:00:00Z'};
 mocks.policy.mockResolvedValue({proof:{kind:'verified_release_deployment_source_policy_v1',planDigest:sha256ContentHash(plan),sourcePolicy:plan.sourcePolicy},evidence:{expiresAt:new Date(Date.now()+10000).toISOString()}});
 await expect(service.ports.dependencies!.verifySupportedSourcePolicy!({} as any,scope,plan)).rejects.toThrow('preflight');
 await service.ports.preflight!(plan,new AbortController().signal);mocks.policy.mockClear();expect(await service.ports.dependencies!.verifySupportedSourcePolicy!({} as any,scope,plan)).toMatchObject({planDigest:sha256ContentHash(plan)});expect(mocks.policy).not.toHaveBeenCalled();
});
it('makes the explicit approval composition incapable of dispatch or executor plan selection',async()=>{
 const findMany=vi.fn(),repo:any={$transaction:vi.fn()},request:any={signal:new AbortController().signal};
 const service=createReleaseDeploymentServices(request,repo,{...scope,actorUserId:'reviewer'},{isEnabled:()=>true,actorPurpose:'approver'});
 expect(mocks.boundaries[0].isEnabled()).toBe(true);
 expect(mocks.boundaries[1].isEnabled()).toBe(true);
 expect(mocks.boundaries[2].isEnabled()).toBe(false);
 await expect(service.ports.readPlan!({...scope,actorUserId:'reviewer'},{} as any,request.signal)).rejects.toThrow('identity_changed');
 expect(repo.$transaction).not.toHaveBeenCalled();expect(findMany).not.toHaveBeenCalled();expect(mocks.token).not.toHaveBeenCalled();
});
it('observation-only composition exposes no dispatch, plan preparation or approval mutation',async()=>{
 const request:any={signal:new AbortController().signal},repo:any={$transaction:vi.fn()},service=createReleaseDeploymentServices(request,repo,scope,{isEnabled:()=>true,observationOnly:true});
 expect(service.ports.transport).toBeUndefined();expect(mocks.boundaries[2].isEnabled()).toBe(false);
 await expect(service.ports.readPlan!(scope,{} as any,request.signal)).rejects.toThrow();await expect(service.previewIndependentApproval('release_plan_'+'a'.repeat(64))).rejects.toThrow();await expect(service.issueIndependentApproval({} as any,'unused')).rejects.toThrow();await expect(service.revokeIndependentApproval('unused',0)).rejects.toThrow();expect(repo.$transaction).not.toHaveBeenCalled();expect(mocks.approval.issue).not.toHaveBeenCalled();expect(mocks.approval.revoke).not.toHaveBeenCalled();
});
it('keeps observation proof lookup free of duplicate authority reads while execution retains them',async()=>{
 const plan:any={purpose:'release_deployment',organizationId:'org',releaseId:'release',releaseVersion:1,intakeDigest:'a'.repeat(64),planId:'release_plan_'+'b'.repeat(64),creatorUserId:'creator',requesterUserId:'requester',executorUserId:'executor',repositoryFullName:'owner/fixture',connectionId:'connection',connectionRevision:'2026-10-09T00:00:00.000Z',installationId:'123',workflowPath:'.github/workflows/deploy.yml',workflowBlobSha:'c'.repeat(40),sourceCommitSha:'d'.repeat(40),refKind:'tag',ref:'axiom-release-test',inputs:{},sourcePolicy:'github_protected_tag_v1',windowStart:'2030-01-01T00:00:00Z',expiresAt:'2030-01-01T01:00:00Z'};
 mocks.policy.mockResolvedValue({proof:{kind:'verified_release_deployment_source_policy_v1',planDigest:sha256ContentHash(plan),sourcePolicy:plan.sourcePolicy},evidence:{expiresAt:new Date(Date.now()+10000).toISOString()}});
 const request:any={signal:new AbortController().signal},repo:any={$transaction:async(fn:any)=>fn({})};
 for(const observationOnly of [true,false]){const service=createReleaseDeploymentServices(request,repo,scope,{isEnabled:()=>true,observationOnly});await service.ports.preflight!(plan,request.signal);mocks.authority.assertCurrent.mockClear();mocks.authority.readCurrentPlan.mockClear();expect(await service.ports.dependencies!.verifySupportedSourcePolicy!({} as any,scope,plan)).toMatchObject({planDigest:sha256ContentHash(plan)});expect(mocks.authority.assertCurrent).toHaveBeenCalledTimes(observationOnly?0:1);expect(mocks.authority.readCurrentPlan).toHaveBeenCalledTimes(observationOnly?0:1);await expect(service.ports.dependencies!.verifySupportedSourcePolicy!({} as any,scope,{...plan,sourceCommitSha:'e'.repeat(40)})).rejects.toThrow('preflight')}
});
