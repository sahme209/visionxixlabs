import {it,expect,vi,beforeEach} from 'vitest';import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({auth:vi.fn(),issue:vi.fn(),enabled:vi.fn(()=>false),preview:vi.fn()}));
vi.mock('server-only',()=>({}));vi.mock('@/lib/db',()=>({prisma:{}}));vi.mock('@/lib/api/rateLimiter',()=>({consumeToken:()=>({allowed:true})}));vi.mock('../resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:m.auth}));vi.mock('../releaseDeploymentServices',()=>({createReleaseDeploymentServices:()=>({ports:{enabled:m.enabled},issueIndependentApproval:m.issue,previewIndependentApproval:m.preview})}));
import {handleReleaseDeploymentApproval as handle} from '../releaseDeploymentApprovalHttp';
const planId='release_plan_'+'b'.repeat(64),actor={organizationId:'org',userId:'reviewer',id:'review-session',credentialKind:'desktop_session',capabilities:['agent:approve','github:read']};
const plan={purpose:'release_deployment',organizationId:'org',releaseId:'release',releaseVersion:1,intakeDigest:'a'.repeat(64),planId,creatorUserId:'creator',requesterUserId:'requester',executorUserId:'executor',repositoryFullName:'owner/fixture',connectionId:'connection',connectionRevision:'2026-10-28T21:00:00.000Z',installationId:'123',workflowPath:'.github/workflows/deploy.yml',workflowBlobSha:'b'.repeat(40),sourceCommitSha:'a'.repeat(40),refKind:'tag',ref:'axiom-release-fixture',inputs:{},sourcePolicy:'github_protected_tag_v1',windowStart:'2026-10-28T21:59:00.000Z',expiresAt:'2026-10-28T22:20:00.000Z'};
const body={plan,clientRequestId:'00000000-0000-4000-8000-000000000001',reviewedExactAction:true};
const request=(value:unknown=body)=>new NextRequest('https://app.test/api/desktop/deployments/release/operation-plans/'+planId+'/deployment-approval',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
beforeEach(()=>{vi.clearAllMocks();m.auth.mockResolvedValue(actor);m.enabled.mockReturnValue(false);m.issue.mockResolvedValue({id:'approval',planDigest:'d'.repeat(64)})});
it('keeps the installed default composition disabled before issuing an approval',async()=>{expect((await handle(request(),'release',planId)).status).toBe(503);expect(m.issue).not.toHaveBeenCalled()});
it('issues only after authenticated exact review and never exposes execution',async()=>{m.enabled.mockReturnValue(true);const r=await handle(request(),'release',planId);expect(r.status).toBe(201);expect(m.issue).toHaveBeenCalledWith(plan,body.clientRequestId);expect((await r.json()).data.executionAvailable).toBe(false);expect(m.auth).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({recordHeartbeat:false,allowApiKey:false,requireWorkspaceMembership:true}))});
it.each(['creator','requester','executor'])('refuses independent approval by %s',async userId=>{m.enabled.mockReturnValue(true);m.auth.mockResolvedValue({...actor,userId});expect((await handle(request(),'release',planId)).status).toBe(409);expect(m.issue).not.toHaveBeenCalled()});
it.each([{plan:{...plan,organizationId:'other'}},{plan:{...plan,releaseId:'other'}},{reviewedExactAction:false},{approvedBy:'forged'}])('refuses mismatched or injected authority %#',async patch=>{m.enabled.mockReturnValue(true);expect((await handle(request({...body,...patch}),'release',planId)).status).toBeGreaterThanOrEqual(400);expect(m.issue).not.toHaveBeenCalled()});
it('does not claim success if the browser session changes during persistence',async()=>{m.enabled.mockReturnValue(true);m.auth.mockResolvedValueOnce(actor).mockResolvedValue({...actor,id:'replacement'});const r=await handle(request(),'release',planId);expect(r.status).toBe(409);expect((await r.json()).error).toBe('deployment_approval_refresh_required')});
it('refuses API-key authentication before parsing or issuing approval',async()=>{m.auth.mockResolvedValue({...actor,credentialKind:'api_key'});expect((await handle(request(),'release',planId)).status).toBe(403);expect(m.issue).not.toHaveBeenCalled()});

it('reads only a server-built verified proposal and never issues approval on GET',async()=>{m.enabled.mockReturnValue(true);m.preview.mockResolvedValue({plan,planDigest:'a'.repeat(64),canApprove:true,executionAvailable:false});const r=await handle(new NextRequest(request().url),'release',planId);expect(r.status).toBe(200);expect(m.preview).toHaveBeenCalledWith(planId);expect(m.issue).not.toHaveBeenCalled()});

it('requires approval permission, never execution permission as a substitute',async()=>{
 m.enabled.mockReturnValue(true);m.auth.mockResolvedValue({...actor,capabilities:['github:read','deploy:execute']});
 expect((await handle(request(),'release',planId)).status).toBe(403);expect(m.issue).not.toHaveBeenCalled();
});

import {ReleaseVerificationFailure} from '../releaseVerificationPhase';
it.each(['authority','source','policy','workflow'] as const)('returns a fixed safe %s recovery code without underlying provider details',async phase=>{
 m.enabled.mockReturnValue(true);m.preview.mockRejectedValue(new ReleaseVerificationFailure(phase));
 const r=await handle(new NextRequest(request().url),'release',planId);
 expect(r.status).toBe(409);expect(await r.json()).toEqual({ok:false,error:`release_review_${phase}_unavailable`});
});
it('reports a proven mutable release separately from unavailable policy evidence',async()=>{
 m.enabled.mockReturnValue(true);m.preview.mockRejectedValue(new ReleaseVerificationFailure('policy',true));
 const r=await handle(new NextRequest(request().url),'release',planId);
 expect(r.status).toBe(409);expect(await r.json()).toEqual({ok:false,error:'release_immutable_required'});
});

it('forwards only the exact separately reviewed baseline digest to issuance',async()=>{m.enabled.mockReturnValue(true);const digest='c'.repeat(64);const r=await handle(request({...body,governanceBaselineDigest:digest}),'release',planId);expect(r.status).toBe(201);expect(m.issue).toHaveBeenCalledWith(plan,body.clientRequestId,digest);});
it.each(['BAD','C'.repeat(64)])('refuses malformed baseline %s before persistence',async governanceBaselineDigest=>{m.enabled.mockReturnValue(true);expect((await handle(request({...body,governanceBaselineDigest}),'release',planId)).status).toBe(400);expect(m.issue).not.toHaveBeenCalled();});
it.each([{governanceBaselineDigest:'bad'},{secretToken:'never-project-private-authority'}])('refuses malformed or private preview fields %#',async extra=>{m.enabled.mockReturnValue(true);m.preview.mockResolvedValue({plan,planDigest:'a'.repeat(64),canApprove:true,executionAvailable:false,...extra});const r=await handle(new NextRequest(request().url),'release',planId);expect(r.status).toBe(409);expect(JSON.stringify(await r.json())).not.toContain('never-project-private-authority');expect(m.issue).not.toHaveBeenCalled();});
