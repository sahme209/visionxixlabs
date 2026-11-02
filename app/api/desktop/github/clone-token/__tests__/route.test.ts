import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  resolveTenantScopedToken: vi.fn(),
  resolveWithExpiry: vi.fn(),
  reserve: vi.fn(),
  finalize: vi.fn(),
  leaseAuthority: vi.fn(),
  recordAudit: vi.fn(async (input: import("@/lib/audit/secureAudit").RecordInput) => { void input; }),
  getRepositoryDefaultBranch: vi.fn(),
  installation: null as any,
  enrolled: false,
  sessionLive: true,
  sessionExpiresAt: new Date(),
  role: "operator",
  installationRead: vi.fn(),
  snapshot: vi.fn(),
  enrollmentRead: vi.fn(),
}));

vi.mock("@/lib/db",()=>({prisma:{gitHubInstallation:{findFirst:mocks.installationRead},$queryRaw:mocks.snapshot,durableAgentWorkflow:{findMany:mocks.enrollmentRead}}}));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({
  resolveRequestDesktopSession: mocks.resolveRequestDesktopSession,
}));
vi.mock("@/lib/connectors/github/resolveTenantScopedToken", () => ({
  resolveTenantScopedToken: mocks.resolveTenantScopedToken,
  resolveTenantScopedTokenWithExpiry: mocks.resolveWithExpiry,
  parseRepositoryFullName: (value: string) => {
    const [owner, repo, extra] = value.split("/");
    return owner && repo && !extra ? { owner, repo } : null;
  },
}));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.recordAudit }));
vi.mock("@/lib/connectors/github/githubWriteClient", () => ({ getRepositoryDefaultBranch: mocks.getRepositoryDefaultBranch }));

vi.mock("@/lib/governance/intelligence/nativeGitCredentialLeaseStore",()=>({createNativeGitCredentialLeaseStore:()=>({reserve:mocks.reserve,finalize:mocks.finalize})}));
vi.mock("@/lib/desktop/nativeGitCredentialLeaseAuthority",()=>({createNativeGitCredentialLeaseAuthority:()=>mocks.leaseAuthority}));

function request(body: object,signal?:AbortSignal) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/github/clone-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const, capabilities: ["github:write"] };

describe("POST /api/desktop/github/clone-token", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.installation={id:"installation",githubInstallationId:"123",updatedAt:new Date("2026-11-01T00:00:00.000Z"),revokedAt:null,suspendedAt:null};mocks.enrolled=false;mocks.sessionLive=true;mocks.sessionExpiresAt=new Date(Date.now()+60000);mocks.role="operator";
    mocks.installationRead.mockImplementation(async()=>({...mocks.installation}));
    mocks.enrollmentRead.mockImplementation(async()=>mocks.enrolled?[{id:"governance_active_fixture",organizationId:session.organizationId,workflowKind:"governance_baseline_active_v1"}]:[]);
    mocks.snapshot.mockImplementation(async()=>[{sessionId:session.id,userId:session.userId,organizationId:session.organizationId,sessionLive:mocks.sessionLive,expiresAt:mocks.sessionExpiresAt,sessionExpiresAt:mocks.sessionExpiresAt,role:mocks.role,acceptedAt:new Date("2026-11-01T00:00:00.000Z"),connectionId:mocks.installation.id,githubInstallationId:mocks.installation.githubInstallationId,connectionRevision:mocks.installation.updatedAt,connectionRevokedAt:mocks.installation.revokedAt,connectionSuspendedAt:mocks.installation.suspendedAt,connectionStatus:"active",enrolled:mocks.enrolled}]);
    mocks.recordAudit.mockResolvedValue(undefined);
    mocks.reserve.mockResolvedValue({id:'native_git_credential_lease_'+ 'a'.repeat(64),version:0,status:'pending'});
    mocks.finalize.mockResolvedValue({status:'issued',version:1});
    mocks.resolveWithExpiry.mockImplementation(async(...args)=>{const result=await mocks.resolveTenantScopedToken(...args);return result?.ok?{...result,expiresAt:Date.now()+60000}:result});
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
    mocks.getRepositoryDefaultBranch.mockResolvedValue({ ok: true, data: "main" });
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets" }));
    expect(res.status).toBe(401);
  });

  it("mints a clone URL with the token embedded, and audits without the token", async () => {
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "ghs_SECRET" });
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.cloneUrl).toBe("https://x-access-token:ghs_SECRET@github.com/acme/widgets.git");

    const auditCall = mocks.recordAudit.mock.calls[0][0];
    expect(JSON.stringify(auditCall.detail)).not.toContain("ghs_SECRET");
    expect(auditCall.action).toBe("github.clone_token_minted");
  });

  it("records the explicit remote operation purpose without auditing the credential", async () => {
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "ghs_PUSH_SECRET" });
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets", purpose: "push", branch: "feature-x" }));
    expect(res.status).toBe(200);
    const auditCall = mocks.recordAudit.mock.calls[0][0];
    expect(auditCall.action).toBe("github.push_token_minted");
    expect(auditCall.detail).toEqual({ repositoryFullName: "acme/widgets", purpose: "push", branch: "feature-x" });
    expect(JSON.stringify(auditCall)).not.toContain("ghs_PUSH_SECRET");
  });

  it("returns 409 when the tenant has no connected installation", async () => {
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: false, error: "github_not_connected" });
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets" }));
    expect(res.status).toBe(409);
  });

  it("requires an explicit non-default branch for push credentials", async () => {
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "ghs_SECRET" });
    const { POST } = await import("../route");

    const missingBranch = await POST(request({ repositoryFullName: "acme/widgets", purpose: "push" }));
    expect(missingBranch.status).toBe(400);
    await expect(missingBranch.json()).resolves.toMatchObject({ error: "push_branch_required" });

    expect(mocks.resolveTenantScopedToken).not.toHaveBeenCalled();
    const defaultBranch = await POST(request({ repositoryFullName: "acme/widgets", purpose: "push", branch: "main" }));
    expect(defaultBranch.status).toBe(409);
    await expect(defaultBranch.json()).resolves.toMatchObject({ error: "github_pull_request_cycle_required" });
  });

