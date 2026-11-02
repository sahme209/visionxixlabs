import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buildCodingArtifact } from "../codingArtifact";
const f = vi.hoisted(() => ({ read: vi.fn(), prior: vi.fn(), file: vi.fn(), open: vi.fn(), scope: vi.fn(), approved: vi.fn(), enrollment: vi.fn() }));
vi.mock("../approvedCodingArtifact",()=>({loadApprovedCodingArtifact:f.approved}));
vi.mock("@/lib/connectors/github/resolveTenantScopedToken", () => ({ resolveTenantScopedToken: f.scope }));
vi.mock("@/lib/workforce/pipelines/repoContextFetcher", () => ({ fetchRepoContext: f.read }));
vi.mock("@/lib/workforce/pipelines/githubWriteClient", () => ({ fetchFileContent: f.file, openPullRequest: f.open }));
vi.mock("@/lib/db", () => ({ prisma: { durableAgentWorkflow:{findMany:f.enrollment}, gitHubInstallation:{findFirst:async()=>({id:"installation",githubInstallationId:"123",updatedAt:new Date("2026-10-23T00:00:00Z"),revokedAt:null,suspendedAt:null})}, pipelineStageRun: { findFirst: f.prior } } }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: vi.fn() }));
vi.mock("@/lib/webhooks/dispatchWebhookEvent", () => ({ dispatchWebhookEvent: vi.fn() }));
import { codeReadRealExecutor } from "../codeReadRealExecutor";
import { codePrOpenRealExecutor } from "../codePrOpenRealExecutor";
const ctx = { organizationId: "org", runId: "run", stageRunId: "stage_run", pipelineId: "pipeline", stageId: "stage", stageKind: "code_read" as const, correlationId: "corr", triggeredBy: "member", runMetadata: { repoRef: "owned/repo", instruction: "Prepare a patch" } };
const patch = "--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new\n";
function approved(branch="main", patchText=patch, content:string|null="old\n"){return buildCodingArtifact({organizationId:"org",runId:"run",proposalStageRunId:"proposal",readStageRunId:"read",repositoryFullName:"owned/repo",baseBranch:branch,baseCommitSha:"a".repeat(40),patchText,baseFiles:[{path:"file.txt",content}]});}
beforeEach(() => { vi.resetAllMocks(); f.enrollment.mockResolvedValue([]); f.approved.mockResolvedValue(approved()); vi.stubEnv("GITHUB_TOKEN", "synthetic-token"); f.scope.mockResolvedValue({ ok: true, token: "synthetic_tenant_token" }); f.prior.mockImplementation(async ({where}) => ({ outputDetail: where.stageKind === "code_read" ? {owner:"owned",repo:"repo",branch:"main",headSha:"a".repeat(40)} : {proposedPatchText:patch} })); f.file.mockResolvedValue({ ok: true, content: "old\n" }); });
afterEach(() => vi.unstubAllEnvs());
it("fails the read stage when GitHub context cannot be fetched", async () => {
 f.read.mockResolvedValue({ ok: false, reason: "forbidden", detail: "synthetic unavailable repository" });
 expect(await codeReadRealExecutor(ctx)).toMatchObject({ ok: false });
});
it("fails the PR stage when no workspace GitHub connection exists", async () => {
 f.scope.mockResolvedValue({ ok: false, error: "github_not_connected" });
 expect(await codePrOpenRealExecutor({ ...ctx, stageKind: "code_pr_open" })).toMatchObject({ ok: false }); expect(f.open).not.toHaveBeenCalled();
});
it("does not mark failed branch/PR creation as a successful pipeline stage", async () => {
 f.open.mockResolvedValue({ ok: false, reason: "pull_request_create_failed", detail: "synthetic denied response" });
 expect(await codePrOpenRealExecutor({ ...ctx, stageKind: "code_pr_open" })).toMatchObject({ ok: false, detail: { repositoryWriteOutcome: "unknown" } });
});
it("fails an invalid patch without invoking a repository write", async () => {
 f.prior.mockResolvedValue({ outputDetail: { proposedPatchText: "synthetic malformed patch" } });
 expect(await codePrOpenRealExecutor({ ...ctx, stageKind: "code_pr_open" })).toMatchObject({ ok: false }); expect(f.open).not.toHaveBeenCalled();
});
it("retains successful PR completion only for a confirmed GitHub response", async () => {
 f.open.mockResolvedValue({ ok: true, prNumber: 12, prUrl: "https://github.com/owned/repo/pull/12", headSha: "synthetic_sha" });
 expect(await codePrOpenRealExecutor({ ...ctx, stageKind: "code_pr_open" })).toMatchObject({ ok: true, detail: { pushed: true, prNumber: 12 } });
 expect(typeof f.open.mock.calls[0][0].resolveToken).toBe("function");
 expect(f.scope).toHaveBeenCalledWith("org", { owner: "owned", repo: "repo" }, expect.objectContaining({id:"installation",githubInstallationId:"123"}));
 expect(f.open.mock.calls[0][0].prBody).not.toContain("approved by two human reviewers");
});

