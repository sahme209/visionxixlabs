import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ installation: vi.fn(), mint: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { gitHubInstallation: { findFirst: mocks.installation } } }));
vi.mock("../githubAppAuth", () => ({ resolveGithubInstallationToken: mocks.mint }));
import { resolveTenantScopedToken, resolveTenantScopedTokenWithExpiry } from "../resolveTenantScopedToken";
const revision = new Date("2026-10-16T00:00:00Z");
const row = { id: "tenant-install", githubInstallationId: "19", updatedAt: revision, revokedAt: null, suspendedAt: null };
beforeEach(() => { vi.resetAllMocks(); mocks.installation.mockResolvedValue(row); mocks.mint.mockResolvedValue({ ok: true, token: "fixture-scoped-token", installationId: 19 }); });

it("pins tenant installation identity/revision and scopes issuance to exactly one repository", async () => {
  expect(await resolveTenantScopedToken("org", { owner: "owner", repo: "repo" }, row)).toEqual({ ok: true, token: "fixture-scoped-token" });
  expect(mocks.installation).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org", status: "active" }, select: expect.objectContaining({ id: true, updatedAt: true }) }));
  expect(mocks.mint).toHaveBeenCalledWith({ installationId: 19, repositories: ["repo"] });
});
it.each([
  { ...row, id: "different-install" }, { ...row, githubInstallationId: "20" }, { ...row, updatedAt: new Date("2026-10-16T00:00:01Z") },
  { ...row, revokedAt: revision }, { ...row, suspendedAt: revision },
])("refuses installation replacement/revision/revocation before token issuance", async changed => {
  mocks.installation.mockResolvedValue(changed);
  expect(await resolveTenantScopedToken("org", { owner: "owner", repo: "repo" }, row)).toEqual({ ok: false, error: "github_not_connected" });
  expect(mocks.mint).not.toHaveBeenCalled();
});
it("refuses an auth resolver result for a different installation", async () => {
  mocks.mint.mockResolvedValue({ ok: true, token: "wrong-installation", installationId: 20 });
  expect(await resolveTenantScopedToken("org", { owner: "owner", repo: "repo" }, row)).toEqual({ ok: false, error: "github_token_unavailable" });
});
it("preserves legacy two-argument lookup and response", async () => {
  expect(await resolveTenantScopedToken("org", { owner: "owner", repo: "repo" })).toEqual({ ok: true, token: "fixture-scoped-token" });
  expect(mocks.installation).toHaveBeenCalledWith({ where: { organizationId: "org", status: "active" }, orderBy: { installedAt: "desc" }, select: { githubInstallationId: true } });
});
it("uses the supplied installation repository rather than ambient database authority", async () => {
  const scopedLookup = vi.fn().mockResolvedValue(row);
  expect(await resolveTenantScopedToken("org", { owner: "owner", repo: "repo" }, row,
    { gitHubInstallation: { findFirst: scopedLookup } })).toEqual({ ok: true, token: "fixture-scoped-token" });
  expect(scopedLookup).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org", status: "active" } }));
  expect(mocks.installation).not.toHaveBeenCalled();
});

it.each([
  null, { ...row, id: "replaced" }, { ...row, githubInstallationId: "20" },
  { ...row, updatedAt: new Date("2026-10-16T00:00:01Z") },
  { ...row, revokedAt: revision }, { ...row, suspendedAt: revision },
])("does not release a minted token after its pinned installation changes", async changed => {
  mocks.installation.mockResolvedValueOnce(row).mockResolvedValueOnce(changed);
  expect(await resolveTenantScopedToken("org", { owner: "owner", repo: "repo" }, row))
    .toEqual({ ok: false, error: "github_not_connected" });
});
it("refuses a post-mint installation lookup failure without exposing the token", async () => {
  mocks.installation.mockResolvedValueOnce(row).mockRejectedValueOnce(new Error("fixture database unavailable"));
  expect(await resolveTenantScopedToken("org", { owner: "owner", repo: "repo" }, row))
    .toEqual({ ok: false, error: "github_not_connected" });
});
it("refuses cancellation during mint even if the provider returns success", async () => {
  const controller = new AbortController();
  mocks.mint.mockImplementationOnce(async () => { controller.abort(); return {ok:true,token:"fixture-scoped-token",installationId:19}; });
  expect(await resolveTenantScopedToken("org", {owner:"owner",repo:"repo"}, {...row,signal:controller.signal}))
    .toEqual({ok:false,error:"github_token_unavailable"});
});