it.each(['clone','pull'])('issues only the pinned contents_read profile for %s',async purpose=>{
 mocks.resolveRequestDesktopSession.mockResolvedValue(session);mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:'READ_SECRET'});
 const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets',purpose}));expect(r.status).toBe(200);
 expect(mocks.resolveTenantScopedToken).toHaveBeenCalledWith(session.organizationId,{owner:'acme',repo:'widgets'},expect.objectContaining({id:'installation',githubInstallationId:'123',updatedAt:mocks.installation.updatedAt,permissionProfile:'contents_read',signal:expect.any(AbortSignal)}),expect.anything());
 expect(mocks.getRepositoryDefaultBranch).not.toHaveBeenCalled();expect(r.headers.get('cache-control')).toBe('private, no-store');
 expect(mocks.resolveRequestDesktopSession).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({requiredCapability:'github:write',allowApiKey:false,requireWorkspaceMembership:true,recordHeartbeat:false}));
});
it.each(['actor','installation','persisted-session','persisted-role'])('withholds read credentials after %s changes during best-effort audit',async kind=>{
 mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:'READ_SECRET'});mocks.recordAudit.mockImplementation(async()=>{if(kind==='actor')mocks.resolveRequestDesktopSession.mockResolvedValue({...session,userId:'other'});if(kind==='installation')mocks.installation={...mocks.installation,updatedAt:new Date('2026-11-02T00:00:00Z')};if(kind==='persisted-session')mocks.sessionLive=false;if(kind==='persisted-role')mocks.role='read_only'});
 const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets'}));expect(r.status).toBe(409);expect(JSON.stringify(await r.json())).not.toContain('READ_SECRET');expect(r.headers.get('cache-control')).toBe('private, no-store');
});
it.each(['enrolled','unavailable'])('refuses push mint for %s Governance before token resolution',async kind=>{
 if(kind==='enrolled')mocks.enrolled=true;else mocks.enrollmentRead.mockRejectedValue(Error('private metadata failure'));
 const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets',purpose:'push',branch:'feature'}));expect(r.status).toBe(409);expect(mocks.resolveTenantScopedToken).not.toHaveBeenCalled();
});
it('rechecks actual write guard after audit and refuses new enrollment without returning the token',async()=>{
 mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:'PUSH_SECRET'});mocks.recordAudit.mockImplementation(async()=>{mocks.enrolled=true});
 const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets',purpose:'push',branch:'feature'}));expect(r.status).toBe(409);expect(mocks.resolveTenantScopedToken).toHaveBeenCalledOnce();expect(JSON.stringify(await r.json())).not.toContain('PUSH_SECRET');
});
it('rejects caller-selected permission profiles before mint',async()=>{const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets',permissionProfile:'repository_write'}));expect(r.status).toBe(400);expect(mocks.resolveTenantScopedToken).not.toHaveBeenCalled()});
it('redacts resolver failures and keeps errors uncacheable',async()=>{mocks.resolveTenantScopedToken.mockRejectedValue(Error('PRIVATE_TOKEN_PAYLOAD'));const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets'}));expect(r.status).toBe(409);expect(JSON.stringify(await r.json())).not.toContain('PRIVATE_TOKEN_PAYLOAD');expect(r.headers.get('cache-control')).toBe('private, no-store')});

it.each(['session','installation'])('withholds push credentials when %s changes during audit',async kind=>{
 mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:'PUSH_SECRET'});mocks.recordAudit.mockImplementation(async()=>{if(kind==='session')mocks.sessionLive=false;else mocks.installation={...mocks.installation,updatedAt:new Date('2026-11-02T00:00:00Z')}});
 const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets',purpose:'push',branch:'feature'}));expect(r.status).toBe(409);expect(JSON.stringify(await r.json())).not.toContain('PUSH_SECRET');
});
it('refuses a push branch that becomes the default during audit',async()=>{
 mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:'PUSH_SECRET'});mocks.recordAudit.mockImplementation(async()=>{mocks.getRepositoryDefaultBranch.mockResolvedValue({ok:true,data:'feature'})});
 const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets',purpose:'push',branch:'feature'}));expect(r.status).toBe(409);expect(await r.json()).toMatchObject({error:'github_pull_request_cycle_required'});
});
it('withholds a read token when the installation is revoked during mint',async()=>{
 mocks.resolveTenantScopedToken.mockImplementation(async()=>{mocks.installation={...mocks.installation,revokedAt:new Date()};return{ok:true,token:'READ_SECRET'}});
 const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets',purpose:'pull'}));expect(r.status).toBe(409);expect(JSON.stringify(await r.json())).not.toContain('READ_SECRET');expect(mocks.recordAudit).not.toHaveBeenCalled();
});
it('allows best-effort audit failure only after final current checks',async()=>{
 mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:'READ_SECRET'});mocks.recordAudit.mockRejectedValue(Error('private audit failure'));
 const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets'}));expect(r.status).toBe(200);expect(mocks.snapshot).toHaveBeenCalledTimes(2);
});
it('propagates cancellation into issuance and never returns the canceled credential',async()=>{
 const c=new AbortController();mocks.resolveTenantScopedToken.mockImplementation(async(_org,_repo,expected)=>new Promise(resolve=>expected.signal.addEventListener('abort',()=>resolve({ok:true,token:'CANCELED_SECRET'}),{once:true})));
 const {POST}=await import('../route');const response=POST(request({repositoryFullName:'acme/widgets'},c.signal));await vi.waitFor(()=>expect(mocks.resolveTenantScopedToken).toHaveBeenCalledOnce());c.abort();const r=await response;expect(r.status).toBe(409);expect(JSON.stringify(await r.json())).not.toContain('CANCELED_SECRET');expect(mocks.recordAudit).not.toHaveBeenCalled();
});
it('does not release a credential after cancellation during audit',async()=>{
 const c=new AbortController();mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:'READ_SECRET'});mocks.recordAudit.mockImplementation(async()=>{c.abort()});
 const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets'},c.signal));expect(r.status).toBe(409);expect(JSON.stringify(await r.json())).not.toContain('READ_SECRET');
});
it('rejects oversized payloads before minting',async()=>{const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'a'.repeat(3000)}));expect(r.status).toBe(400);expect(mocks.resolveTenantScopedToken).not.toHaveBeenCalled()});
it('refuses API keys even if a resolver returns an otherwise matching principal',async()=>{mocks.resolveRequestDesktopSession.mockResolvedValue({...session,credentialKind:'api_key'});const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets'}));expect(r.status).toBe(401);expect(mocks.resolveTenantScopedToken).not.toHaveBeenCalled();expect(r.headers.get('cache-control')).toBe('private, no-store')});

it('keeps enrolled clone reads limited to contents_read without granting mutation admission',async()=>{
 mocks.enrolled=true;mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:'READ_SECRET'});const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets',purpose:'clone'}));expect(r.status).toBe(200);expect(mocks.resolveTenantScopedToken.mock.calls[0][2]).toMatchObject({permissionProfile:'contents_read'});expect(mocks.enrollmentRead).not.toHaveBeenCalled();
});