it("refuses a revoked workspace connection immediately before a PR write", async () => {
 f.scope.mockResolvedValueOnce({ ok: true, token: "synthetic_tenant_token" }).mockResolvedValueOnce({ ok: true, token: "synthetic_tenant_token" }).mockResolvedValueOnce({ ok: false, error: "github_not_connected" });
 expect(await codePrOpenRealExecutor({ ...ctx, stageKind: "code_pr_open" })).toMatchObject({ ok: false, detail: { repositoryWriteOutcome: "not_attempted" } });
 expect(f.file).toHaveBeenCalledOnce(); expect(f.open).not.toHaveBeenCalled();
});
it("refuses repository context without a workspace connection despite a platform token", async () => {
 f.scope.mockResolvedValue({ ok: false, error: "github_not_connected" });
 expect(await codeReadRealExecutor(ctx)).toMatchObject({ ok: false }); expect(f.read).not.toHaveBeenCalled();
});
it("supplies only the scoped workspace token to repository context reads", async () => {
 f.read.mockResolvedValue({ ok: true, snapshot: { owner: "owned", repo: "repo", defaultBranch: "main", branch: "main", headSha: "synthetic_sha", tree: [], treeTruncated: false, recentCommits: [], keyFiles: [] } });
 expect(await codeReadRealExecutor(ctx)).toMatchObject({ ok: true });
 expect(f.scope).toHaveBeenCalledWith("org", { owner: "owned", repo: "repo" }, expect.objectContaining({id:"installation",permissionProfile:"contents_read"}));
 expect(f.read).toHaveBeenCalledWith("owned/repo", null, "synthetic_tenant_token");
});
it("requires a saved immutable repository read before attempting a PR", async () => {
 f.prior.mockImplementation(async ({where}) => where.stageKind === "code_read" ? null : {outputDetail:{proposedPatchText:patch}});
 f.open.mockResolvedValue({ok:true,prNumber:12,prUrl:"https://github.com/owned/repo/pull/12",headSha:"a".repeat(40)});
 expect(await codePrOpenRealExecutor({...ctx,stageKind:"code_pr_open"})).toMatchObject({ok:false,detail:{repositoryWriteOutcome:"not_attempted"}});
 expect(f.file).not.toHaveBeenCalled();expect(f.open).not.toHaveBeenCalled();
});
it("applies the patch only to the saved commit and sends that parent expectation to the writer", async () => {
 f.approved.mockResolvedValue(approved("stable"));
 f.prior.mockImplementation(async ({where}) => ({outputDetail:where.stageKind === "code_read" ? {owner:"owned",repo:"repo",branch:"stable",headSha:"a".repeat(40)} : {proposedPatchText:patch}}));
 f.open.mockResolvedValue({ok:true,prNumber:12,prUrl:"https://github.com/owned/repo/pull/12",headSha:"b".repeat(40)});
 expect(await codePrOpenRealExecutor({...ctx,stageKind:"code_pr_open"})).toMatchObject({ok:true});
 expect(f.file).toHaveBeenCalledWith("owned","repo","file.txt","a".repeat(40),"synthetic_tenant_token");
 expect(f.open).toHaveBeenCalledWith(expect.objectContaining({baseBranch:"stable",expectedBaseSha:"a".repeat(40)}));
});
it("reports a refused moved-base check as no write attempted", async () => {
 f.open.mockResolvedValue({ok:false,reason:"base_changed",detail:"synthetic moved base"});
 expect(await codePrOpenRealExecutor({...ctx,stageKind:"code_pr_open"})).toMatchObject({ok:false,detail:{repositoryWriteOutcome:"not_attempted"}});
});
it("cannot overwrite an existing pinned path by labeling the patch as an added file", async () => {
 const added="--- /dev/null\n+++ b/file.txt\n@@ -0,0 +1 @@\n+replacement\n";
 f.approved.mockResolvedValue(approved("main",added,null));
 f.prior.mockImplementation(async ({where})=>({outputDetail:where.stageKind === "code_read" ? {owner:"owned",repo:"repo",branch:"main",headSha:"a".repeat(40)} : {proposedPatchText:added}}));
 f.file.mockResolvedValue({ok:true,content:"existing protected content\n"});f.open.mockResolvedValue({ok:true,prNumber:12,prUrl:"https://github.com/owned/repo/pull/12",headSha:"b".repeat(40)});
 expect(await codePrOpenRealExecutor({...ctx,stageKind:"code_pr_open"})).toMatchObject({ok:false,detail:{repositoryWriteOutcome:"not_attempted"}});
 expect(f.file).toHaveBeenCalledWith("owned","repo","file.txt","a".repeat(40),"synthetic_tenant_token");expect(f.open).not.toHaveBeenCalled();
});
it("refuses deleting a path absent from the saved commit", async () => {
 const deleted="--- a/file.txt\n+++ /dev/null\n@@ -1 +0,0 @@\n-old\n";
 f.approved.mockResolvedValue(approved("main",deleted));
 f.prior.mockImplementation(async ({where})=>({outputDetail:where.stageKind === "code_read" ? {owner:"owned",repo:"repo",branch:"main",headSha:"a".repeat(40)} : {proposedPatchText:deleted}}));
 f.file.mockResolvedValue({ok:true,content:null});f.open.mockResolvedValue({ok:true,prNumber:12,prUrl:"https://github.com/owned/repo/pull/12",headSha:"b".repeat(40)});
 expect(await codePrOpenRealExecutor({...ctx,stageKind:"code_pr_open"})).toMatchObject({ok:false,detail:{repositoryWriteOutcome:"not_attempted"}});expect(f.open).not.toHaveBeenCalled();
});

