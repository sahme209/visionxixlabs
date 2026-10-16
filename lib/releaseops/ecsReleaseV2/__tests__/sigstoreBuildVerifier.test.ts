import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { verifyBuildProvenance, sigstoreRuntimeSupported, manifestBuildBinding, type BuildBinding, type PublicTrustProfile } from "../sigstoreBuildVerifier";

import { parseManifestCandidate, type ReleaseManifest } from "../contract";

const bytes = readFileSync(new URL("./fixtures/reusable-workflow-attestation.sigstore.json", import.meta.url));
const roots = JSON.parse(readFileSync(new URL("./fixtures/trusted_root.json", import.meta.url), "utf8"));
const digest = (value: Uint8Array) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const now = new Date("2026-10-16T12:00:00Z");
const binding: BuildBinding = {
  organizationId: "fixture-tenant", repositoryId: "804070735", repositoryFullName: "malancas/attest-demo",
  sourceSha: "95baf27389e83e6a5c48f42e190d48d7abcea19e", sourceRef: "refs/heads/main",
  workflowPath: ".github/workflows/shared.yml", workflowSha: "95baf27389e83e6a5c48f42e190d48d7abcea19e",
  runId: "9228858953", runAttempt: 1, attestationDigest: digest(bytes),
  subjects: [{ name: "github_provenance_demo-0.0.0-py3-none-any.whl", sha256: "49a3aa6075e0f49f82843e74b5baa614ad2a588e6675612bf108a0a008c5ac25" }],
};
const profile: PublicTrustProfile = {
  kind: "public_sigstore", trustedRoot: roots, trustedRootDigest: digest(Buffer.from(JSON.stringify(roots))),
  reviewedAt: "2026-10-16T00:00:00Z", reviewExpiresAt: "2026-10-17T00:00:00Z",
  signerWorkflow: "https://github.com/github/artifact-attestations-workflows/.github/workflows/attest.yml@09b495c3f12c7881b3cc17209a327792065c1a1d",
  signerWorkflowSha: "09b495c3f12c7881b3cc17209a327792065c1a1d",
};
const authorize = vi.fn(async (organizationId: string) => organizationId === binding.organizationId);
const verify = (changes: Partial<BuildBinding> = {}, trust: unknown = profile, payload = bytes, clock = now) =>
  verifyBuildProvenance({ bytes: payload, binding: { ...binding, ...changes }, profile: trust, authorize, now: clock });

describe("official Sigstore verifier with genuine upstream signed GitHub provenance", () => {
  it("verifies real signature, transparency evidence, certificate and exact signed build bindings", async () => {
    const result = await verify();
    expect(result).toMatchObject({ kind: "verified_build_provenance", organizationId: "fixture-tenant", repositoryId: binding.repositoryId, runId: binding.runId, runAttempt: 1 });
    expect(result).not.toHaveProperty("facts");
    expect(result).not.toHaveProperty("executionEnabled");
  });
  it.each([
    { repositoryId: "804070736" }, { repositoryFullName: "fork/attest-demo" }, { sourceSha: "a".repeat(40) },
    { sourceRef: "refs/heads/other" }, { workflowPath: ".github/workflows/other.yml" }, { workflowSha: "b".repeat(40) },
    { runId: "9228858954" }, { runAttempt: 2 }, { attestationDigest: `sha256:${"0".repeat(64)}` },
    { subjects: [{ ...binding.subjects[0], sha256: "1".repeat(64) }] },
    { subjects: [...binding.subjects, { name: "unattested-image", sha256: "2".repeat(64) }] },
  ])("rejects wrong independently expected binding %j", async changes => {
    expect(await verify(changes)).toMatchObject({ kind: "unavailable" });
  });
  it("does not treat metadata-only fabricated provenance as verified", async () => {
    const fabricated = Buffer.from(JSON.stringify({ predicateType: "https://slsa.dev/provenance/v1", verified: true, ...binding }));
    expect(await verify({ attestationDigest: digest(fabricated) }, profile, fabricated)).toMatchObject({ kind: "unavailable" });
  });
  it("rejects signed payload mutation even when input digest is recomputed", async () => {
    const b = JSON.parse(bytes.toString());
    const p = JSON.parse(Buffer.from(b.dsseEnvelope.payload, "base64").toString());
    p.predicate.runDetails.metadata.invocationId = p.predicate.runDetails.metadata.invocationId.replace("/1", "/2");
    b.dsseEnvelope.payload = Buffer.from(JSON.stringify(p)).toString("base64");
    const mutated = Buffer.from(JSON.stringify(b));
    expect(await verify({ attestationDigest: digest(mutated), runAttempt: 2 }, profile, mutated)).toMatchObject({ kind: "unavailable" });
  });
  it.each([null, { ...profile, kind: "private_github" }, { ...profile, trustedRootDigest: `sha256:${"0".repeat(64)}` }, { ...profile, signerWorkflow: profile.signerWorkflow.replace("github/artifact", "attacker/artifact") }])("fails closed for missing/unreviewed/private or wrong signer trust", async trust => {
    expect(await verify({}, trust)).toMatchObject({ kind: "unavailable" });
  });
  it.each(["signature", "certificate", "logPromise"])("rejects corrupted %s proof with recomputed input digest", async kind => {
    const b = JSON.parse(bytes.toString());
    if (kind === "signature") b.dsseEnvelope.signatures[0].sig = Buffer.alloc(64).toString("base64");
    if (kind === "certificate") b.verificationMaterial.certificate.rawBytes = Buffer.from("not-a-certificate").toString("base64");
    if (kind === "logPromise") b.verificationMaterial.tlogEntries[0].inclusionPromise.signedEntryTimestamp = Buffer.alloc(64).toString("base64");
    const changed = Buffer.from(JSON.stringify(b));
    expect(await verify({ attestationDigest: digest(changed) }, profile, changed)).toMatchObject({ kind: "unavailable" });
  });
  it("does not silently accept an empty root configuration", async () => {
    const root = { ...roots, certificateAuthorities: [] };
    const changed = { ...profile, trustedRoot: root, trustedRootDigest: digest(Buffer.from(JSON.stringify(root))) };
    expect(await verify({}, changed)).toMatchObject({ kind: "unavailable" });
  });
  it("rejects expired trust review", async () => {
    expect(await verify({}, profile, bytes, new Date("2026-10-18T00:00:00Z"))).toMatchObject({ kind: "unavailable" });
  });
  it("requires tenant authority before verification and rechecks after verification", async () => {
    expect(await verify({ organizationId: "other-tenant" })).toMatchObject({ kind: "unavailable" });
    const access = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await verifyBuildProvenance({ bytes, binding, profile, authorize: access, now })).toMatchObject({ kind: "unavailable" });
    expect(access).toHaveBeenCalledTimes(2);
  });
  it("rejects missing transparency evidence without lowering official thresholds", async () => {
    const b = JSON.parse(bytes.toString()); b.verificationMaterial.tlogEntries = [];
    const changed = Buffer.from(JSON.stringify(b));
    expect(await verify({ attestationDigest: digest(changed) }, profile, changed)).toMatchObject({ kind: "unavailable" });
  });
});


