import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ prior: vi.fn(), file: vi.fn() }));
vi.mock("@/lib/workforce/pipelines/githubWriteClient", () => ({ fetchFileContent: f.file }));
vi.mock("@/lib/db", () => ({ prisma: { pipelineStageRun: { findFirst: f.prior } } }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: vi.fn() }));
vi.mock("@/lib/webhooks/dispatchWebhookEvent", () => ({ dispatchWebhookEvent: vi.fn() }));
import { codeLintRealExecutor } from "../codeLintRealExecutor";
import { codeTestRealExecutor } from "../codeTestRealExecutor";
const base = { organizationId: "org", runId: "run", stageRunId: "stage_run", pipelineId: "pipeline", stageId: "stage", correlationId: "corr", triggeredBy: "member", runMetadata: { repoRef: "owned/repo" } };
const patch = (path: string) => `--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-old\n+new\n`;
beforeEach(() => { vi.resetAllMocks(); });
it.each(["lint", "test"] as const)("%s refuses missing proposal rather than passing an unavailable check", async kind => {
 f.prior.mockResolvedValue(null);
 const executor = kind === "lint" ? codeLintRealExecutor : codeTestRealExecutor;
 expect(await executor({ ...base, stageKind: kind === "lint" ? "code_lint" : "code_test" })).toMatchObject({ ok: false });
});
it.each(["lint", "test"] as const)("%s refuses a malformed proposal", async kind => {
 f.prior.mockResolvedValue({ outputDetail: { proposedPatchText: "synthetic malformed patch" } });
 const executor = kind === "lint" ? codeLintRealExecutor : codeTestRealExecutor;
 expect(await executor({ ...base, stageKind: kind === "lint" ? "code_lint" : "code_test" })).toMatchObject({ ok: false }); expect(f.file).not.toHaveBeenCalled();
});
it.each(["lint", "test"] as const)("%s cannot pass when the modified file's base is unavailable", async kind => {
 f.prior.mockResolvedValue({ outputDetail: { proposedPatchText: patch(kind === "lint" ? "package.json" : "example.test.ts") } });
 f.file.mockResolvedValue({ ok: false, reason: "fetch_failed", detail: "synthetic denied" });
 const executor = kind === "lint" ? codeLintRealExecutor : codeTestRealExecutor;
 expect(await executor({ ...base, stageKind: kind === "lint" ? "code_lint" : "code_test" })).toMatchObject({ ok: false });
});
it.each(["lint", "test"] as const)("%s cannot pass when the proposed patch cannot be applied to the base", async kind => {
 f.prior.mockResolvedValue({ outputDetail: { proposedPatchText: patch(kind === "lint" ? "package.json" : "example.test.ts") } });
 f.file.mockResolvedValue({ ok: true, content: "synthetic different base\n" });
 const executor = kind === "lint" ? codeLintRealExecutor : codeTestRealExecutor;
 expect(await executor({ ...base, stageKind: kind === "lint" ? "code_lint" : "code_test" })).toMatchObject({ ok: false });
});
it("reports that assertion integrity does not execute tests when no test files changed", async () => {
 f.prior.mockResolvedValue({ outputDetail: { proposedPatchText: patch("README.md") } });
 expect(await codeTestRealExecutor({ ...base, stageKind: "code_test" })).toMatchObject({ ok: true, detail: { testSkipped: true, testExecution: "not_run" } });
});
