import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { BuildBinding, DirectWorkflowPublicTrustProfile } from "../../sigstoreBuildVerifier";
export const directBytes = readFileSync(new URL("./direct-workflow-oci/bundle.sigstore.json", import.meta.url));
export const directWorkflow = readFileSync(new URL("./direct-workflow-oci/workflow.yml", import.meta.url));
export const directRoots = JSON.parse(readFileSync(new URL("./trusted_root.json", import.meta.url), "utf8"));
export const directDigest = (bytes: Uint8Array) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
export const directNow = new Date("2026-10-16T12:00:00Z");
export const directBinding: BuildBinding = {
  organizationId: "direct-fixture-tenant", repositoryId: "804468129", repositoryFullName: "github/artifact-attestations-workflows",
  sourceSha: "cc78c9cd50c7bace6c3be36bbd22f2f1b5f8182b", sourceRef: "refs/heads/main",
  workflowPath: ".github/workflows/ghcr-publish.yml", workflowSha: "cc78c9cd50c7bace6c3be36bbd22f2f1b5f8182b",
  runId: "10782915115", runAttempt: 1, attestationDigest: directDigest(directBytes),
  subjects: [{ name: "ghcr.io/github/artifact-attestations-workflows", sha256: "06e6818324cb20e1ea6f22da7fb925323fb57251c98768c88b93872b50590f92" }],
};
export const directProfile = {
  kind: "public_sigstore_direct_workflow_v1" as const,
  trustedRoot: directRoots, trustedRootDigest: directDigest(Buffer.from(JSON.stringify(directRoots))),
  reviewedAt: "2026-10-16T00:00:00Z", reviewExpiresAt: "2026-10-17T00:00:00Z",
  signerWorkflow: `https://github.com/${directBinding.repositoryFullName}/${directBinding.workflowPath}@${directBinding.sourceRef}`,
  signerWorkflowSha: directBinding.sourceSha,
} satisfies DirectWorkflowPublicTrustProfile;
