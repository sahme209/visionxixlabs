import { sha256ContentHash } from "@/lib/tauri/contentHash";
export const hash = (value: unknown) => sha256ContentHash(value);
export const customerProfile = () => ({
  schema: "axiom.terraform.customer-profile.v2", id: "profile-owned", organizationId: "org-owned", deploymentRequestId: "request-owned", requestVersion: 1,
  environmentId: "env-owned", revision: 1,
  repository: { recordId: "repository-owned", remoteId: "12345", fullName: "owned/infra", sourceRef: "refs/heads/main", sourceSha: "a".repeat(40) },
  producer: { workflowPath: ".github/workflows/plan.yml", workflowSha: "a".repeat(40), workflowDigest: hash("reviewed-workflow"), scriptPath: "scripts/terraform/customer-plan-producer.mjs", scriptDigest: hash("reviewed-producer"), trustProfileId: "trust-owned", toolchainProfileId: "toolchain-owned", planRoleArn: "arn:aws:iam::123456789012:role/customer-ci-plan" },
  configuration: { root: "infra", treeDigest: hash("config-tree"), providerLockDigest: hash("provider-lock") },
  backend: { kind: "s3_dynamodb", accountId: "123456789012", region: "us-east-1", bucket: "customer-state", key: "infra/terraform.tfstate", workspace: "default", lockTable: "terraform-locks", lockKey: "customer-state/infra/terraform.tfstate" },
  artifacts: { bucket: "customer-plan-artifacts", region: "us-east-1", prefix: "axiom-plans", kmsKeyArn: "arn:aws:kms:us-east-1:123456789012:key/00000000-0000-0000-0000-000000000001" },
  connection: { id: "connection-owned", version: 3 },
});
export const backendState = () => ({ versionId: "owned-state-version", digest: hash("state-bytes"), lineage: "00000000-0000-0000-0000-000000000002", serial: 9 });
export const customerBinding = () => {
 const profile = customerProfile();
 return { schema: "axiom.terraform.saved-plan.v2", evidenceScope: "customer_ci_attested", profile, profileDigest: hash(profile), requestContentHash: hash("request-content"),
   targetDigest: hash("independently-observed-target"), backendState: backendState(),
   producer: { repositoryId: "12345", runId: "888", runAttempt: 1, attestationDigest: `sha256:${hash("bundle")}`, trustDigest: hash("reviewed-trust"), receiptDigest: hash("receipt") },
   configurationDigest: profile.configuration.treeDigest, providerLockDigest: profile.configuration.providerLockDigest,
   terraformVersion: "1.9.8", executableDigest: hash("owned-cli"), binaryDigest: hash("binary"), showDigest: hash("show"),
   createdAt: "2026-10-18T12:00:00.000Z", expiresAt: "2026-10-18T12:15:00.000Z" };
};
