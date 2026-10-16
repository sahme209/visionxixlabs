import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { createGithubBuildEvidenceReader, type GithubBuildSnapshot, type GithubBuildRequest } from "../githubBuildEvidence";
import { parseManifestCandidate } from "../contract";
import { reviewManifest } from "@/scripts/fixtures/ecsReviewFixture";
const bytes = readFileSync(new URL("./fixtures/reusable-workflow-attestation.sigstore.json", import.meta.url));
const roots = JSON.parse(readFileSync(new URL("./fixtures/trusted_root.json", import.meta.url), "utf8"));
const digest = (v: Uint8Array) => `sha256:${createHash("sha256").update(v).digest("hex")}`;
const now = new Date("2026-10-16T12:00:00Z"), date = "2026-10-16T00:00:00Z";
const fullName = "malancas/attest-demo", repositoryId = "804070735", sourceSha = "95baf27389e83e6a5c48f42e190d48d7abcea19e";
const signerSha = "09b495c3f12c7881b3cc17209a327792065c1a1d";
const signer = `https://github.com/github/artifact-attestations-workflows/.github/workflows/attest.yml@${signerSha}`;
const bundleUrl = `https://reviewed.blob.core.windows.net/attestations/${repositoryId}/2026/fixture.json.sn?sig=never-log-this-fixture-query`;
const scope = { organizationId: "org-1", userId: "admin" };
const request: GithubBuildRequest = { repositoryRecordId: "repo-row", environmentId: "env", policyDigest: `sha256:${"c".repeat(64)}`,
  expected: { repositoryId, repositoryFullName: fullName, sourceSha, workflowPath: ".github/workflows/shared.yml", workflowSha: sourceSha, runId: "9228858953", runAttempt: 1, attestationDigest: digest(bytes),
    subjects: [{ name: "github_provenance_demo-0.0.0-py3-none-any.whl", sha256: "49a3aa6075e0f49f82843e74b5baa614ad2a588e6675612bf108a0a008c5ac25" }] } };
afterEach(() => vi.unstubAllGlobals());
function fixture() {
  let currentTime = new Date(now);
  const state: GithubBuildSnapshot = {
    membership: { id: "member", organizationId: "org-1", userId: "admin", role: "admin", acceptedAt: date, updatedAt: date },
    repository: { id: "repo-row", organizationId: "org-1", provider: "github", remoteOwner: "malancas", remoteName: "attest-demo", updatedAt: date },
    environment: { id: "env", organizationId: "org-1", approvalPolicyId: "policy", updatedAt: date },
    installation: { id: "install-row", organizationId: "org-1", githubInstallationId: "19", accountLogin: "malancas", status: "active", installedAt: date, updatedAt: date, revokedAt: null, suspendedAt: null },
    policy: { digest: request.policyDigest, requiredApprovals: 2, allowedRoles: ["admin"], allowSelfApproval: false, blocked: false },
    branchPolicies: [{ id: "branch-rule", organizationId: "org-1", repositoryId: "repo-row", environmentId: "env", branchPattern: "main", priority: 100, requireReleaseTag: false, requireCodeowners: false, requirePrLink: false, requireChangeTicket: false, requirePromotionFromEnvironmentId: null, requireTestsPassing: true, enabled: true, updatedAt: date }],
  };
  const profile = { kind: "public_sigstore", trustedRoot: roots, trustedRootDigest: digest(Buffer.from(JSON.stringify(roots))), reviewedAt: date, reviewExpiresAt: "2026-10-17T00:00:00Z", signerWorkflow: signer, signerWorkflowSha: signerSha };
  const run = { id: 9228858953, run_attempt: 1, head_sha: sourceSha, head_branch: "main", path: request.expected.workflowPath, event: "workflow_dispatch", status: "completed", conclusion: "success",
    repository: { id: Number(repositoryId), full_name: fullName }, head_repository: { id: Number(repositoryId), full_name: fullName },
    referenced_workflows: [{ path: signer.replace("https://github.com/", ""), sha: signerSha }] };
  const content = Buffer.from("name: fixture workflow\non: workflow_dispatch\n");
  const workflow = { type: "file", path: request.expected.workflowPath, encoding: "base64", content: content.toString("base64"), size: content.length, sha: createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex") };
  const attestation = { repository_id: Number(repositoryId), bundle_url: bundleUrl };
  const snapshot = vi.fn(async () => structuredClone(state));
  const token = vi.fn(async () => ({ ok: true as const, token: "scoped-read-fixture-token" }));
  const fetched: string[] = [];
  let onRead: (url: string) => void = () => {};
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    const url = String(input); fetched.push(url); onRead(url);
    if (url === bundleUrl) return new Response(bytes);
    const data = url.includes("/actions/runs/") ? run : url.includes("/contents/") ? workflow : url.includes("/attestations/") ? { attestations: [attestation] } : { id: Number(repositoryId), full_name: fullName, private: false };
    return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetcher);
  const options = { snapshot, token, profile, downloadPolicy: [{ origin: "https://reviewed.blob.core.windows.net", pathPrefix: `/attestations/${repositoryId}/` }], clock: () => new Date(currentTime) };
  const reader = createGithubBuildEvidenceReader(options);
  return { state, snapshot, token, fetched, fetcher, run, workflow, attestation, options, reader, onRead: (fn: typeof onRead) => { onRead = fn; }, setClock: (value: Date) => { currentTime = value; } };
}

