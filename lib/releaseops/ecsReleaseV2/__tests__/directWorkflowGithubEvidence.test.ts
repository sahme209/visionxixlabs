import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { createGithubBuildEvidenceReader, type GithubBuildRequest, type GithubBuildSnapshot } from "../githubBuildEvidence";
import { directBinding, directBytes, directNow, directProfile, directWorkflow } from "./fixtures/directWorkflowFixture";
const { organizationId, sourceRef, ...expected } = directBinding;
const scope = { organizationId, userId: "direct-fixture-admin" };
const date = "2026-10-16T00:00:00Z", policyDigest = `sha256:${"c".repeat(64)}`;
const request: GithubBuildRequest = { repositoryRecordId: "direct-repo-row", environmentId: "direct-stage", policyDigest, expected };
const api = `https://api.github.com/repos/${directBinding.repositoryFullName}`;
const bundleUrl = `https://reviewed.blob.core.windows.net/attestations/${directBinding.repositoryId}/fixture.json`;
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
function fixture() {
  const state: GithubBuildSnapshot = {
    membership: { id: "member", ...scope, role: "admin", acceptedAt: date, updatedAt: date },
    repository: { id: request.repositoryRecordId, organizationId: scope.organizationId, provider: "github", remoteOwner: "github", remoteName: "artifact-attestations-workflows", updatedAt: date },
    environment: { id: request.environmentId, organizationId: scope.organizationId, approvalPolicyId: "policy", updatedAt: date },
    installation: { id: "install", organizationId: scope.organizationId, githubInstallationId: "19", accountLogin: "github", status: "active", installedAt: date, updatedAt: date, revokedAt: null, suspendedAt: null },
    policy: { digest: policyDigest, requiredApprovals: 2, allowedRoles: ["admin"], allowSelfApproval: false, blocked: false }, branchPolicies: [],
  };
  const run = { id: Number(directBinding.runId), run_attempt: 1, head_sha: directBinding.sourceSha, head_branch: sourceRef.replace("refs/heads/", ""), path: directBinding.workflowPath,
    event: "workflow_dispatch", status: "completed", conclusion: "success", repository: { id: Number(directBinding.repositoryId), full_name: directBinding.repositoryFullName },
    head_repository: { id: Number(directBinding.repositoryId), full_name: directBinding.repositoryFullName }, referenced_workflows: undefined as unknown };
  const workflow = { type: "file", path: directBinding.workflowPath, encoding: "base64", content: directWorkflow.toString("base64"), size: directWorkflow.length,
    sha: createHash("sha1").update(`blob ${directWorkflow.length}\0`).update(directWorkflow).digest("hex") };
  const attestation = { repository_id: Number(directBinding.repositoryId), bundle_url: bundleUrl };
  const profile = structuredClone(directProfile), fetched: string[] = [];
  let onRead: (url: string) => void = () => {};
  let bundleResponse: () => Response = () => new Response(directBytes);
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input); fetched.push(url); onRead(url);
    expect(init?.method).toBe("GET"); expect(init?.redirect).toBe("error");
    const headers = new Headers(init?.headers);
    if (url === bundleUrl) { expect(headers.has("authorization")).toBe(false); return bundleResponse(); }
    expect(headers.get("authorization")).toBe("Bearer synthetic-direct-read-token");
    let data: unknown;
    if (url === api) data = { id: Number(directBinding.repositoryId), full_name: directBinding.repositoryFullName, private: false };
    else if ([`${api}/actions/runs/${directBinding.runId}`, `${api}/actions/runs/${directBinding.runId}/attempts/1`].includes(url)) data = run;
    else if (url === `${api}/contents/${directBinding.workflowPath}?ref=${directBinding.workflowSha}`) data = workflow;
    else if (url === `${api}/attestations/${encodeURIComponent(`sha256:${directBinding.subjects[0].sha256}`)}?per_page=5`) data = { attestations: [attestation] };
    else throw new Error("Owned direct-proof fixture rejected unexpected egress");
    return new Response(JSON.stringify(data));
  });
  vi.stubGlobal("fetch", fetcher);
  const options = { snapshot: vi.fn(async () => structuredClone(state)), token: vi.fn(async () => ({ ok: true as const, token: "synthetic-direct-read-token" })),
    profile, downloadPolicy: [{ origin: "https://reviewed.blob.core.windows.net", pathPrefix: `/attestations/${directBinding.repositoryId}/` }], clock: () => new Date(directNow) };
  return { state, run, workflow, attestation, profile, options, fetched, fetcher, reader: createGithubBuildEvidenceReader(options),
    onRead: (callback: typeof onRead) => { onRead = callback; }, bundleResponse: (callback: typeof bundleResponse) => { bundleResponse = callback; } };
}
it.each([undefined, []])("composes actual bounded reader and genuine crypto with synthetic direct run metadata %#", async references => {
  const f = fixture(); f.run.referenced_workflows = references;
  const result = await f.reader.inspectBuild(scope, request);
  expect(result).toMatchObject({ kind: "verified_build_provenance", repositoryId: directBinding.repositoryId, subjects: directBinding.subjects });
  expect(result).not.toHaveProperty("facts"); expect(result).not.toHaveProperty("executionEnabled");
  expect(f.fetched).toHaveLength(9); expect(f.fetched.filter(url => url === bundleUrl)).toHaveLength(1);
  expect(f.fetched.filter(url => url.endsWith("/attempts/1"))).toHaveLength(2);
  expect(f.options.token).toHaveBeenCalledWith(scope.organizationId, { owner: "github", repo: "artifact-attestations-workflows" }, expect.objectContaining({ permissionProfile: "provenance_read", id: "install" }));
});
it.each([null, "not-an-array", {}, [{ path: "github/reusable/.github/workflows/build.yml@refs/heads/main", sha: directBinding.sourceSha }], [{ path: directProfile.signerWorkflow.replace("https://github.com/", ""), sha: directBinding.sourceSha }]])("denies malformed or mixed direct/reusable run references %#", async references => {
  const f = fixture(); f.run.referenced_workflows = references;
  expect(await f.reader.inspectBuild(scope, request)).toMatchObject({ kind: "unavailable" }); expect(f.fetched).not.toContain(bundleUrl);
});
it.each(["repository", "source", "ref", "workflow", "attempt", "event", "blob"])("denies changed direct caller %s before reading bundle bytes", async kind => {
  const f = fixture();
  if (kind === "repository") f.run.repository.id++;
  if (kind === "source") f.run.head_sha = "f".repeat(40);
  if (kind === "ref") f.run.head_branch = "other";
  if (kind === "workflow") f.run.path = ".github/workflows/other.yml";
  if (kind === "attempt") f.run.run_attempt = 2;
  if (kind === "event") f.run.event = "pull_request_target";
  if (kind === "blob") f.workflow.sha = "f".repeat(40);
  expect(await f.reader.inspectBuild(scope, request)).toMatchObject({ kind: "unavailable" }); expect(f.fetched).not.toContain(bundleUrl);
});
it.each(["membership", "repository", "installation", "policy", "branchPolicy", "environment", "profile", "downloadPolicy", "runAttempt"])("withholds direct evidence after %s changes during simulated bundle IO", async kind => {
  const f = fixture(); f.onRead(url => { if (url !== bundleUrl) return;
    if (kind === "membership") f.state.membership.role = "read_only";
    if (kind === "repository") f.state.repository.updatedAt = "2026-10-16T01:00:00Z";
    if (kind === "installation") f.state.installation.revokedAt = date;
    if (kind === "policy") f.state.policy.blocked = true;
    if (kind === "branchPolicy") f.state.branchPolicies.push({ id: "new-rule", organizationId: scope.organizationId, repositoryId: request.repositoryRecordId, environmentId: request.environmentId, branchPattern: "main", priority: 1, requireReleaseTag: false, requireCodeowners: false, requirePrLink: false, requireChangeTicket: false, requirePromotionFromEnvironmentId: null, requireTestsPassing: false, enabled: true, updatedAt: date });
    if (kind === "environment") f.state.environment.approvalPolicyId = "other";
    if (kind === "profile") f.profile.signerWorkflowSha = "f".repeat(40);
    if (kind === "downloadPolicy") f.options.downloadPolicy[0].origin = "https://foreign.blob.core.windows.net";
    if (kind === "runAttempt") f.run.run_attempt = 2;
  });
  expect(await f.reader.inspectBuild(scope, request)).toMatchObject({ kind: "unavailable" });
  expect(f.fetched).toContain(bundleUrl);
});
it("has no implicit direct trust or credential fallback", async () => {
  const f = fixture();
  expect(await createGithubBuildEvidenceReader({ ...f.options, profile: undefined }).inspectBuild(scope, request)).toMatchObject({ kind: "unavailable" });
  expect(f.options.token).not.toHaveBeenCalled(); expect(f.fetcher).not.toHaveBeenCalled();
});
it("does not follow a foreign bundle URL", async () => {
  const f = fixture(); f.attestation.bundle_url = bundleUrl.replace(`/attestations/${directBinding.repositoryId}/`, "/attestations/999/");
  expect(await f.reader.inspectBuild(scope, request)).toMatchObject({ kind: "unavailable" }); expect(f.fetched).not.toContain(f.attestation.bundle_url);
});
it.each(["denied", "redirect", "oversized"])("rejects %s bundle response without evidence", async kind => {
  const f = fixture(); f.bundleResponse(() => kind === "denied" ? new Response("denied", { status: 403 }) : kind === "redirect" ? new Response(null, { status: 302, headers: { location: "https://foreign.invalid" } }) : new Response(directBytes, { headers: { "content-length": String(1024 * 1024 + 1) } }));
  expect(await f.reader.inspectBuild(scope, request)).toMatchObject({ kind: "unavailable" }); expect(f.fetched.filter(url => url === bundleUrl)).toHaveLength(1);
});
it("cancels an unresponsive direct credential resolver before remote reads", async () => {
  const f = fixture(); let started: () => void = () => {};
  const waiting = new Promise<void>(resolve => { started = resolve; });
  vi.useFakeTimers();
  const pending = createGithubBuildEvidenceReader({ ...f.options, token: async () => { started(); return new Promise<{ ok: true; token: string }>(() => {}); } }).inspectBuild(scope, request);
  await waiting; await vi.advanceTimersByTimeAsync(30_001);
  expect(await pending).toMatchObject({ kind: "unavailable" }); expect(f.fetcher).not.toHaveBeenCalled();
});
