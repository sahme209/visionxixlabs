import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  findEnvironment: vi.fn(),
  installation: vi.fn(),
  snapshot: vi.fn(),
  enrollment: vi.fn(),
  findTarget: vi.fn(),
  resolveTenantScopedToken: vi.fn(),
  dispatchWorkflow: vi.fn(),
  resolveGitReference: vi.fn(),
  findRepositories: vi.fn(),
  findBranchPolicies: vi.fn(),
  recordAudit: vi.fn(async (
    _repo: import("@/lib/releaseops/auditEventResponder").AuditEventRepo,
    _input: import("@/lib/releaseops/auditEventResponder").AppendAuditEventInput,
  ) => true),
  reserveDeploymentDispatch: vi.fn(),
  releaseDeploymentDispatch: vi.fn(),
  settleDeploymentDispatch: vi.fn(),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({
  resolveRequestDesktopSession: mocks.resolveRequestDesktopSession,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: mocks.snapshot,
    gitHubInstallation: {findFirst:mocks.installation},
    environment: { findUnique: mocks.findEnvironment },
    durableAgentWorkflow: { findMany: mocks.enrollment },
    deploymentTarget: { findUnique: mocks.findTarget },
    repository: { findMany: mocks.findRepositories },
    branchEnvironmentPolicy: { findMany: mocks.findBranchPolicies },
  },
}));
vi.mock("@/lib/connectors/github/resolveTenantScopedToken", async () => {
  const actual = await vi.importActual<typeof import("@/lib/connectors/github/resolveTenantScopedToken")>(
    "@/lib/connectors/github/resolveTenantScopedToken",
  );
  return { ...actual, resolveTenantScopedToken: mocks.resolveTenantScopedToken };
});
vi.mock("@/lib/connectors/github/githubWriteClient", () => ({
  dispatchWorkflow: mocks.dispatchWorkflow,
  resolveGitReference: mocks.resolveGitReference,
}));
vi.mock("@/lib/releaseops/auditEventResponder", async () => {
  const actual = await vi.importActual<typeof import("@/lib/releaseops/auditEventResponder")>(
    "@/lib/releaseops/auditEventResponder",
  );
  return { ...actual, appendAuditEvent: mocks.recordAudit };
});
vi.mock("@/lib/billing/deploymentDispatchReservation", () => ({
  reserveDeploymentDispatch: mocks.reserveDeploymentDispatch,
  releaseDeploymentDispatch: mocks.releaseDeploymentDispatch,
  settleDeploymentDispatch: mocks.settleDeploymentDispatch,
}));

function request(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/environments/deploy", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "test-deploy-key" },
    body: JSON.stringify(body),
  });
}

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const, capabilities: ["deploy:execute"] };
const adminSession = { ...session, capabilities: ["deploy:execute", "deploy:production_bypass"] };
const target = { id: "dt_1", organizationId: "org-1", environmentId: "env_1", provider: "aws", roleArn: "arn:aws:iam::123456789012:role/axiom-deploy", region: "us-east-2", ecsCluster: "axiom-prod-cluster", ecsService: "axiom-web-service" };