it("composes bounded simulated GitHub metadata with REAL upstream cryptographic proof, yielding build evidence only", async () => {
  const f = fixture();
  expect(await f.reader.inspectBuild(scope, request)).toMatchObject({ kind: "verified_build_provenance", repositoryId, runId: request.expected.runId, runAttempt: 1 });
  expect(f.token).toHaveBeenCalledWith("org-1", { owner: "malancas", repo: "attest-demo" }, expect.objectContaining({ id: "install-row", githubInstallationId: "19", permissionProfile: "provenance_read", signal: expect.any(AbortSignal) }));
  expect(f.fetched.filter(url => url === bundleUrl)).toHaveLength(1);
  expect(f.fetched.filter(url => url.includes("/attempts/1"))).toHaveLength(2);
});
it("has no default trust/download configuration and does no token or provider IO", async () => {
  const f = fixture();
  expect(await createGithubBuildEvidenceReader({ ...f.options, profile: undefined }).inspectBuild(scope, request)).toMatchObject({ kind: "unavailable" });
  expect(await createGithubBuildEvidenceReader({ ...f.options, downloadPolicy: [] }).inspectBuild(scope, request)).toMatchObject({ kind: "unavailable" });
  expect(f.token).not.toHaveBeenCalled(); expect(f.fetcher).not.toHaveBeenCalled();
});
it.each(["actor", "tenant", "policy", "repository", "installation"])("rejects invalid current %s before credentials/network", async kind => {
  const f = fixture();
  if (kind === "actor") f.state.membership.role = "read_only";
  if (kind === "tenant") f.state.repository.organizationId = "foreign";
  if (kind === "policy") f.state.policy.blocked = true;
  if (kind === "repository") f.state.repository.remoteOwner = "foreign";
  if (kind === "installation") f.state.installation.suspendedAt = date;
  expect(await f.reader.inspectBuild(scope, request)).toMatchObject({ kind: "unavailable" });
  expect(f.token).not.toHaveBeenCalled(); expect(f.fetcher).not.toHaveBeenCalled();
});
it("rechecks the pinned installation after token resolution before resource reads", async () => {
  const f = fixture(); f.token.mockImplementation(async () => { f.state.installation.updatedAt = "2026-10-16T01:00:00Z"; return { ok: true, token: "stale-token" }; });
  expect(await f.reader.inspectBuild(scope, request)).toMatchObject({ kind: "unavailable" }); expect(f.fetcher).not.toHaveBeenCalled();
});
it.each(["actor", "policy", "branchRule", "installation", "environment"])("withholds late evidence when %s changes during bundle IO", async kind => {
  const f = fixture(); f.onRead(url => { if (url !== bundleUrl) return;
    if (kind === "actor") f.state.membership.role = "read_only";
    if (kind === "policy") f.state.policy.digest = `sha256:${"a".repeat(64)}`;
    if (kind === "branchRule") f.state.branchPolicies[0].requireCodeowners = true;
    if (kind === "installation") f.state.installation.revokedAt = date;
    if (kind === "environment") f.state.environment.approvalPolicyId = "other-policy";
  });
  expect(await f.reader.inspectBuild(scope, request)).toMatchObject({ kind: "unavailable" });
});
it.each(["repositoryId", "fork", "source", "attempt", "workflow", "signer", "event"])("rejects mismatched remote %s before downloading a bundle", async kind => {
  const f = fixture();
  if (kind === "repositoryId") f.run.repository.id++;
  if (kind === "fork") f.run.head_repository.full_name = "fork/repo";
  if (kind === "source") f.run.head_sha = "f".repeat(40);
  if (kind === "attempt") f.run.run_attempt = 2;
  if (kind === "workflow") f.run.path = ".github/workflows/other.yml";
  if (kind === "signer") f.run.referenced_workflows[0].sha = "f".repeat(40);
  if (kind === "event") f.run.event = "pull_request_target";
  expect(await f.reader.inspectBuild(scope, request)).toMatchObject({ kind: "unavailable" }); expect(f.fetched).not.toContain(bundleUrl);
});
it("rereads exact/current run metadata and refuses a superseding rerun", async () => {
  const f = fixture(); f.onRead(url => { if (url.includes("/actions/runs/") && f.fetched.filter(p => p === url).length > 1) f.run.run_attempt = 2; });
  expect(await f.reader.inspectBuild(scope, request)).toMatchObject({ kind: "unavailable" });
});
it("rejects workflow-content blob mismatch and foreign attestation repository IDs", async () => {
  const f = fixture(); f.workflow.sha = "f".repeat(40);
  expect(await f.reader.inspectBuild(scope, request)).toMatchObject({ kind: "unavailable" }); expect(f.fetched).not.toContain(bundleUrl);
  const other = fixture(); other.attestation.repository_id++;
  expect(await other.reader.inspectBuild(scope, request)).toMatchObject({ kind: "unavailable" }); expect(other.fetched).not.toContain(bundleUrl);
});
it("refuses signed-byte mismatch rather than accepting the API attestation label", async () => {
  const f = fixture();
  expect(await f.reader.inspectBuild(scope, { ...request, expected: { ...request.expected, attestationDigest: `sha256:${"0".repeat(64)}` } })).toMatchObject({ kind: "unavailable" });
});
it("never downloads from another repository prefix even when both prefixes are server-permitted", async () => {
  const f = fixture();
  f.options.downloadPolicy.push({ origin: "https://reviewed.blob.core.windows.net", pathPrefix: "/attestations/999/" });
  const foreignUrl = bundleUrl.replace(`/attestations/${repositoryId}/`, "/attestations/999/");
  f.attestation.bundle_url = foreignUrl;
  expect(await f.reader.inspectBuild(scope, request)).toMatchObject({ kind: "unavailable" });
  expect(f.fetched).not.toContain(foreignUrl);
});
it("bounds credential-resolution hangs with the overall operation deadline and performs no resource read", async () => {
  const f = fixture();
  let started: () => void = () => {};
  const tokenStarted = new Promise<void>(resolve => { started = resolve; });
  const neverToken = async () => { started(); return new Promise<{ ok: true; token: string }>(() => {}); };
  vi.useFakeTimers();
  try {
    const pending = createGithubBuildEvidenceReader({ ...f.options, token: neverToken }).inspectBuild(scope, request);
    await tokenStarted;
    await vi.advanceTimersByTimeAsync(30_001);
    expect(await pending).toMatchObject({ kind: "unavailable" });
    expect(f.fetcher).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});
function candidate() {
  const m = reviewManifest();
  m.organizationId = scope.organizationId; m.environmentId = request.environmentId; m.policyDigest = request.policyDigest;
  m.repository = { id: repositoryId, fullName, sourceSha };
  m.build = { runId: request.expected.runId, attempt: 1, workflowPath: request.expected.workflowPath, workflowSha: sourceSha, attestationDigest: digest(bytes) };
  m.createdAt = "2026-10-16T11:00:00Z"; m.expiresAt = "2026-10-16T13:00:00Z";
  const parsed = parseManifestCandidate(m, now);
  if (parsed.kind !== "structural_candidate") throw new Error(parsed.reason);
  return parsed;
}
it("does not convert a genuine wheel proof into OCI manifest evidence", async () => {
  const f = fixture();
  expect(await f.reader.inspectManifest(scope, { repositoryRecordId: request.repositoryRecordId, candidate: candidate() })).toMatchObject({ kind: "unavailable" });
});
it.each(["expiry", "mutation"])("rechecks manifest %s after provider IO instead of certifying a stale candidate", async kind => {
  const f = fixture(), parsed = candidate();
  f.onRead(url => { if (url !== bundleUrl) return; if (kind === "expiry") f.setClock(new Date(parsed.manifest.expiresAt)); else parsed.manifest.target.revision++; });
  expect(await f.reader.inspectManifest(scope, { repositoryRecordId: request.repositoryRecordId, candidate: parsed })).toEqual({ kind: "unavailable", reason: "invalid_or_expired_manifest" });
  expect(f.fetched).toContain(bundleUrl);
});
it("cannot resolve ambient credentials from an injected snapshot without an explicit client or token", async () => {
  const f = fixture();
  expect(await createGithubBuildEvidenceReader({ ...f.options, token: undefined }).inspectBuild(scope, request)).toMatchObject({ kind: "unavailable" });
  expect(f.token).not.toHaveBeenCalled();
  expect(f.fetcher).not.toHaveBeenCalled();
});
