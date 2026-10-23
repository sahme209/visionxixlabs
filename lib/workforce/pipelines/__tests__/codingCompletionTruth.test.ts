import { afterEach, beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ read: vi.fn(), prior: vi.fn(), file: vi.fn(), open: vi.fn() }));
vi.mock("@/lib/workforce/pipelines/repoContextFetcher", () => ({ fetchRepoContext: f.read }));
vi.mock("@/lib/workforce/pipelines/githubWriteClient", () => ({ fetchFileContent: f.file, openPullRequest: f.open }));
vi.mock("@/lib/db", () => ({ prisma: { pipelineStageRun: { findFirst: f.prior } } }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: vi.fn() }));
vi.mock("@/lib/webhooks/dispatchWebhookEvent", () => ({ dispatchWebhookEvent: vi.fn() }));
import { codeReadRealExecutor } from "../codeReadRealExecutor";
import { codePrOpenRealExecutor } from "../codePrOpenRealExecutor";
const ctx = { organizationId: "org", runId: "run", stageRunId: "stage_run", pipelineId: "pipeline", stageId: "stage", stageKind: "code_read" as const, correlationId: "corr", triggeredBy: "member", runMetadata: { repoRef: "owned/repo", instruction: "Prepare a patch" } };
const patch = "--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new\n";
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("GITHUB_TOKEN", "synthetic-token"); f.prior.mockResolvedValue({ outputDetail: { proposedPatchText: patch } }); f.file.mockResolvedValue({ ok: true, content: "old\n" }); });
afterEach(() => vi.unstubAllEnvs());
it("fails the read stage when GitHub context cannot be fetched", async () => {
 f.read.mockResolvedValue({ ok: false, reason: "forbidden", detail: "synthetic unavailable repository" });
 expect(await codeReadRealExecutor(ctx)).toMatchObject({ ok: false });
});
it("fails the PR stage when no GitHub credential exists", async () => {
 vi.stubEnv("GITHUB_TOKEN", "");
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
 expect(f.open.mock.calls[0][0].prBody).not.toContain("approved by two human reviewers");
});