describe("official verifier runtime compatibility", () => {
  it.each(["20.19.0", "22.22.1", "24.14.9", "25.1.0", "24.19.0-beta", "garbage"])("rejects %s", version => {
    expect(sigstoreRuntimeSupported(version)).toBe(false);
  });
  it.each(["22.22.2", "22.23.0", "24.15.0", "24.19.0", "26.0.0"])("supports pinned package engine %s", version => {
    expect(sigstoreRuntimeSupported(version)).toBe(true);
  });
  it("rejects invalid verification clock", async () => {
    expect(await verify({}, profile, bytes, new Date("invalid"))).toEqual({ kind: "unavailable", reason: "invalid_verification_time" });
  });
});


describe("existing ECS manifest integration without fabricated OCI proof", () => {
  it("maps complete unique OCI subjects and refuses upstream wheel evidence for ECS images", async () => {
    const hash = `sha256:${"a".repeat(64)}`;
    const image = `123456789012.dkr.ecr.us-east-1.amazonaws.com/app@${hash}`;
    const manifest: ReleaseManifest = {
      protocol: "axiom.ecs.release.v2", operationId: "op-fixture", organizationId: binding.organizationId, environmentId: "stage",
      repository: { id: binding.repositoryId, fullName: binding.repositoryFullName, sourceSha: binding.sourceSha },
      build: { runId: binding.runId, attempt: binding.runAttempt, workflowPath: binding.workflowPath, workflowSha: binding.workflowSha, attestationDigest: binding.attestationDigest },
      executor: { workflowPath: ".github/workflows/release.yml", workflowSha: "b".repeat(40) },
      target: { partition: "aws", accountId: "123456789012", region: "us-east-1", roleArn: "arn:aws:iam::123456789012:role/Deploy", clusterArn: "arn:aws:ecs:us-east-1:123456789012:cluster/app", serviceArn: "arn:aws:ecs:us-east-1:123456789012:service/app/web", revision: 1 },
      proposed: { arn: "arn:aws:ecs:us-east-1:123456789012:task-definition/web:2", contentDigest: hash, images: [{ container: "app", image }, { container: "worker", image }] },
      baseline: { arn: "arn:aws:ecs:us-east-1:123456789012:task-definition/web:1", contentDigest: hash, images: [{ container: "app", image }, { container: "worker", image }] },
      health: { kind: "alb_target_health", targetGroupArn: "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/web/abcdef0123456789", minimumHealthyTargets: 1, timeoutSeconds: 60, stabilizationSeconds: 300 },
      promotion: null, policyDigest: hash, createdAt: "2026-10-16T11:00:00Z", expiresAt: "2026-10-16T13:00:00Z",
    };
    const candidate = parseManifestCandidate(manifest, now);
    if (candidate.kind !== "structural_candidate") throw new Error(candidate.reason);
    const expected = manifestBuildBinding(candidate, binding.sourceRef);
    expect(expected.subjects).toEqual([{ name: image.split("@")[0], sha256: "a".repeat(64) }]);
    expect(await verifyBuildProvenance({ bytes, binding: expected, profile, authorize, now })).toMatchObject({ kind: "unavailable" });
  });
});