afterEach(()=>vi.restoreAllMocks());
it('returns actual provider expiry from one pinned issuance without changing legacy output',async()=>{
 const expiresAt=Date.now()+60000;mocks.mint.mockResolvedValue({ok:true,token:'fixture-scoped-token',installationId:19,expiresAt});
 expect(await resolveTenantScopedTokenWithExpiry('org',{owner:'owner',repo:'repo'},row)).toEqual({ok:true,token:'fixture-scoped-token',expiresAt});expect(mocks.mint).toHaveBeenCalledOnce();
 mocks.mint.mockClear();expect(await resolveTenantScopedToken('org',{owner:'owner',repo:'repo'},row)).toEqual({ok:true,token:'fixture-scoped-token'});expect(mocks.mint).toHaveBeenCalledOnce();
});
it.each([undefined,null,NaN,Infinity,0,-1,'2030-01-01T00:00:00Z'])('refuses missing or invalid provider expiry %s without guessing',async expiresAt=>{
 mocks.mint.mockResolvedValue({ok:true,token:'PRIVATE_TOKEN',installationId:19,expiresAt});expect(await resolveTenantScopedTokenWithExpiry('org',{owner:'owner',repo:'repo'},row)).toEqual({ok:false,error:'github_token_unavailable'});expect(mocks.mint).toHaveBeenCalledOnce();
});
it('refuses already expired provider metadata and expiry crossed during the final lookup',async()=>{
 let now=Date.now();vi.spyOn(Date,'now').mockImplementation(()=>now);mocks.mint.mockResolvedValue({ok:true,token:'PRIVATE_TOKEN',installationId:19,expiresAt:now});expect(await resolveTenantScopedTokenWithExpiry('org',{owner:'owner',repo:'repo'},row)).toEqual({ok:false,error:'github_token_unavailable'});
 mocks.mint.mockResolvedValue({ok:true,token:'PRIVATE_TOKEN',installationId:19,expiresAt:now+100});mocks.installation.mockImplementationOnce(async()=>row).mockImplementationOnce(async()=>{now+=101;return row});expect(await resolveTenantScopedTokenWithExpiry('org',{owner:'owner',repo:'repo'},row)).toEqual({ok:false,error:'github_token_unavailable'});
});
it('requires the exact pinned installation on the metadata API before any issuance',async()=>{
 expect(await resolveTenantScopedTokenWithExpiry('org',{owner:'owner',repo:'repo'},undefined as never)).toEqual({ok:false,error:'github_token_unavailable'});expect(mocks.installation).not.toHaveBeenCalled();expect(mocks.mint).not.toHaveBeenCalled();
});
it.each([null,{...row,id:'replacement'},{...row,updatedAt:new Date('2026-10-17T00:00:00Z')},{...row,revokedAt:revision},{...row,suspendedAt:revision}])('withholds actual metadata after post-mint connection change %#',async changed=>{
 mocks.mint.mockResolvedValue({ok:true,token:'PRIVATE_TOKEN',installationId:19,expiresAt:Date.now()+60000});mocks.installation.mockResolvedValueOnce(row).mockResolvedValueOnce(changed);expect(await resolveTenantScopedTokenWithExpiry('org',{owner:'owner',repo:'repo'},row)).toEqual({ok:false,error:'github_not_connected'});
});
it('does not release expiry or token on cancellation during issuance',async()=>{
 const c=new AbortController();mocks.mint.mockImplementation(async()=>{c.abort();return{ok:true,token:'PRIVATE_TOKEN',installationId:19,expiresAt:Date.now()+60000}});expect(await resolveTenantScopedTokenWithExpiry('org',{owner:'owner',repo:'repo'},{...row,signal:c.signal})).toEqual({ok:false,error:'github_token_unavailable'});
});
it('captures read permission profile, repository and installation primitives before the first await',async()=>{
 const expected={...row,updatedAt:new Date(revision),permissionProfile:'contents_read' as const},repository={owner:'owner',repo:'repo'},expiresAt=Date.now()+60000;
 mocks.installation.mockImplementationOnce(async()=>{expected.id='replacement';expected.updatedAt.setTime(revision.getTime()+1000);(expected as any).permissionProfile=undefined;repository.repo='other';return row});mocks.mint.mockResolvedValue({ok:true,token:'READ_TOKEN',installationId:19,expiresAt});
 expect(await resolveTenantScopedTokenWithExpiry('org',repository,expected)).toEqual({ok:true,token:'READ_TOKEN',expiresAt});expect(mocks.mint).toHaveBeenCalledWith({installationId:19,repositories:['repo'],permissionProfile:'contents_read'});expect(mocks.mint).toHaveBeenCalledOnce();
});
it('uses the supplied repository and rejects a wrong provider installation for metadata',async()=>{
 const expiresAt=Date.now()+60000,lookup=vi.fn().mockResolvedValue(row);mocks.mint.mockResolvedValue({ok:true,token:'PRIVATE_TOKEN',installationId:20,expiresAt});expect(await resolveTenantScopedTokenWithExpiry('org',{owner:'owner',repo:'repo'},row,{gitHubInstallation:{findFirst:lookup}})).toEqual({ok:false,error:'github_token_unavailable'});expect(mocks.installation).not.toHaveBeenCalled();
});
it('returns only the fixed metadata error when provider resolution rejects',async()=>{
 mocks.mint.mockRejectedValue(Error('PRIVATE_PROVIDER_PAYLOAD'));expect(await resolveTenantScopedTokenWithExpiry('org',{owner:'owner',repo:'repo'},row)).toEqual({ok:false,error:'github_token_unavailable'});
});
it('captures permission profile and repository primitives for legacy callers too',async()=>{
 const expected={...row,permissionProfile:'contents_read' as const},repository={owner:'owner',repo:'repo'};mocks.installation.mockImplementationOnce(async()=>{(expected as any).permissionProfile=undefined;repository.repo='changed';return row});
 expect(await resolveTenantScopedToken('org',repository,expected)).toEqual({ok:true,token:'fixture-scoped-token'});expect(mocks.mint).toHaveBeenCalledWith({installationId:19,repositories:['repo'],permissionProfile:'contents_read'});
});
it('does not consult storage or mint for an already canceled metadata request',async()=>{
 const c=new AbortController();c.abort();expect(await resolveTenantScopedTokenWithExpiry('org',{owner:'owner',repo:'repo'},{...row,signal:c.signal})).toEqual({ok:false,error:'github_token_unavailable'});expect(mocks.installation).not.toHaveBeenCalled();expect(mocks.mint).not.toHaveBeenCalled();
});