it("refuses PR execution without exact durable artifact approval",async()=>{
 f.approved.mockResolvedValue({ok:false,error:"coding_artifact_approval_unavailable"});f.open.mockResolvedValue({ok:true,prNumber:12,prUrl:"https://github.com/owned/repo/pull/12",headSha:"b".repeat(40)});
 expect(await codePrOpenRealExecutor({...ctx,stageKind:"code_pr_open"})).toMatchObject({ok:false,detail:{repositoryWriteOutcome:"not_attempted"}});expect(f.open).not.toHaveBeenCalled();
});
it("refuses a different proposal after the frozen artifact was approved",async()=>{
 f.prior.mockImplementation(async({where})=>({outputDetail:where.stageKind==="code_read"?{owner:"owned",repo:"repo",branch:"main",headSha:"a".repeat(40)}:{proposedPatchText:patch.replace("new","substituted")}}));
 f.open.mockResolvedValue({ok:true,prNumber:12,prUrl:"https://github.com/owned/repo/pull/12",headSha:"b".repeat(40)});
 expect(await codePrOpenRealExecutor({...ctx,stageKind:"code_pr_open"})).toMatchObject({ok:false,detail:{repositoryWriteOutcome:"not_attempted"}});expect(f.open).not.toHaveBeenCalled();
});

it("rechecks approved artifact authority inside each writer authorization callback",async()=>{
 f.approved.mockResolvedValueOnce(approved()).mockResolvedValue({ok:false,error:"coding_artifact_approval_unavailable"});
 f.open.mockImplementation(async(input)=>{const current=await input.resolveToken();return current.ok?{ok:true,prNumber:12,prUrl:"https://github.com/owned/repo/pull/12",headSha:"b".repeat(40)}:{ok:false,reason:"authority_changed",writeMayHaveOccurred:false,detail:"synthetic revoked review"};});
 expect(await codePrOpenRealExecutor({...ctx,stageKind:"code_pr_open"})).toMatchObject({ok:false,detail:{repositoryWriteOutcome:"not_attempted"}});expect(f.approved).toHaveBeenCalledTimes(2);
});

// Empty metadata proves only that this synthetic workspace is not enrolled;
// neither that fixture nor a token can bypass a present/unavailable safety fence.
it.each(['enrolled','unavailable'])('refuses coding writes when Governance metadata is %s',async state=>{
 if(state==='enrolled')f.enrollment.mockResolvedValue([{id:'governance_active_fixture',organizationId:'org',workflowKind:'governance_baseline_active_v1'}]);
 else f.enrollment.mockRejectedValue(Error('synthetic metadata unavailable'));
 expect(await codePrOpenRealExecutor({...ctx,stageKind:'code_pr_open'})).toMatchObject({ok:false,detail:{repositoryWriteOutcome:'not_attempted'}});
 expect(f.enrollment).toHaveBeenCalledOnce();expect(f.scope).not.toHaveBeenCalled();expect(f.open).not.toHaveBeenCalled();
});
