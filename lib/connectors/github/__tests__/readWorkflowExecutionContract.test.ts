import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ token: vi.fn(), file: vi.fn() }));
vi.mock("../resolveTenantScopedToken", () => ({ resolveTenantScopedToken: mocks.token, parseRepositoryFullName: (name: string) => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name) ? { owner: name.split("/")[0], repo: name.split("/")[1] } : null }));
vi.mock("../githubWriteClient", () => ({ getFile: mocks.file }));
import { readWorkflowExecutionContract } from "../readWorkflowExecutionContract";
const content = "on: workflow_dispatch\n";
const sha = createHash("sha1").update(`blob ${Buffer.byteLength(content)}\0${content}`).digest("hex");
const source = { repositoryFullName: "team/service", ref: "release/v1", path: ".github/workflows/release.yml", blobSha: sha };
const signal = new AbortController().signal;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.token.mockResolvedValue({ ok: true, token: "private-token" });
  mocks.file.mockResolvedValue({ ok: true, data: { path: source.path, sha, content } });
});
const read = (extra = {}) => readWorkflowExecutionContract({ organizationId: "tenant-one", source, inputs: {}, signal, ...extra });
it("reads the requested source using tenant-scoped authorization, then validates actual blob bytes", async () => {
  expect(await read()).toEqual({ ok: true, source, inputs: {} });
  expect(mocks.token).toHaveBeenCalledWith("tenant-one", { owner: "team", repo: "service" });
  expect(mocks.file).toHaveBeenCalledWith({ owner: "team", repo: "service", branch: source.ref, path: source.path, installationToken: "private-token", read: { signal, maxBytes: 200_000 } });
});
it("does not fetch when the tenant has no authorized repository connection", async () => {
  mocks.token.mockResolvedValue({ ok: false, error: "github_not_connected" });
  expect((await read()).ok).toBe(false); expect(mocks.file).not.toHaveBeenCalled();
});
it.each([{ source: { ...source, repositoryFullName: "invalid" } }, { source: { ...source, path: "../outside.yml" } }, { source: { ...source, blobSha: "bad" } }, { organizationId: "" }])("refuses invalid source/tenant before any token or provider request", async extra => {
  expect((await read(extra)).ok).toBe(false); expect(mocks.token).not.toHaveBeenCalled(); expect(mocks.file).not.toHaveBeenCalled();
});
it.each([{ path: "outside.yml", sha, content }, { path: source.path, sha: "b".repeat(40), content }, { path: source.path, sha, content: "on: push\n" }])("rejects changed provider source or content", async data => {
  mocks.file.mockResolvedValue({ ok: true, data }); expect((await read()).ok).toBe(false);
});
it("sanitizes rejected provider diagnostics and token exceptions", async () => {
  mocks.file.mockRejectedValue(new Error("private-token"));
  expect(await read()).toEqual({ ok: false, error: "workflow_execution_contract_unavailable" });
  mocks.token.mockRejectedValue(new Error("private-token"));
  expect(await read()).toEqual({ ok: false, error: "workflow_execution_contract_unavailable" });
});
it("does not continue after an aborted caller", async () => {
  const controller = new AbortController(); controller.abort();
  expect((await read({ signal: controller.signal })).ok).toBe(false); expect(mocks.token).not.toHaveBeenCalled();
});
