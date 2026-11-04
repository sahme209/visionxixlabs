import {it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {createReleaseProviderMergeCoordinatorCore,type ProviderMergeCoordinatorDependencies} from '../releaseProviderMergeCoordinatorCore';
/** Ordinary source correctness with simulated paired authority and repository.
 * Actual coordinator/store code remains in use. No executing issuer is supplied. */
function fixture(){
 const actor={id:'session',userId:'executor',organizationId:'org',credentialKind:'desktop_session',capabilities:['github:read','deploy:execute']};
 const resolveSession=vi.fn(async()=>actor),findFirst=vi.fn(async()=>null),query=vi.fn(async(q:TemplateStringsArray)=>q.join('').includes('OrgMembership')?[{organizationId:'org',userId:'executor',role:'operator',acceptedAt:new Date()}]:[]);
 const repo:any={durableAgentWorkflow:{findFirst},$queryRaw:query};repo.$transaction=async(fn:any)=>fn(repo);
 const dependencies:ProviderMergeCoordinatorDependencies={resolveSession:resolveSession as never,createGovernanceService:vi.fn(()=>({}) as never),governanceEnabled:()=>false,enabled:()=>false,releaseAuth:{resolveReleaseInstallationToken:vi.fn(),readReleaseInstallationEligibility:vi.fn(),consumeReleaseInstallationEligibility:vi.fn()},createDrainAuthority:vi.fn(),fetch:vi.fn(),now:()=>Date.now()};
 return{actor,repo,dependencies,resolveSession,findFirst,query};
}
it('uses the captured paired resolver and actual store for recovery with dispatch disabled',async()=>{
 const f=fixture(),coordinator=createReleaseProviderMergeCoordinatorCore(f.repo,new NextRequest('https://app.test/local'),{},f.dependencies);
 await expect(coordinator.recover('release_merge_provider_'+'a'.repeat(64))).rejects.toThrow();
 expect(f.resolveSession).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({allowApiKey:false,requiredCapability:'github:read'}));
 expect(f.query.mock.calls.some(([sql])=>sql.join('').includes('DurableAgentWorkflow'))).toBe(true);expect(f.dependencies.releaseAuth.resolveReleaseInstallationToken).not.toHaveBeenCalled();expect(f.dependencies.fetch).not.toHaveBeenCalled();
});
it('refuses identity replacement before the actual store reads its operation',async()=>{
 const f=fixture();f.resolveSession.mockResolvedValue({...f.actor,id:'replacement'});
 const coordinator=createReleaseProviderMergeCoordinatorCore(f.repo,new NextRequest('https://app.test/local'),{},f.dependencies,{id:'session',userId:'executor',organizationId:'org'});
 await expect(coordinator.recover('release_merge_provider_'+'a'.repeat(64))).rejects.toThrow('provider_merge_identity_changed');expect(f.findFirst).not.toHaveBeenCalled();
});
it('retains the canonical issuer refusal before claim, mint or transport in the actual run path',async()=>{
 const f=fixture();f.dependencies.enabled=()=>true;
 const coordinator=createReleaseProviderMergeCoordinatorCore(f.repo,new NextRequest('https://app.test/local'),{useScopedInstallationTokens:true,useVerifiedLinearTopology:true},f.dependencies);
 await expect(coordinator.run('release_merge_provider_'+'a'.repeat(64))).rejects.toThrow('issuer');
 expect(f.findFirst).not.toHaveBeenCalled();expect(f.dependencies.releaseAuth.resolveReleaseInstallationToken).not.toHaveBeenCalled();expect(f.dependencies.fetch).not.toHaveBeenCalled();
});
