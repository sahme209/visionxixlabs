/** Browser-safe customer evidence shapes only; parsing and authority remain server-side. */
export interface CustomerPlanProfile {
 schema: "axiom.terraform.customer-profile.v2";
 id: string; organizationId: string; deploymentRequestId: string; requestVersion: number; environmentId: string; revision: number;
 repository: { recordId: string; remoteId: string; fullName: string; sourceRef: string; sourceSha: string };
 producer: { workflowPath: string; workflowSha: string; workflowDigest: string; scriptPath: string; scriptDigest: string; trustProfileId: string; toolchainProfileId: string; planRoleArn: string };
 configuration: { root: string; treeDigest: string; providerLockDigest: string };
 backend: { kind: "s3_dynamodb"; accountId: string; region: string; bucket: string; key: string; workspace: "default"; lockTable: string; lockKey: string };
 artifacts: { bucket: string; region: string; prefix: string; kmsKeyArn: string };
 connection: { id: string; version: number };
}
export interface CustomerBackendState { versionId: string; digest: string; lineage: string; serial: number }
export interface CustomerSavedPlanBinding {
 schema: "axiom.terraform.saved-plan.v2"; evidenceScope: "customer_ci_attested";
 profile: CustomerPlanProfile; profileDigest: string; requestContentHash: string; targetDigest: string; backendState: CustomerBackendState;
 producer: { repositoryId: string; runId: string; runAttempt: number; attestationDigest: string; trustDigest: string; receiptDigest: string };
 configurationDigest: string; providerLockDigest: string; terraformVersion: string; executableDigest: string; binaryDigest: string; showDigest: string;
 createdAt: string; expiresAt: string;
}
