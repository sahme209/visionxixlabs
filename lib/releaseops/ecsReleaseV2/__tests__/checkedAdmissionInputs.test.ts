import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { createEcsCheckedInputReader, exactSubjectCoverage } from "../admissionInputs/read";
import { contextFixture, now, principal, selectors } from "./fixtures/admissionInputFixture";
import { directBinding, directBytes, directProfile, directWorkflow } from "./fixtures/directWorkflowFixture";
import { encryptScopedCredential } from "@/lib/security/credentialVault";
import { cloudCredentialContext } from "@/lib/cloud/aws/enrollment/policy";
import { readVerifiedEcsObservation } from "@/lib/cloud/aws/enrollment/stsValidation";
import { resolveGithubInstallationToken } from "@/lib/connectors/github/githubAppAuth";
vi.mock("@/lib/cloud/aws/enrollment/stsValidation", async original => ({ ...await original<typeof import("@/lib/cloud/aws/enrollment/stsValidation")>(), readVerifiedEcsObservation: vi.fn() }));
vi.mock("@/lib/connectors/github/githubAppAuth", async original => ({ ...await original<typeof import("@/lib/connectors/github/githubAppAuth")>(), resolveGithubInstallationToken: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); vi.clearAllMocks(); });
async function fixture() {
  const f = contextFixture();
  vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "owned-input-test-synthetic-key-0000000000000000");
  const credential = { ...f.credential, validatedAt: now, encryptedConfiguration: encryptScopedCredential(JSON.stringify({ roleArn: f.target.roleArn, expectedAccountId: f.account.externalAccountId, region: f.target.region, externalId: "axiom-0123456789abcdef0123456789abcdef" }), cloudCredentialContext({ organizationId: principal.organizationId, accountId: f.account.id, version: 1 })) };
  const repo = { ...f.tx, $transaction: f.client.$transaction, cloudAccount: { ...f.tx.cloudAccount, findMany: vi.fn(async () => [f.account]) }, cloudAccountCredential: { ...f.tx.cloudAccountCredential, findUnique: vi.fn(async () => ({ ...credential, version: f.credential.version, revokedAt: f.credential.revokedAt })) } };
  const run = { id: Number(directBinding.runId), run_attempt: 1, head_sha: directBinding.sourceSha, head_branch: "main", path: directBinding.workflowPath, event: "workflow_dispatch", status: "completed", conclusion: "success", repository: { id: Number(directBinding.repositoryId), full_name: directBinding.repositoryFullName }, head_repository: { id: Number(directBinding.repositoryId), full_name: directBinding.repositoryFullName } };
  const workflow = { type: "file", path: directBinding.workflowPath, encoding: "base64", content: directWorkflow.toString("base64"), size: directWorkflow.length, sha: createHash("sha1").update(`blob ${directWorkflow.length}\0`).update(directWorkflow).digest("hex") };
  const api = `https://api.github.com/repos/${directBinding.repositoryFullName}`, bundleUrl = `https://reviewed.blob.core.windows.net/attestations/${directBinding.repositoryId}/fixture.json`;
  let onRead: (url: string) => void = () => {};
  const fetcher = vi.fn<typeof fetch>(async input => {
    const url = String(input); onRead(url);
    if (url === bundleUrl) return new Response(directBytes);
    const data = url === api ? { ...run.repository, private: false } : url === `${api}/actions/runs/${directBinding.runId}` || url === `${api}/actions/runs/${directBinding.runId}/attempts/1` ? run : url === `${api}/contents/${directBinding.workflowPath}?ref=${directBinding.workflowSha}` ? workflow : url === `${api}/attestations/${encodeURIComponent(`sha256:${directBinding.subjects[0].sha256}`)}?per_page=5` ? { attestations: [{ repository_id: Number(directBinding.repositoryId), bundle_url: bundleUrl }] } : undefined;
    if (!data) throw new Error("owned test rejected unexpected egress");
    return new Response(JSON.stringify(data));
  });
  vi.stubGlobal("fetch", fetcher);
  vi.mocked(resolveGithubInstallationToken).mockResolvedValue({ ok: true, token: "owned-synthetic-github-token", installationId: 19, expiresAt: new Date("2026-10-16T13:00:00Z").getTime() });
  const pin = { digestSchema: "axiom.ecs.taskdef.registration.v1" as const, contentDigest: `sha256:${"a".repeat(64)}`, images: [{ container: "app", image: `123456789012.dkr.ecr.us-east-1.amazonaws.com/app@sha256:${directBinding.subjects[0].sha256}` }] };
  const observation = { baseline: { ...pin, arn: selectors.baselineArn }, proposed: { ...pin, arn: selectors.proposedArn }, associatedTargetGroupArns: [] };
  vi.mocked(readVerifiedEcsObservation).mockResolvedValue(observation);
  let currentTime = new Date(now);
  const options = { client: repo as unknown as Parameters<typeof createEcsCheckedInputReader>[0]["client"], profile: structuredClone(directProfile), downloadPolicy: [{ origin: "https://reviewed.blob.core.windows.net", pathPrefix: `/attestations/${directBinding.repositoryId}/` }], clock: () => new Date(currentTime) };
  return { ...f, options, run, fetcher, bundleUrl, observation, inspect: createEcsCheckedInputReader(options).inspect, onRead(callback: typeof onRead) { onRead = callback; }, setClock(value: Date) { currentTime = value; } };
}
it("uses actual crypto, token scope, AEAD and current readers; genuine GHCR plus ECR stays checked mismatch only", async () => {
  const f = await fixture(), result = await f.inspect(principal, selectors);
  expect(result).toMatchObject({ kind: "checked_provider_inputs_subject_mismatch", sourceCoverage: "mismatch", usability: "not_usable_for_admission", evidence: { schema: "axiom.ecs.checked-provider-inputs.v1", build: { repositoryId: directBinding.repositoryId, checkedBinding: { sourceRef: "refs/heads/main" } }, aws: { connection: { id: "account", version: 1 }, limits: { executionAuthorized: false } } } });
  expect(f.fetcher).toHaveBeenCalledTimes(9); expect(readVerifiedEcsObservation).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(result)).not.toMatch(/owned-synthetic-github-token|encryptedConfiguration|0123456789abcdef/);
  expect(result).not.toHaveProperty("authorization"); expect(result).not.toHaveProperty("admissionReady"); expect(result).not.toHaveProperty("facts");
});
it.each(["provider_scope", "member", "session", "target", "connection", "credential", "policy", "installation", "environment", "branch", "configuration"])("withholds mixed context when %s changes during Github IO", async mode => {
  const f = await fixture();
  f.onRead(url => { if (url !== f.bundleUrl) return;
    if (mode === "provider_scope") f.member.providerScopes = ["gcp"];
    if (mode === "member") f.member.updatedAt = new Date(now);
    if (mode === "session") f.session.issuedAt = new Date(f.session.issuedAt.getTime() + 1);
    if (mode === "target") f.target.ecsService = "other";
    if (mode === "connection") f.account.enabled = true;
    if (mode === "credential") f.credential.version++;
    if (mode === "policy") f.policy.requiredApprovals++;
    if (mode === "installation") f.installation.repositorySelection = "all";
    if (mode === "environment") f.environment.tier = "test";
    if (mode === "branch") f.branchPolicies.push({ id: "new-rule", organizationId: "org", repositoryId: "repo", environmentId: "env", branchPattern: "main", priority: 1, requireReleaseTag: false, requireCodeowners: false, requirePrLink: false, requireChangeTicket: false, requirePromotionFromEnvironmentId: null, requireTestsPassing: false, enabled: true, updatedAt: now.toISOString() });
    if (mode === "configuration") f.options.downloadPolicy[0].origin = "https://other.blob.core.windows.net";
  });
  expect(await f.inspect(principal, selectors)).toMatchObject({ kind: "unavailable" });
  expect(readVerifiedEcsObservation).not.toHaveBeenCalled();
});
it.each(["session", "member", "target", "credential", "configuration", "expiry", "deadline", "rollback_clock"])("withholds checked evidence after late AWS %s drift", async mode => {
  const f = await fixture(); vi.mocked(readVerifiedEcsObservation).mockImplementation(async () => {
    if (mode === "session") f.session.revokedAt = now;
    if (mode === "member") f.member.role = "read_only";
    if (mode === "target") f.target.updatedAt = new Date(now);
    if (mode === "credential") f.credential.version++;
    if (mode === "configuration") f.options.profile.signerWorkflowSha = "f".repeat(40);
    if (mode === "expiry") f.setClock(f.session.expiresAt);
    if (mode === "deadline") f.setClock(new Date(now.getTime() + 60_000));
    if (mode === "rollback_clock") f.setClock(new Date(now.getTime() - 1));
    return f.observation;
  });
  expect(await f.inspect(principal, selectors)).toMatchObject({ kind: "unavailable" });
});
it("clones selector and principal values before the first await", async () => {
  const f = await fixture(), input = structuredClone(selectors), actor = structuredClone(principal);
  f.onRead(() => { input.proposedArn = selectors.baselineArn; input.build.sourceSha = "f".repeat(40); actor.organizationId = "foreign"; });
  expect(await f.inspect(actor, input)).toMatchObject({ kind: "checked_provider_inputs_subject_mismatch" });
});
it.each(["unknown", "bad_binding", "foreign_principal", "no_trust", "empty_policy", "oversized", "aborted"])("rejects %s before provider IO", async mode => {
  const f = await fixture(), input = structuredClone(selectors), actor = structuredClone(principal), parent = new AbortController();
  if (mode === "unknown") Object.assign(input, { authorize: true });
  if (mode === "bad_binding") input.build.workflowSha = "f".repeat(40);
  if (mode === "foreign_principal") actor.userId = "other";
  if (mode === "no_trust") Object.assign(f.options, { profile: undefined });
  if (mode === "empty_policy") f.options.downloadPolicy.length = 0;
  if (mode === "oversized") input.build.subjects[0].name = "x".repeat(70_000);
  if (mode === "aborted") parent.abort();
  expect(await f.inspect(actor, input, parent.signal)).toMatchObject({ kind: "unavailable" });
  expect(f.fetcher).not.toHaveBeenCalled(); expect(readVerifiedEcsObservation).not.toHaveBeenCalled();
});
it("denies ECR substitution in expected signed subjects rather than blessing the observation", async () => {
  const f = await fixture(), input = structuredClone(selectors); input.build.subjects[0].name = f.observation.proposed.images[0].image.split("@")[0];
  expect(await f.inspect(principal, input)).toMatchObject({ kind: "unavailable", reason: "build_evidence_unavailable" });
  expect(readVerifiedEcsObservation).not.toHaveBeenCalled();
});
it.each(["exact", "same_name_wrong_digest", "missing", "extra", "alias", "duplicate"])("compares complete exact subject sets: %s", mode => {
  const name = "123456789012.dkr.ecr.us-east-1.amazonaws.com/app", digest = "a".repeat(64);
  const subjects = [{ name, sha256: digest }], images = [{ container: "app", image: `${name}@sha256:${digest}` }];
  if (mode === "same_name_wrong_digest") subjects[0].sha256 = "b".repeat(64);
  if (mode === "missing") subjects.length = 0;
  if (mode === "extra") subjects.push({ name: "extra", sha256: digest });
  if (mode === "alias") subjects[0].name = "ghcr.io/owner/app";
  if (mode === "duplicate") subjects.push({ ...subjects[0] });
  expect(exactSubjectCoverage(subjects, images)).toBe(mode === "exact");
});
it("does not publish after session expiry while the final context transaction completes", async () => {
  const f = await fixture(), original = f.transaction.getMockImplementation()!;
  f.transaction.mockImplementation(async operation => {
    const result = await original(operation);
    if (vi.mocked(readVerifiedEcsObservation).mock.calls.length && result && typeof result === "object" && "schema" in result) f.setClock(f.session.expiresAt);
    return result;
  });
  expect(await f.inspect(principal, selectors)).toMatchObject({ kind: "unavailable" });
});
it("cancels a pending SDK-boundary read under the common parent signal", async () => {
  const f = await fixture(), parent = new AbortController();
  let started: () => void = () => {};
  const waiting = new Promise<void>(resolve => { started = resolve; });
  vi.mocked(readVerifiedEcsObservation).mockImplementation(async () => { started(); return new Promise<never>(() => {}); });
  const pending = f.inspect(principal, selectors, parent.signal);
  await waiting; parent.abort();
  expect(await pending).toMatchObject({ kind: "unavailable" });
  expect(readVerifiedEcsObservation).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), expect.objectContaining({ aborted: true }));
});
it("cannot use a valid proof under a foreign environment or repository context", async () => {
  const f = await fixture(), input = structuredClone(selectors); input.environmentId = "foreign-env";
  expect(await f.inspect(principal, input)).toMatchObject({ kind: "unavailable" });
  input.environmentId = selectors.environmentId; input.repositoryRecordId = "foreign-repo";
  expect(await f.inspect(principal, input)).toMatchObject({ kind: "unavailable" });
  expect(f.fetcher).not.toHaveBeenCalled(); expect(readVerifiedEcsObservation).not.toHaveBeenCalled();
});
