import {it,expect,vi,afterEach} from 'vitest';
import {DesktopClient} from '../../../desktop/src/lib/desktopClient';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
const plan:any={purpose:'release_deployment',organizationId:'org',releaseId:'release',releaseVersion:1,intakeDigest:'a'.repeat(64),planId:'release_plan_'+'b'.repeat(64),creatorUserId:'creator',requesterUserId:'requester',executorUserId:'executor',repositoryFullName:'owner/fixture',connectionId:'connection',connectionRevision:'2026-10-28T21:00:00.000Z',installationId:'123',workflowPath:'.github/workflows/deploy.yml',workflowBlobSha:'b'.repeat(40),sourceCommitSha:'a'.repeat(40),refKind:'tag',ref:'axiom-release-fixture',inputs:{},sourcePolicy:'github_protected_tag_v1',windowStart:'2026-10-28T21:59:00.000Z',expiresAt:'2026-10-28T22:20:00.000Z'};
const approval={kind:'verified_release_deployment_approval_v1',purpose:'release_deployment',id:'approval',organizationId:'org',planDigest:sha256ContentHash(plan),executorUserId:'executor',approverUserId:'reviewer',approverSessionId:'review-session',sourcePolicy:plan.sourcePolicy,expiresAt:plan.expiresAt};
const nonce='00000000-0000-4000-8000-000000000001',client=()=>new DesktopClient({apiBase:'https://owned.test',sessionToken:'axm.desk.synthetic'});
afterEach(()=>vi.unstubAllGlobals());
it('submits one exact reviewed action and validates the server digest',async()=>{const f=vi.fn(async(_url:RequestInfo|URL,_init?:RequestInit)=>Response.json({ok:true,data:{approval,executionAvailable:false}}));vi.stubGlobal('fetch',f);expect((await client().approveDeploymentAction('release',plan.planId,plan,nonce,true)).ok).toBe(true);expect(f).toHaveBeenCalledTimes(1);expect(f.mock.calls[0][0]).toContain('/deployment-approval')});
it.each([{planDigest:'f'.repeat(64)},{executorUserId:'other'},{approverUserId:'requester'},{sourcePolicy:'other'}])('rejects substituted approval %#',async patch=>{const f=vi.fn(async(_url:RequestInfo|URL,_init?:RequestInit)=>Response.json({ok:true,data:{approval:{...approval,...patch},executionAvailable:false}}));vi.stubGlobal('fetch',f);expect((await client().approveDeploymentAction('release',plan.planId,plan,nonce,true)).ok).toBe(false);expect(f).toHaveBeenCalledTimes(1)});
it('rejects unreviewed actions and route mismatch before sending',async()=>{const f=vi.fn();vi.stubGlobal('fetch',f);await client().approveDeploymentAction('other',plan.planId,plan,nonce,true);await client().approveDeploymentAction('release',plan.planId,plan,nonce,false as true);expect(f).not.toHaveBeenCalled()});

it('reads a fixed server proposal without a client-supplied source or mutation',async()=>{const f=vi.fn(async(_url:RequestInfo|URL,_init?:RequestInit)=>Response.json({ok:true,data:{plan,planDigest:sha256ContentHash(plan),canApprove:true,executionAvailable:false}}));vi.stubGlobal('fetch',f);expect((await client().deploymentApprovalPreview('release',plan.planId)).ok).toBe(true);expect(f).toHaveBeenCalledTimes(1);expect(f.mock.calls[0][0]).toContain('/deployment-approval');});

it('binds the exact displayed baseline to one approval submission',async()=>{
 const baseline='d'.repeat(64),f=vi.fn(async(_url:RequestInfo|URL,_init?:RequestInit)=>Response.json({ok:true,data:{approval:{...approval,governanceBaselineDigest:baseline},executionAvailable:false}}));vi.stubGlobal('fetch',f);
 expect((await client().approveDeploymentAction('release',plan.planId,plan,nonce,true,undefined,baseline)).ok).toBe(true);
 expect(JSON.parse(f.mock.calls[0][1]!.body as string).governanceBaselineDigest).toBe(baseline);
});
it.each([[undefined,'d'.repeat(64)],['d'.repeat(64),undefined],['d'.repeat(64),'e'.repeat(64)]])('refuses baseline substitution submitted=%s returned=%s',async(submitted,returned)=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({ok:true,data:{approval:{...approval,...(returned?{governanceBaselineDigest:returned}:{})},executionAvailable:false}})));
 expect((await client().approveDeploymentAction('release',plan.planId,plan,nonce,true,undefined,submitted)).ok).toBe(false);
});
it('refuses malformed baseline before sending',async()=>{const f=vi.fn();vi.stubGlobal('fetch',f);expect((await client().approveDeploymentAction('release',plan.planId,plan,nonce,true,undefined,'D'.repeat(64))).ok).toBe(false);expect(f).not.toHaveBeenCalled()});
it('reads the exact optional preview baseline without exposing extra authority',async()=>{
 const baseline='d'.repeat(64);vi.stubGlobal('fetch',vi.fn(async()=>Response.json({ok:true,data:{plan,planDigest:sha256ContentHash(plan),canApprove:true,executionAvailable:false,governanceBaselineDigest:baseline}})));
 const r=await client().deploymentApprovalPreview('release',plan.planId);expect(r.ok&&r.data.governanceBaselineDigest).toBe(baseline);
});
it.each([{governanceBaselineDigest:'D'.repeat(64)},{planDigest:'f'.repeat(64)},{executionAvailable:true},{privateAuthority:'secret'}])('rejects malformed or substituted preview %#',async patch=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({ok:true,data:{plan,planDigest:sha256ContentHash(plan),canApprove:true,executionAvailable:false,...patch}})));
 expect((await client().deploymentApprovalPreview('release',plan.planId)).ok).toBe(false);
});
