import {beforeEach,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({auth:vi.fn(),get:vi.fn(),preflight:vi.fn(),binding:vi.fn(),current:vi.fn(),token:vi.fn(),fetch:vi.fn()}));
vi.mock('../resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:m.auth}));
vi.mock('../releaseDeploymentServices',()=>({createReleaseDeploymentServices:()=>({ports:{dependencies:{assertCurrent:vi.fn()},preflight:m.preflight}})}));
vi.mock('@/lib/tauri/releaseDeploymentExecutionStore',()=>({releaseDeploymentExecutionId:()=> 'release_deployment_'+'a'.repeat(64),createReleaseDeploymentExecutionStore:()=>({get:m.get,readAcceptedEvidenceSource:vi.fn()})}));
vi.mock('@/lib/tauri/releaseDeploymentEvidenceBridge',()=>({createReleaseDeploymentEvidenceBridge:()=>({readAcceptedBinding:m.binding,readCurrentBinding:m.current})}));
vi.mock('@/lib/connectors/github/githubAppAuth',()=>({resolveReleaseInstallationToken:m.token}));
import {createReleaseWorkflowEvidenceServices} from '../releaseWorkflowEvidenceServices';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
const time=Date.now(),scope={organizationId:'org',actorUserId:'requester',sessionId:'session'},planId='release_plan_'+'b'.repeat(64);
const reviewed={kind:'merge_pull_request' as const,organizationId:'org',requestId:'release',requestVersion:5,intakeDigest:'d'.repeat(64),connectionId:'connection',connectionRevision:new Date(time-1000).toISOString(),window:{startUtc:new Date(time-1000).toISOString(),endUtc:new Date(time+600000).toISOString()},method:'merge' as const,pullRequest:{repositoryFullName:'team/service',number:1,url:'https://github.com/team/service/pull/1',headRef:'feature',headSha:'a'.repeat(40),baseRef:'main',baseSha:'b'.repeat(40)}};
const deployment={purpose:'release_deployment',organizationId:'org',releaseId:'release',releaseVersion:5,intakeDigest:reviewed.intakeDigest,planId,creatorUserId:'requester',requesterUserId:'requester',executorUserId:'requester',repositoryFullName:'team/service',connectionId:'connection',connectionRevision:reviewed.connectionRevision,installationId:'123',workflowPath:'.github/workflows/deploy.yml',workflowBlobSha:'c'.repeat(40),sourceCommitSha:reviewed.pullRequest.headSha,refKind:'tag',ref:'release-test',inputs:{marker:'synthetic'},sourcePolicy:'github_immutable_release_v1',windowStart:reviewed.window.startUtc,expiresAt:reviewed.window.endUtc};
const binding={organizationId:'org',releaseId:'release',releaseVersion:5,intakeDigest:reviewed.intakeDigest,planId,planDigest:sha256ContentHash(reviewed),connectionId:'connection',connectionRevision:reviewed.connectionRevision,repositoryFullName:'team/service',workflowPath:deployment.workflowPath,dispatchedRef:deployment.ref,sourceCommit:deployment.sourceCommitSha,runId:'456',runAttempt:1,dispatchEvidenceDigest:'e'.repeat(64),expiresAt:new Date(time+300000).toISOString()};
function fixture(user='requester'){
 const repo={durableAgentWorkflow:{findFirst:vi.fn(async()=>({inputJson:{plan:deployment}}))},$transaction:vi.fn(async(fn:any)=>fn({}))};
 const service=createReleaseWorkflowEvidenceServices(new NextRequest('https://owned.test'),repo as never,{...scope,actorUserId:user},reviewed,{requesterUserId:'requester',isEnabled:()=>true,isPlanAllowed:p=>p.organizationId==='org'&&p.repositoryFullName==='team/service',fetch:m.fetch as typeof fetch});
 return{repo,service,collect:()=>service.collectAcceptedBinding!(scope,planId,new AbortController().signal)};
}
beforeEach(()=>{
 vi.clearAllMocks();m.auth.mockResolvedValue({id:'session',userId:'requester',organizationId:'org',credentialKind:'desktop_session',capabilities:['github:read']});m.get.mockResolvedValue({state:'accepted',receipt:{runId:'456'}});m.preflight.mockResolvedValue(undefined);m.binding.mockResolvedValue(binding);m.current.mockImplementation(async(_tx,_s,b)=>b);m.token.mockResolvedValue({token:'PRIVATE_TOKEN',expiresAt:time+600000,permissions:{actions:'read',contents:'read',metadata:'read'}});
 m.fetch.mockImplementation(async(url:string)=>Response.json(url.includes('/actions/runs/')?{id:456,run_attempt:1,workflow_id:789,path:deployment.workflowPath,event:'workflow_dispatch',head_sha:binding.sourceCommit,head_branch:binding.dispatchedRef,repository:{full_name:'team/service'},head_repository:{full_name:'team/service'},status:'completed',conclusion:'success'}:{id:789,path:deployment.workflowPath}));
});
it('collects only from an accepted ledger then reads fixed run/workflow endpoints with a read-only token',async()=>{
 const f=fixture();expect(await f.collect()).toEqual(binding);
 expect(m.get.mock.invocationCallOrder[0]).toBeLessThan(m.preflight.mock.invocationCallOrder[0]);expect(m.preflight).toHaveBeenCalledWith(deployment,expect.any(AbortSignal));
 expect(await f.service.verifyObservation!(binding,new AbortController().signal)).toMatchObject({provenance:'verified_release_dispatch',status:'completed',conclusion:'success'});
 expect(m.token).toHaveBeenCalledWith(expect.objectContaining({installationId:'123',repositoryFullName:'team/service',purpose:'workflow_read'}),expect.any(AbortSignal));
 expect(m.fetch.mock.calls.map(c=>c[0])).toEqual(['https://api.github.com/repos/team/service/actions/runs/456/attempts/1','https://api.github.com/repos/team/service/actions/workflows/789']);
 for(const [,init] of m.fetch.mock.calls)expect(init).toMatchObject({method:'GET',redirect:'error',credentials:'omit'});
});
it.each(['prepared','unknown','refused'])('refuses %s before policy network or token access',async state=>{
 m.get.mockResolvedValue({state});const f=fixture();await expect(f.collect()).rejects.toThrow();expect(m.preflight).not.toHaveBeenCalled();expect(m.token).not.toHaveBeenCalled();expect(m.fetch).not.toHaveBeenCalled();
});
it('refuses wrong identity, scope and source binding before collection',async()=>{
 const f=fixture();m.auth.mockResolvedValue({id:'other',userId:'requester',organizationId:'org',credentialKind:'desktop_session',capabilities:['github:read']});await expect(f.collect()).rejects.toThrow();expect(m.preflight).not.toHaveBeenCalled();
 const reviewer=fixture('reviewer');expect(reviewer.service.enabled!()).toBe(false);await expect(reviewer.collect()).rejects.toThrow();
});
it('does not contact GitHub before collection establishes the exact accepted plan',async()=>{
 const f=fixture();expect(await f.service.verifyObservation!(binding,new AbortController().signal)).toBeNull();expect(m.token).not.toHaveBeenCalled();expect(m.fetch).not.toHaveBeenCalled();
});
it('refuses expanded token permissions instead of using them for workflow reads',async()=>{
 const f=fixture();await f.collect();m.token.mockResolvedValue({token:'PRIVATE_TOKEN',expiresAt:time+600000,permissions:{actions:'write',contents:'read',metadata:'read'}});expect(await f.service.verifyObservation!(binding,new AbortController().signal)).toBeNull();expect(m.fetch).not.toHaveBeenCalled();
});
