import { beforeEach, expect, it, vi } from "vitest";
const f=vi.hoisted(()=>({installation:vi.fn(),mint:vi.fn(),enrollment:vi.fn()}));
vi.mock("@/lib/db",()=>({prisma:{durableAgentWorkflow:{findMany:f.enrollment},gitHubInstallation:{findFirst:f.installation}}}));
vi.mock("@/lib/connectors/github/githubAppAuth",()=>({resolveGithubInstallationToken:f.mint}));
import { createCodingWriteAuthority } from "../codingGithubCredential";
const date=new Date("2026-10-23T00:00:00Z");
beforeEach(()=>{vi.resetAllMocks();f.enrollment.mockResolvedValue([]);f.installation.mockResolvedValue({id:"installation",githubInstallationId:"123",updatedAt:date,revokedAt:null,suspendedAt:null});f.mint.mockResolvedValue({ok:true,installationId:123,token:"synthetic_tenant_token"});});
it("binds a callable authority to the captured installation revision and exact repository",async()=>{
 const a=await createCodingWriteAuthority("org",{owner:"owned",repo:"repo"});expect(a.ok).toBe(true);if(!a.ok)throw Error("fixture authority required");
 expect(await a.resolveToken()).toMatchObject({ok:true});expect(await a.resolveToken()).toMatchObject({ok:true});
 expect(f.installation).toHaveBeenCalledTimes(3);expect(f.mint).toHaveBeenCalledTimes(2);
 for(const [input] of f.mint.mock.calls)expect(input).toMatchObject({installationId:123,repositories:["repo"]});
});
it.each([
 {id:"replacement",githubInstallationId:"123",updatedAt:date},
 {id:"installation",githubInstallationId:"456",updatedAt:date},
 {id:"installation",githubInstallationId:"123",updatedAt:new Date(date.getTime()+1)},
 {id:"installation",githubInstallationId:"123",updatedAt:date,revokedAt:date},
 {id:"installation",githubInstallationId:"123",updatedAt:date,suspendedAt:date},
])("refuses changed captured authority %j before minting a provider token",async row=>{
 const a=await createCodingWriteAuthority("org",{owner:"owned",repo:"repo"});if(!a.ok)throw Error("fixture authority required");
 f.installation.mockResolvedValue(row);expect(await a.resolveToken()).toMatchObject({ok:false});expect(f.mint).not.toHaveBeenCalled();
});
it("refuses missing or unreadable installation state",async()=>{f.installation.mockRejectedValue(Error("synthetic unavailable"));expect(await createCodingWriteAuthority("org",{owner:"owned",repo:"repo"})).toMatchObject({ok:false});expect(f.mint).not.toHaveBeenCalled();});
it("refuses an installation identifier that cannot be represented exactly",async()=>{
 f.installation.mockResolvedValue({id:"installation",githubInstallationId:"9007199254740993",updatedAt:date,revokedAt:null,suspendedAt:null});
 expect(await createCodingWriteAuthority("org",{owner:"owned",repo:"repo"})).toMatchObject({ok:false});expect(f.mint).not.toHaveBeenCalled();
});

it("requests read-only repository permissions for coding evidence",async()=>{
 const {resolveCodingGithubCredential}=await import('../codingGithubCredential');
 expect(await resolveCodingGithubCredential('org',{owner:'owned',repo:'repo'})).toMatchObject({ok:true});
 expect(f.mint).toHaveBeenCalledWith(expect.objectContaining({installationId:123,repositories:['repo'],permissionProfile:'contents_read'}));
});
it.each(['revokedAt','suspendedAt'])("refuses %s evidence access even if an installation row still says active",async field=>{
 const {resolveCodingGithubCredential}=await import('../codingGithubCredential');
 f.installation.mockResolvedValue({id:'installation',githubInstallationId:'123',updatedAt:date,[field]:date});
 expect(await resolveCodingGithubCredential('org',{owner:'owned',repo:'repo'})).toMatchObject({ok:false});expect(f.mint).not.toHaveBeenCalled();
});

it("refuses enrolled coding writes before installation or credential access",async()=>{
 f.enrollment.mockResolvedValue([{id:'governance_active_org',organizationId:'org',workflowKind:'governance_baseline_active_v1'}]);
 expect(await createCodingWriteAuthority('org',{owner:'owned',repo:'repo'})).toMatchObject({ok:false});expect(f.installation).not.toHaveBeenCalled();expect(f.mint).not.toHaveBeenCalled();
});
it("rechecks enrollment around each token resolution and refuses enrollment during mint",async()=>{
 const authority=await createCodingWriteAuthority('org',{owner:'owned',repo:'repo'});if(!authority.ok)throw Error('fixture');
 f.mint.mockImplementationOnce(async()=>{f.enrollment.mockResolvedValue([{id:'governance_active_org',organizationId:'org',workflowKind:'governance_baseline_active_v1'}]);return {ok:true,installationId:123,token:'synthetic'};});
 expect(await authority.resolveToken()).toMatchObject({ok:false,error:'github_write_authority_unavailable'});
});
it("preserves separately authorized read-only coding evidence for enrolled workspaces",async()=>{
 f.enrollment.mockResolvedValue([{id:'governance_active_org',organizationId:'org',workflowKind:'governance_baseline_active_v1'}]);
 const {resolveCodingGithubCredential}=await import('../codingGithubCredential');
 expect(await resolveCodingGithubCredential('org',{owner:'owned',repo:'repo'})).toMatchObject({ok:true});expect(f.enrollment).not.toHaveBeenCalled();
});
