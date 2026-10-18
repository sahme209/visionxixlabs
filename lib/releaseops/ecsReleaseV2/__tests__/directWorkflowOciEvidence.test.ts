import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { inspectPublicTrustConfiguration, verifyBuildProvenance, type BuildBinding } from "../sigstoreBuildVerifier";
import { directBinding, directBytes, directDigest, directNow, directProfile, directWorkflow } from "./fixtures/directWorkflowFixture";
const authorize = async (organizationId: string) => organizationId === directBinding.organizationId;
const verify = (binding: Partial<BuildBinding> = {}, profile: unknown = directProfile, bytes = directBytes) =>
  verifyBuildProvenance({ bytes, binding: { ...directBinding, ...binding }, profile, authorize, now: directNow });
it("verifies genuine upstream direct-workflow OCI signature with exact pinned identities and subjects", async () => {
  const result = await verify();
  expect(result).toMatchObject({ kind: "verified_build_provenance", repositoryId: directBinding.repositoryId, subjects: directBinding.subjects });
  expect(inspectPublicTrustConfiguration(directProfile, directNow)).toMatchObject({ kind: "configured" });
  expect(result).not.toHaveProperty("facts"); expect(result).not.toHaveProperty("executionEnabled");
});
it("retains exact upstream descriptor/index/workflow/license bytes and permission provenance", () => {
  const asset = (name: string) => readFileSync(new URL(`./fixtures/direct-workflow-oci/${name}`, import.meta.url));
  expect(directDigest(directBytes)).toBe("sha256:49edde03a1879f18b95f03fb8b691137e6d3718fc21f64a22909b14fbb472c89");
  const index = asset("image-index.json"), manifest = JSON.parse(asset("bundle-manifest.json").toString());
  expect(directDigest(index)).toBe(`sha256:${directBinding.subjects[0].sha256}`);
  expect(manifest.subject.digest).toBe(directDigest(index)); expect(manifest.subject.size).toBe(index.length);
  expect(manifest.layers).toEqual([{ mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json", digest: directDigest(directBytes), size: directBytes.length }]);
  expect(directDigest(asset("bundle-manifest.json"))).toBe("sha256:aa5e53aa720c58532973c396630d4cd0d9df9cde9ae13ab509f20770554abef5");
  expect(createHash("sha1").update(`blob ${directWorkflow.length}\0`).update(directWorkflow).digest("hex")).toBe("b3f2aedd9834c78d8dc005375ec389c9f35d819d");
  const license = asset("LICENSE.txt");
  expect(license.toString()).toContain("CC0 1.0 Universal");
  expect(directDigest(license)).toBe("sha256:a2010f343487d3f7618affe54f789f5487602331c0a8d03f49e9a7c547cf0499");
});
it.each([
  { repositoryId: "804468130" }, { repositoryFullName: "foreign/artifact-attestations-workflows" },
  { sourceSha: "a".repeat(40) }, { sourceRef: "refs/heads/other" }, { sourceRef: "refs/tags/main" },
  { workflowPath: ".github/workflows/other.yml" }, { workflowSha: "b".repeat(40) },
  { runId: "10782915116" }, { runAttempt: 2 }, { attestationDigest: `sha256:${"0".repeat(64)}` },
  { subjects: [{ ...directBinding.subjects[0], name: "123456789012.dkr.ecr.us-east-1.amazonaws.com/app" }] },
  { subjects: [{ ...directBinding.subjects[0], sha256: "0".repeat(64) }] },
  { subjects: [...directBinding.subjects, { name: "ghcr.io/extra/image", sha256: "a".repeat(64) }] },
])("rejects wrong independently expected direct binding %j", async binding => {
  expect(await verify(binding)).toMatchObject({ kind: "unavailable" });
});
it.each([
  null, { ...directProfile, kind: "public_sigstore" }, { ...directProfile, kind: "private_github" },
  { ...directProfile, signerWorkflowSha: "f".repeat(40) },
  { ...directProfile, signerWorkflow: directProfile.signerWorkflow.replace("/github/", "/foreign/") },
  { ...directProfile, signerWorkflow: directProfile.signerWorkflow.replace("refs/heads/main", directBinding.sourceSha) },
  { ...directProfile, signerWorkflow: directProfile.signerWorkflow.replace("refs/heads/main", "refs/heads/main?injected") },
  { ...directProfile, buildType: "https://actions.github.io/buildtypes/workflow/v1" },
  { ...directProfile, trustedRootDigest: `sha256:${"0".repeat(64)}` },
  { ...directProfile, reviewExpiresAt: "2026-10-16T01:00:00Z" },
  { ...directProfile, reviewExpiresAt: "2026-10-25T00:00:00Z" },
])("fails closed for absent, crossed, unpinned, expired or caller-extended direct configuration %#", async profile => {
  expect(await verify({}, profile)).toMatchObject({ kind: "unavailable" });
});
it.each(["signature", "certificate", "logPromise", "missingLog", "buildType", "builder", "invocation", "subject"])("rejects corrupted signed %s even with recomputed input digest", async kind => {
  const bundle = JSON.parse(directBytes.toString());
  if (kind === "signature") bundle.dsseEnvelope.signatures[0].sig = Buffer.alloc(64).toString("base64");
  else if (kind === "certificate") bundle.verificationMaterial.certificate.rawBytes = Buffer.from("not a certificate").toString("base64");
  else if (kind === "logPromise") bundle.verificationMaterial.tlogEntries[0].inclusionPromise.signedEntryTimestamp = Buffer.alloc(64).toString("base64");
  else if (kind === "missingLog") bundle.verificationMaterial.tlogEntries = [];
  else {
    const statement = JSON.parse(Buffer.from(bundle.dsseEnvelope.payload, "base64").toString());
    if (kind === "buildType") statement.predicate.buildDefinition.buildType = "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1";
    if (kind === "builder") statement.predicate.runDetails.builder.id = "https://github.com/foreign/repo/.github/workflows/build.yml@refs/heads/main";
    if (kind === "invocation") statement.predicate.runDetails.metadata.invocationId += "0";
    if (kind === "subject") statement.subject[0].name = "123456789012.dkr.ecr.us-east-1.amazonaws.com/app";
    bundle.dsseEnvelope.payload = Buffer.from(JSON.stringify(statement)).toString("base64");
  }
  const bytes = Buffer.from(JSON.stringify(bundle));
  expect(await verify({ attestationDigest: directDigest(bytes) }, directProfile, bytes)).toMatchObject({ kind: "unavailable" });
});
it("requires current tenant authority before and after direct cryptographic verification", async () => {
  const access = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  expect(await verifyBuildProvenance({ bytes: directBytes, binding: directBinding, profile: directProfile, authorize: access, now: directNow })).toMatchObject({ kind: "unavailable" });
  expect(access).toHaveBeenCalledTimes(2);
  expect(await verify({ organizationId: "foreign" })).toMatchObject({ kind: "unavailable" });
});
