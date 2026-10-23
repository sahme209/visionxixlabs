import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ prior: vi.fn(), file: vi.fn() }));
vi.mock("@/lib/connectors/github/resolveTenantScopedToken", () => ({ resolveTenantScopedToken: async () => ({ ok: true, token: "synthetic_tenant_token" }) }));
vi.mock("@/lib/workforce/pipelines/githubWriteClient", () => ({ fetchFileContent: f.file }));
vi.mock("@/lib/db", () => ({ prisma: { gitHubInstallation:{findFirst:async()=>({id:"installation",githubInstallationId:"123",updatedAt:new Date("2026-10-23T00:00:00Z"),revokedAt:null,suspendedAt:null})}, pipelineStageRun: { findFirst: f.prior } } }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: vi.fn() }));
vi.mock("@/lib/webhooks/dispatchWebhookEvent", () => ({ dispatchWebhookEvent: vi.fn() }));
import { codeLintRealExecutor } from "../codeLintRealExecutor";
import { codeTestRealExecutor } from "../codeTestRealExecutor";
const base = { organizationId: "org", runId: "run", stageRunId: "stage_run", pipelineId: "pipeline", stageId: "stage", correlationId: "corr", triggeredBy: "member", runMetadata: { repoRef: "owned/repo" } };
const patch = (path: string) => `--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-old\n+new\n`;
function priorProposal(value: unknown) {
 f.prior.mockImplementation(async ({where}) => where.stageKind === "code_read" ? {outputDetail:{owner:"owned",repo:"repo",branch:"main",headSha:"a".repeat(40)}} : value);
}
beforeEach(() => { vi.resetAllMocks(); });
it.each(["lint", "test"] as const)("%s refuses missing proposal rather than passing an unavailable check", async kind => {
 priorProposal(null);
 const executor = kind === "lint" ? codeLintRealExecutor : codeTestRealExecutor;
 expect(await executor({ ...base, stageKind: kind === "lint" ? "code_lint" : "code_test" })).toMatchObject({ ok: false });
});
it.each(["lint", "test"] as const)("%s refuses a malformed proposal", async kind => {
 priorProposal({ outputDetail: { proposedPatchText: "synthetic malformed patch" } });
 const executor = kind === "lint" ? codeLintRealExecutor : codeTestRealExecutor;
 expect(await executor({ ...base, stageKind: kind === "lint" ? "code_lint" : "code_test" })).toMatchObject({ ok: false }); expect(f.file).not.toHaveBeenCalled();
});
it.each(["lint", "test"] as const)("%s cannot pass when the modified file's base is unavailable", async kind => {
 priorProposal({ outputDetail: { proposedPatchText: patch(kind === "lint" ? "package.json" : "example.test.ts") } });
 f.file.mockResolvedValue({ ok: false, reason: "fetch_failed", detail: "synthetic denied" });
 const executor = kind === "lint" ? codeLintRealExecutor : codeTestRealExecutor;
 expect(await executor({ ...base, stageKind: kind === "lint" ? "code_lint" : "code_test" })).toMatchObject({ ok: false });
});
it.each(["lint", "test"] as const)("%s cannot pass when the proposed patch cannot be applied to the base", async kind => {
 priorProposal({ outputDetail: { proposedPatchText: patch(kind === "lint" ? "package.json" : "example.test.ts") } });
 f.file.mockResolvedValue({ ok: true, content: "synthetic different base\n" });
 const executor = kind === "lint" ? codeLintRealExecutor : codeTestRealExecutor;
 expect(await executor({ ...base, stageKind: kind === "lint" ? "code_lint" : "code_test" })).toMatchObject({ ok: false });
});
it("reports that assertion integrity does not execute tests when no test files changed", async () => {
 priorProposal({ outputDetail: { proposedPatchText: patch("README.md") } });
 expect(await codeTestRealExecutor({ ...base, stageKind: "code_test" })).toMatchObject({ ok: true, detail: { testSkipped: true, testExecution: "not_run" } });
});
it.each(["lint", "test"] as const)("%s reads its validation base from the same immutable saved commit", async kind => {
 f.prior.mockImplementation(async ({where}) => ({outputDetail:where.stageKind === "code_read" ? {owner:"owned",repo:"repo",branch:"stable",headSha:"a".repeat(40)} : {proposedPatchText:patch(kind === "lint" ? "package.json" : "example.test.ts")}}));
 f.file.mockResolvedValue({ok:true,content:"old\n"});
 await (kind === "lint" ? codeLintRealExecutor : codeTestRealExecutor)({...base,stageKind:kind === "lint" ? "code_lint" : "code_test"});
 expect(f.file).toHaveBeenCalledWith("owned","repo",kind === "lint" ? "package.json" : "example.test.ts","a".repeat(40),"synthetic_tenant_token");
 expect(f.prior.mock.calls.filter(([query])=>query.where.stageKind === "code_read")).toHaveLength(1);
});
it.each(["lint", "test"] as const)("%s records the exact proposal and saved base its result describes",async kind=>{
 priorProposal({outputDetail:{proposedPatchText:patch("README.md")}});
 const result=await (kind === "lint" ? codeLintRealExecutor : codeTestRealExecutor)({...base,stageKind:kind === "lint" ? "code_lint" : "code_test"});
 expect(result).toMatchObject({ok:true,detail:{codingValidation:{schema:1,repositoryFullName:"owned/repo",baseBranch:"main",baseCommitSha:"a".repeat(40),patchSha256:expect.stringMatching(/^[a-f0-9]{64}$/)}}});
});