describe("POST /api/desktop/environments/deploy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.installation.mockReset().mockResolvedValue({id:"connection",githubInstallationId:"123",updatedAt:new Date("2026-11-01T00:00:00Z"),revokedAt:null,suspendedAt:null});
    mocks.snapshot.mockReset().mockResolvedValue([{sessionId:session.id,userId:session.userId,organizationId:session.organizationId,sessionLive:true,role:"admin",acceptedAt:new Date(),connectionId:"connection",githubInstallationId:"123",connectionRevision:new Date("2026-11-01T00:00:00Z"),connectionRevokedAt:null,connectionSuspendedAt:null,connectionStatus:"active",enrolled:false}]);
    mocks.enrollment.mockReset().mockResolvedValue([]);
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
    mocks.findRepositories.mockResolvedValue([]);
    mocks.findBranchPolicies.mockResolvedValue([]);
    mocks.resolveGitReference.mockResolvedValue({ ok: true, data: { kind: "branch", ref: "main", commitSha: "sha-main" } });
    mocks.reserveDeploymentDispatch.mockResolvedValue({
      ok: true,
      reused: false,
      reservation: { id: "exec-1" },
      planId: "free",
      used: 0,
      limit: 10,
    });
    mocks.releaseDeploymentDispatch.mockResolvedValue(true);
    mocks.settleDeploymentDispatch.mockResolvedValue(false);
  });

  it("refuses explicit artifact promotion before reserving or dispatching even for an emergency restart", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(adminSession);
    mocks.findEnvironment.mockResolvedValue({id:"env_1",organizationId:"org-1",tier:"prod"});
    mocks.findTarget.mockResolvedValue(target);
    mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:"fixture"});
    const {POST} = await import("../route");
    const response = await POST(request({repositoryFullName:"acme/widgets",environmentId:"env_1",sourceRef:"main",sourceKind:"branch",promotedFromExecutionId:"successful-same-source",emergencyBypass:true,bypassReason:"Emergency restart does not attest an artifact"}));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("branch_policy_promotion_artifact_unverified");
    expect(mocks.reserveDeploymentDispatch).not.toHaveBeenCalled(); expect(mocks.dispatchWorkflow).not.toHaveBeenCalled();
  });

  it("emergency restart cannot omit the ID to bypass a server-required promotion", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(adminSession);
    mocks.findEnvironment.mockResolvedValue({id:"env_1",organizationId:"org-1",tier:"prod"}); mocks.findTarget.mockResolvedValue(target);
    mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:"fixture"});
    mocks.findRepositories.mockResolvedValue([{id:"repo",remoteOwner:"acme",remoteName:"widgets"}]);
    mocks.findBranchPolicies.mockResolvedValue([{branchPattern:"*",requirePromotionFromEnvironmentId:"dev"}]);
    const {POST} = await import("../route"); const response = await POST(request({repositoryFullName:"acme/widgets",environmentId:"env_1",sourceRef:"main",sourceKind:"branch",emergencyBypass:true,bypassReason:"Emergency must not fabricate artifact promotion"}));
    expect(response.status).toBe(409); expect((await response.json()).error).toBe("branch_policy_promotion_artifact_unverified");
    expect(mocks.reserveDeploymentDispatch).not.toHaveBeenCalled(); expect(mocks.dispatchWorkflow).not.toHaveBeenCalled();
  });
  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets", environmentId: "env_1" }));
    expect(res.status).toBe(401);
  });

  it("rejects an invalid payload", async () => {
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets" }));
    expect(res.status).toBe(400);
  });

  it("404s when the environment doesn't exist or belongs to another org", async () => {
    mocks.findEnvironment.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets", environmentId: "env_1" }));
    expect(res.status).toBe(404);
  });

  it("409s when no deployment target is configured for the environment", async () => {
    mocks.findEnvironment.mockResolvedValue({ id: "env_1", organizationId: "org-1" });
    mocks.findTarget.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets", environmentId: "env_1" }));
    expect(res.status).toBe(409);
  });

  it("dispatches the workflow with the target's config and audits it", async () => {
    mocks.findEnvironment.mockResolvedValue({ id: "env_1", organizationId: "org-1" });
    mocks.findTarget.mockResolvedValue(target);
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
    mocks.dispatchWorkflow.mockResolvedValue({ ok: true, data: { workflowRunId: "123", runUrl: "https://api.github.test/runs/123", htmlUrl: "https://github.test/runs/123" } });

    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets", environmentId: "env_1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mocks.dispatchWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      owner: "acme", repo: "widgets",
      ref: "main",
      inputs: { role_arn: target.roleArn, region: target.region, cluster: target.ecsCluster, service: target.ecsService },
      installationToken: "installation-token",
    }));
    const auditCall = mocks.recordAudit.mock.calls[0][1];
    expect(auditCall.kind).toBe("release.deploy_triggered");
    expect(JSON.stringify(auditCall)).not.toContain("installation-token");
  });

  it("fails closed when a configured branch policy does not match", async () => {
    mocks.findEnvironment.mockResolvedValue({ id: "env_1", organizationId: "org-1" });
    mocks.findTarget.mockResolvedValue(target);
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
    mocks.findRepositories.mockResolvedValue([{ id: "repo_1", organizationId: "org-1", provider: "github", remoteOwner: "acme", remoteName: "widgets" }]);
    mocks.findBranchPolicies.mockResolvedValue([{ id: "policy_1", branchPattern: "release/*", requireReleaseTag: false, requireCodeowners: false, requirePrLink: false, requireChangeTicket: false, priority: 100 }]);

    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets", environmentId: "env_1", sourceRef: "main", sourceKind: "branch" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ ok: false, error: "branch_policy_no_matching_ref" });
    expect(mocks.dispatchWorkflow).not.toHaveBeenCalled();
  });

  it("502s and skips the audit when GitHub rejects the dispatch", async () => {
    mocks.findEnvironment.mockResolvedValue({ id: "env_1", organizationId: "org-1" });
    mocks.findTarget.mockResolvedValue(target);
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
    mocks.dispatchWorkflow.mockResolvedValue({ ok: false, error: "workflow_dispatch_failed: github_404" });

    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets", environmentId: "env_1" }));
    expect(res.status).toBe(502);
    expect(mocks.recordAudit).not.toHaveBeenCalled();
    expect(mocks.releaseDeploymentDispatch).toHaveBeenCalledWith(expect.anything(), "org-1", "exec-1");
  });

  it.each(["workflow_dispatch_failed: fetch failed", "workflow_dispatch_failed: github_503: unavailable"])("retains the reservation when dispatch outcome is uncertain: %s", async (error) => {
    mocks.findEnvironment.mockResolvedValue({ id: "env_1", organizationId: "org-1" });
    mocks.findTarget.mockResolvedValue(target);
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
    mocks.dispatchWorkflow.mockResolvedValue({ ok: false, error });
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets", environmentId: "env_1" }));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ ok: false, error: "deployment_outcome_unknown" });
    expect(mocks.releaseDeploymentDispatch).not.toHaveBeenCalled();
  });

  it("blocks before workflow dispatch when the deployment allowance is exhausted", async () => {
    mocks.findEnvironment.mockResolvedValue({ id: "env_1", organizationId: "org-1" });
    mocks.findTarget.mockResolvedValue(target);
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
    mocks.reserveDeploymentDispatch.mockResolvedValue({ ok: false, error: "deployment_quota_exhausted", used: 10, limit: 10 });

    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets", environmentId: "env_1" }));
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toMatchObject({ error: "deployment_quota_exhausted" });
    expect(mocks.dispatchWorkflow).not.toHaveBeenCalled();
  });

  it("allows only an authorized admin to request a production bypass", async () => {
    mocks.findEnvironment.mockResolvedValue({ id: "env_1", organizationId: "org-1", tier: "prod" });
    const { POST } = await import("../route");
    const res = await POST(request({
      repositoryFullName: "acme/widgets",
      environmentId: "env_1",
      emergencyBypass: true,
      bypassReason: "Customer incident requires an immediate recovery deployment.",
    }));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ error: "production_bypass_forbidden" });
    expect(mocks.dispatchWorkflow).not.toHaveBeenCalled();
  });

  it("fails closed when a production bypass cannot be durably audited", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(adminSession);
    mocks.findEnvironment.mockResolvedValue({ id: "env_1", organizationId: "org-1", tier: "prod" });
    mocks.findTarget.mockResolvedValue(target);
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
    mocks.recordAudit.mockResolvedValueOnce(false);

    const { POST } = await import("../route");
    const res = await POST(request({
      repositoryFullName: "acme/widgets",
      environmentId: "env_1",
      emergencyBypass: true,
      bypassReason: "Customer incident requires an immediate recovery deployment.",
    }));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ error: "production_bypass_audit_unavailable" });
    expect(mocks.dispatchWorkflow).not.toHaveBeenCalled();
  });
  it.each(["enrolled", "unavailable"])("refuses %s governance before credentials or reservation, including emergency policy bypass", async state => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(adminSession);
    mocks.findEnvironment.mockResolvedValue({id:"env_1",organizationId:"org-1",tier:"prod"});
    mocks.findTarget.mockResolvedValue(target);
    if(state === "enrolled") mocks.enrollment.mockResolvedValue([{id:"governance_active_org",organizationId:"org-1",workflowKind:"governance_baseline_active_v1"}]);
    else mocks.enrollment.mockRejectedValue(Error("private storage detail"));
    const {POST}=await import("../route");
    const response=await POST(request({repositoryFullName:"acme/widgets",environmentId:"env_1",emergencyBypass:true,bypassReason:"Emergency policy exception cannot bypass governance"}));
    expect(response.status).toBe(409);
    expect(await response.text()).toContain("governance_execution_coverage_unavailable");
    expect(mocks.resolveTenantScopedToken).not.toHaveBeenCalled();
    expect(mocks.reserveDeploymentDispatch).not.toHaveBeenCalled();
    expect(mocks.dispatchWorkflow).not.toHaveBeenCalled();
  });

  it("rechecks after reservation and releases only a definite pre-dispatch refusal", async()=>{
    mocks.findEnvironment.mockResolvedValue({id:"env_1",organizationId:"org-1"});
    mocks.findTarget.mockResolvedValue(target);
    mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:"fixture"});

    mocks.dispatchWorkflow.mockImplementationOnce(async input=>{
      mocks.enrollment.mockResolvedValue([{id:"governance_active_org",organizationId:"org-1",workflowKind:"governance_baseline_active_v1"}]);
      try { await input.beforeWrite(); throw Error("test must refuse before provider dispatch"); }
      catch(error) { expect(String(error)).toContain("governance_execution_coverage_unavailable"); return {ok:false,error:"workflow_dispatch_failed: github_write_authority_unavailable"}; }
    });
    const {POST}=await import("../route");
    const response=await POST(request({repositoryFullName:"acme/widgets",environmentId:"env_1"}));
    expect(response.status).toBe(502);
    expect(mocks.enrollment).toHaveBeenCalled();
    expect(mocks.releaseDeploymentDispatch).toHaveBeenCalledWith(expect.anything(),"org-1","exec-1");
    expect(mocks.settleDeploymentDispatch).not.toHaveBeenCalled();
  });

  it('binds deployment token issuance to the captured installation',async()=>{
    mocks.findEnvironment.mockResolvedValue({id:'env_1',organizationId:'org-1'});mocks.findTarget.mockResolvedValue(target);mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:'fixture'});mocks.dispatchWorkflow.mockResolvedValue({ok:true,data:{workflowRunId:'123'}});
    const {POST}=await import('../route');expect((await POST(request({repositoryFullName:'acme/widgets',environmentId:'env_1'}))).status).toBe(200);
    expect(mocks.resolveTenantScopedToken).toHaveBeenCalledWith('org-1',{owner:'acme',repo:'widgets'},expect.objectContaining({id:'connection',githubInstallationId:'123',signal:expect.any(AbortSignal)}),expect.any(Object));
  });
  it.each([false,true])('rechecks current deployment and emergency rights after reservation (bypass=%s)',async emergency=>{
    mocks.resolveRequestDesktopSession.mockResolvedValue(emergency?adminSession:session);
    mocks.findEnvironment.mockResolvedValue({id:'env_1',organizationId:'org-1',tier:emergency?'prod':'dev'});mocks.findTarget.mockResolvedValue(target);mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:'fixture'});
    mocks.reserveDeploymentDispatch.mockImplementationOnce(async()=>{mocks.resolveRequestDesktopSession.mockResolvedValue({...session,capabilities:emergency?['deploy:execute']:['github:write']});return{ok:true,reused:false,reservation:{id:'exec-1'},planId:'free',used:0,limit:10}});
    mocks.dispatchWorkflow.mockImplementationOnce(async input=>{try{await input.beforeWrite();return{ok:true,data:{workflowRunId:'123'}}}catch{return{ok:false,error:'workflow_dispatch_failed: github_write_authority_unavailable'}}});
    const {POST}=await import('../route');const res=await POST(request({repositoryFullName:'acme/widgets',environmentId:'env_1',emergencyBypass:emergency,bypassReason:'A legitimate incident still needs current deployment authority.'}));
    expect(res.status).toBe(502);expect(mocks.releaseDeploymentDispatch).toHaveBeenCalledWith(expect.anything(),'org-1','exec-1');expect(mocks.settleDeploymentDispatch).not.toHaveBeenCalled();
  });

  it.each(['revoked_before_send','lost_response_after_send'])('uses the actual transport and preserves reservation semantics for %s',async state=>{
    mocks.findEnvironment.mockResolvedValue({id:'env_1',organizationId:'org-1',tier:'dev'});mocks.findTarget.mockResolvedValue(target);mocks.resolveTenantScopedToken.mockResolvedValue({ok:true,token:'synthetic-fixture-token'});
    mocks.reserveDeploymentDispatch.mockImplementationOnce(async()=>{if(state==='revoked_before_send')mocks.resolveRequestDesktopSession.mockResolvedValue(null);return{ok:true,reused:false,reservation:{id:'exec-1'},planId:'free',used:0,limit:10}});
    const actual=await vi.importActual<typeof import('@/lib/connectors/github/githubWriteClient')>('@/lib/connectors/github/githubWriteClient');
    mocks.dispatchWorkflow.mockImplementationOnce(actual.dispatchWorkflow);
    const provider=vi.fn(async(_url:unknown,_init:unknown)=>{throw Error('synthetic lost provider response')});vi.stubGlobal('fetch',provider);
    try{
      const {POST}=await import('../route');const res=await POST(request({repositoryFullName:'acme/widgets',environmentId:'env_1'}));expect(res.status).toBe(502);
      if(state==='revoked_before_send'){expect(provider).not.toHaveBeenCalled();expect(mocks.releaseDeploymentDispatch).toHaveBeenCalledWith(expect.anything(),'org-1','exec-1')}
      else{expect(provider).toHaveBeenCalledOnce();expect(provider.mock.calls[0]?.[1]).toMatchObject({method:'POST'});expect(mocks.releaseDeploymentDispatch).not.toHaveBeenCalled();expect(await res.json()).toMatchObject({error:'deployment_outcome_unknown'})}
      expect(mocks.settleDeploymentDispatch).not.toHaveBeenCalled();
    }finally{vi.unstubAllGlobals()}
  });

});