it('reserves a secret-free immutable lease before mint and records exact provider expiry before any credential response',async()=>{
 mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:'LEASE_SECRET'});const expiresAt=Date.now()+60000;mocks.resolveWithExpiry.mockResolvedValue({ok:true,token:'LEASE_SECRET',expiresAt});
 const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets',purpose:'push',branch:'feature'}));expect(r.status).toBe(200);
 const scope={organizationId:session.organizationId,actorUserId:session.userId,sessionId:session.id};
 expect(mocks.reserve).toHaveBeenCalledWith(scope,{repositoryFullName:'acme/widgets',branch:'feature',connectionId:'installation',githubInstallationId:'123',connectionRevision:mocks.installation.updatedAt.toISOString()},expect.stringMatching(/^[a-f0-9-]{36}$/));
 expect(mocks.resolveWithExpiry).toHaveBeenCalledOnce();expect(mocks.finalize).toHaveBeenCalledWith(scope,'native_git_credential_lease_'+'a'.repeat(64),expiresAt);
 expect(mocks.reserve.mock.invocationCallOrder[0]).toBeLessThan(mocks.resolveWithExpiry.mock.invocationCallOrder[0]);expect(mocks.resolveWithExpiry.mock.invocationCallOrder[0]).toBeLessThan(mocks.finalize.mock.invocationCallOrder[0]);
 expect(JSON.stringify(mocks.reserve.mock.calls)+JSON.stringify(mocks.finalize.mock.calls)).not.toContain('LEASE_SECRET');expect((await r.json()).data.cloneUrl).toContain('LEASE_SECRET');
});
it('never mints a push credential after a refused reservation',async()=>{mocks.reserve.mockRejectedValue(Error('PRIVATE_LEASE_FAILURE'));mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:'SECRET'});const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets',purpose:'push',branch:'feature'}));expect(r.status).toBe(409);expect(mocks.resolveWithExpiry).not.toHaveBeenCalled();expect(mocks.resolveTenantScopedToken).not.toHaveBeenCalled();expect(await r.text()).not.toContain('PRIVATE_LEASE_FAILURE');});
it('withholds token and never retries or clears a lease after uncertain finalization',async()=>{mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:'SECRET'});mocks.resolveWithExpiry.mockResolvedValue({ok:true,token:'SECRET',expiresAt:Date.now()+60000});mocks.finalize.mockRejectedValue(Error('private lost acknowledgment'));const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets',purpose:'push',branch:'feature'}));expect(r.status).toBe(409);expect(mocks.reserve).toHaveBeenCalledOnce();expect(mocks.resolveWithExpiry).toHaveBeenCalledOnce();expect(mocks.finalize).toHaveBeenCalledOnce();expect(await r.text()).not.toContain('SECRET');expect(mocks.recordAudit).not.toHaveBeenCalled();});
it('keeps unknown provider issuance pending rather than inventing an expiry',async()=>{mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:'SECRET'});mocks.resolveWithExpiry.mockRejectedValue(Error('unknown provider reply'));const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets',purpose:'push',branch:'feature'}));expect(r.status).toBe(409);expect(mocks.reserve).toHaveBeenCalledOnce();expect(mocks.finalize).not.toHaveBeenCalled();expect(mocks.resolveWithExpiry).toHaveBeenCalledOnce();});
it('does not start issuance after cancellation at the completed reservation boundary',async()=>{const c=new AbortController();mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:'SECRET'});mocks.reserve.mockImplementation(async()=>{c.abort();return{id:'native_git_credential_lease_'+'a'.repeat(64)}});const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets',purpose:'push',branch:'feature'},c.signal));expect(r.status).toBe(409);expect(mocks.reserve).toHaveBeenCalledOnce();expect(mocks.resolveWithExpiry).not.toHaveBeenCalled();expect(mocks.finalize).not.toHaveBeenCalled();});
it.each(['clone','pull'])('creates no write lease for %s read-only credentials',async purpose=>{mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:'READ'});const {POST}=await import('../route');expect((await POST(request({repositoryFullName:'acme/widgets',purpose}))).status).toBe(200);expect(mocks.reserve).not.toHaveBeenCalled();expect(mocks.finalize).not.toHaveBeenCalled();expect(mocks.resolveWithExpiry).not.toHaveBeenCalled();});

it.each(['session','installation','enrollment'])('rechecks %s after the reservation commit and before minting',async kind=>{mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:'SECRET'});mocks.reserve.mockImplementation(async()=>{if(kind==='session')mocks.sessionLive=false;if(kind==='installation')mocks.installation={...mocks.installation,updatedAt:new Date('2026-11-02T00:00:00Z')};if(kind==='enrollment')mocks.enrolled=true;return{id:'native_git_credential_lease_'+'a'.repeat(64)}});const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets',purpose:'push',branch:'feature'}));expect(r.status).toBe(409);expect(mocks.reserve).toHaveBeenCalledOnce();expect(mocks.resolveWithExpiry).not.toHaveBeenCalled();expect(mocks.finalize).not.toHaveBeenCalled();});

it('withholds a read credential if session expiry crosses the final database result await',async()=>{mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:'FINAL_SECRET'});const snapshot=mocks.snapshot.getMockImplementation()!;mocks.recordAudit.mockImplementation(async()=>{mocks.snapshot.mockImplementation(async(...args)=>{const rows=await snapshot(...args);const expiry=new Date(Date.now()+10);await new Promise(r=>setTimeout(r,20));return rows.map((row:any)=>({...row,sessionLive:true,expiresAt:expiry}))})});const {POST}=await import('../route');const r=await POST(request({repositoryFullName:'acme/widgets'}));expect(r.status).toBe(409);expect(await r.text()).not.toContain('FINAL_SECRET');});

});
