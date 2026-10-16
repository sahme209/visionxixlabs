import { createHash } from "node:crypto";

/** Pure candidate/evidence comparison only. No attestation verification,
 * authorization minting, workflow dispatch, AWS call or persistence. */
export interface ImagePin { container: string; image: string }
export interface TaskDefinitionPin { arn: string; contentDigest: string; images: ImagePin[] }
export interface ReleaseManifest {
  protocol: "axiom.ecs.release.v2";
  operationId: string; organizationId: string; environmentId: string;
  repository: { id: string; fullName: string; sourceSha: string };
  build: { runId: string; attempt: number; workflowPath: string; workflowSha: string; attestationDigest: string };
  executor: { workflowPath: string; workflowSha: string };
  target: { accountId: string; partition: "aws" | "aws-us-gov" | "aws-cn"; region: string; roleArn: string; clusterArn: string; serviceArn: string; revision: number };
  proposed: TaskDefinitionPin;
  baseline: TaskDefinitionPin;
  health: { kind: "alb_target_health"; targetGroupArn: string; minimumHealthyTargets: number; timeoutSeconds: number; stabilizationSeconds: number };
  promotion: { priorExecutionId: string; priorEnvironmentId: string } | null;
  policyDigest: string;
  createdAt: string; expiresAt: string;
}
export type ContractFailure = { kind: "rejected"; reason: string };
export interface ManifestCandidate { kind: "structural_candidate"; manifest: ReleaseManifest; digest: string; imageSetDigest: string; healthPolicyDigest: string }
const rejected = (reason: string): ContractFailure => ({ kind: "rejected", reason });
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const text = (value: unknown, maximum = 256): value is string => typeof value === "string" && value.length > 0 && value.length <= maximum && !/[\x00-\x20\x7f]/.test(value);
const integer = (value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= maximum;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const fields = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const time = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value)) && [new Date(value).toISOString(), new Date(value).toISOString().replace(".000Z", "Z")].includes(value);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function evidenceDigest(value: unknown): string { return `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`; }
function sortedImages(images: ImagePin[]) { return [...images].sort((a, b) => a.container < b.container ? -1 : a.container > b.container ? 1 : 0).map(image => ({ container: image.container, image: image.image })); }
export function imageSetDigest(images: ImagePin[]): string { return evidenceDigest(sortedImages(images)); }
function validImage(image: unknown): image is string {
  if (!text(image, 1024)) return false;
  const match = /^([^/]+)\/([a-z0-9][a-z0-9/_.-]*)@(sha256:[a-f0-9]{64})$/.exec(image);
  if (!match || match[2].split("/").some(part => !part || part === "." || part === "..")) return false;
  try { const registry = new URL(`https://${match[1]}`); return Boolean(registry.hostname && !registry.username && !registry.password && registry.pathname === "/" && !registry.search && !registry.hash); } catch { return false; }
}
function taskPin(value: unknown): value is TaskDefinitionPin {
  return fields(value, ["arn", "contentDigest", "images"]) && text(value.arn, 1024) && typeof value.contentDigest === "string" && DIGEST.test(value.contentDigest)
    && Array.isArray(value.images) && value.images.length > 0 && value.images.length <= 20
    && value.images.every(image => fields(image, ["container", "image"]) && typeof image.container === "string" && /^[A-Za-z0-9_-]{1,255}$/.test(image.container) && validImage(image.image))
    && new Set(value.images.map(image => image.container)).size === value.images.length;
}
function taskInTarget(pin: TaskDefinitionPin, target: ReleaseManifest["target"]): boolean {
  const match = /^arn:([^:]+):ecs:([^:]+):(\d{12}):task-definition\/([A-Za-z0-9_-]{1,255}):(\d+)$/.exec(pin.arn);
  return Boolean(match && match[1] === target.partition && match[2] === target.region && match[3] === target.accountId && integer(Number(match[5])));
}

/** A syntactically valid manifest is still an untrusted candidate. */
export function parseManifestCandidate(value: unknown, now: Date): ManifestCandidate | ContractFailure {
  if (!Number.isFinite(now.getTime())) return rejected("invalid_clock");
  if (!fields(value, ["protocol", "operationId", "organizationId", "environmentId", "repository", "build", "executor", "target", "proposed", "baseline", "health", "promotion", "policyDigest", "createdAt", "expiresAt"])) return rejected("invalid_manifest");
  if (value.protocol !== "axiom.ecs.release.v2" || !text(value.operationId) || !text(value.organizationId) || !text(value.environmentId)) return rejected("invalid_identity");
  const repository = value.repository;
  if (!fields(repository, ["id", "fullName", "sourceSha"]) || !text(repository.id, 32) || !/^[1-9]\d*$/.test(repository.id) || !text(repository.fullName) || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository.fullName) || typeof repository.sourceSha !== "string" || !SHA.test(repository.sourceSha)) return rejected("invalid_repository");
  const build = value.build;
  if (!fields(build, ["runId", "attempt", "workflowPath", "workflowSha", "attestationDigest"]) || !text(build.runId, 32) || !/^[1-9]\d*$/.test(build.runId) || !integer(build.attempt) || typeof build.workflowPath !== "string" || !/^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/.test(build.workflowPath) || typeof build.workflowSha !== "string" || !SHA.test(build.workflowSha) || typeof build.attestationDigest !== "string" || !DIGEST.test(build.attestationDigest)) return rejected("invalid_build_reference");
  const executor = value.executor;
  if (!fields(executor, ["workflowPath", "workflowSha"]) || typeof executor.workflowPath !== "string" || !/^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/.test(executor.workflowPath) || typeof executor.workflowSha !== "string" || !SHA.test(executor.workflowSha)) return rejected("invalid_executor_reference");
  const target = value.target;
  if (!fields(target, ["accountId", "partition", "region", "roleArn", "clusterArn", "serviceArn", "revision"]) || typeof target.accountId !== "string" || !/^\d{12}$/.test(target.accountId) || typeof target.partition !== "string" || !["aws", "aws-us-gov", "aws-cn"].includes(target.partition) || typeof target.region !== "string" || !/^[a-z]{2}(?:-[a-z]+)+-\d$/.test(target.region) || !integer(target.revision)) return rejected("invalid_target");
  const t = target as unknown as ReleaseManifest["target"];
  if ((t.partition === "aws-cn") !== t.region.startsWith("cn-") || (t.partition === "aws-us-gov") !== t.region.startsWith("us-gov-")) return rejected("target_partition_mismatch");
  const prefix = `arn:${t.partition}:ecs:${t.region}:${t.accountId}:`;
  const cluster = typeof t.clusterArn === "string" ? t.clusterArn.match(/^arn:[^:]+:ecs:[^:]+:\d{12}:cluster\/([A-Za-z0-9_-]{1,255})$/)?.[1] : undefined;
  if (typeof t.roleArn !== "string" || !new RegExp(`^arn:${t.partition}:iam::${t.accountId}:role/[A-Za-z0-9_+=,.@/-]{1,512}$`).test(t.roleArn) || !cluster || !t.clusterArn.startsWith(prefix) || typeof t.serviceArn !== "string" || !t.serviceArn.startsWith(`${prefix}service/${cluster}/`) || !new RegExp(`^${prefix}service/${cluster}/[A-Za-z0-9_-]{1,255}$`).test(t.serviceArn)) return rejected("target_arn_mismatch");
  if (!taskPin(value.proposed) || !taskPin(value.baseline) || !taskInTarget(value.proposed, t) || !taskInTarget(value.baseline, t) || value.proposed.arn === value.baseline.arn) return rejected("invalid_task_definition");
  const health = value.health;
  if (!fields(health, ["kind", "targetGroupArn", "minimumHealthyTargets", "timeoutSeconds", "stabilizationSeconds"]) || health.kind !== "alb_target_health" || typeof health.targetGroupArn !== "string" || !health.targetGroupArn.startsWith(`arn:${t.partition}:elasticloadbalancing:${t.region}:${t.accountId}:targetgroup/`) || !/^arn:[^:]+:elasticloadbalancing:[^:]+:\d{12}:targetgroup\/[A-Za-z0-9-]+\/[a-f0-9]{16}$/.test(health.targetGroupArn) || !integer(health.minimumHealthyTargets, 1000) || !integer(health.timeoutSeconds, 900) || !integer(health.stabilizationSeconds, 900)) return rejected("invalid_health_policy");
  if (value.promotion !== null && (!fields(value.promotion, ["priorExecutionId", "priorEnvironmentId"]) || !text(value.promotion.priorExecutionId) || !text(value.promotion.priorEnvironmentId) || value.promotion.priorEnvironmentId === value.environmentId)) return rejected("invalid_promotion_reference");
  if (typeof value.policyDigest !== "string" || !DIGEST.test(value.policyDigest) || !time(value.createdAt) || !time(value.expiresAt) || Date.parse(value.createdAt) > now.getTime() || Date.parse(value.expiresAt) <= now.getTime() || Date.parse(value.expiresAt) <= Date.parse(value.createdAt)) return rejected("invalid_expiry_or_policy");
  // Detach mutable caller data, sort only set-like container lists and hash
  // every field. Digest equality proves content identity, not authorization.
  const manifest = structuredClone(value) as unknown as ReleaseManifest;
  manifest.proposed.images = sortedImages(manifest.proposed.images); manifest.baseline.images = sortedImages(manifest.baseline.images);
  return { kind: "structural_candidate", manifest, digest: evidenceDigest(manifest), imageSetDigest: imageSetDigest(manifest.proposed.images), healthPolicyDigest: evidenceDigest(manifest.health) };
}

/** Obtained independently by a trusted server boundary. A caller's JSON cannot
 * mint this evidence: the future IO layer must verify provenance and current
 * durable approval/target/AWS state before constructing this context. */
export interface TrustedReleaseEvidence {
  source: "trusted_application_boundary";
  organizationId: string; environmentId: string;
  repository: ReleaseManifest["repository"];
  build: ReleaseManifest["build"];
  attestedImageSetDigest: string;
  executor: ReleaseManifest["executor"];
  target: ReleaseManifest["target"];
  proposed: TaskDefinitionPin;
  baseline: TaskDefinitionPin;
  associatedTargetGroups: string[];
  approval: { receiptId: string; manifestDigest: string; policyDigest: string; expiresAt: string };
}
export function matchTrustedReleaseEvidence(candidate: ManifestCandidate, trusted: TrustedReleaseEvidence, now: Date): { kind: "evidence_match"; manifestDigest: string } | ContractFailure {
  const checked = parseManifestCandidate(candidate.manifest, now);
  if (checked.kind !== "structural_candidate" || checked.digest !== candidate.digest) return rejected("candidate_changed_or_expired");
  const m = checked.manifest;
  if (trusted.source !== "trusted_application_boundary" || trusted.organizationId !== m.organizationId || trusted.environmentId !== m.environmentId) return rejected("tenant_or_environment_mismatch");
  if (canonical(trusted.repository) !== canonical(m.repository) || canonical(trusted.build) !== canonical(m.build) || trusted.attestedImageSetDigest !== checked.imageSetDigest) return rejected("source_or_provenance_mismatch");
  if (canonical(trusted.executor) !== canonical(m.executor)) return rejected("executor_changed");
  if (canonical(trusted.target) !== canonical(m.target)) return rejected("target_changed");
  if (canonical({ ...trusted.proposed, images: sortedImages(trusted.proposed.images) }) !== canonical(m.proposed)) return rejected("artifact_changed");
  if (canonical({ ...trusted.baseline, images: sortedImages(trusted.baseline.images) }) !== canonical(m.baseline)) return rejected("baseline_changed");
  if (!trusted.associatedTargetGroups.includes(m.health.targetGroupArn)) return rejected("health_target_unbound");
  if (!text(trusted.approval.receiptId) || trusted.approval.manifestDigest !== checked.digest || trusted.approval.policyDigest !== m.policyDigest || !time(trusted.approval.expiresAt) || Date.parse(trusted.approval.expiresAt) <= now.getTime() || Date.parse(trusted.approval.expiresAt) > Date.parse(m.expiresAt)) return rejected("approval_mismatch_or_expired");
  return { kind: "evidence_match", manifestDigest: checked.digest };
}

export interface TrustedPriorRelease {
  source: "trusted_receipt_boundary";
  executionId: string; organizationId: string; environmentId: string; repositoryId: string; repositoryFullName: string; sourceSha: string; imageSetDigest: string;
  releaseOutcome: "succeeded" | "failed" | "unknown"; health: "succeeded" | "failed" | "unknown";
}
export function matchPromotion(candidate: ManifestCandidate, prior: TrustedPriorRelease, requiredPriorEnvironmentId: string, now: Date): { kind: "promotion_match" } | ContractFailure {
  const checked = parseManifestCandidate(candidate.manifest, now);
  if (checked.kind !== "structural_candidate" || checked.digest !== candidate.digest) return rejected("candidate_changed_or_expired");
  const m = checked.manifest;
  if (!m.promotion || prior.executionId !== m.promotion.priorExecutionId || m.promotion.priorEnvironmentId !== requiredPriorEnvironmentId || prior.source !== "trusted_receipt_boundary" || prior.organizationId !== m.organizationId || prior.environmentId !== requiredPriorEnvironmentId || prior.environmentId === m.environmentId) return rejected("promotion_scope_mismatch");
  if (prior.repositoryId !== m.repository.id || prior.repositoryFullName !== m.repository.fullName) return rejected("promotion_repository_mismatch");
  if (prior.sourceSha !== m.repository.sourceSha || prior.imageSetDigest !== imageSetDigest(m.proposed.images)) return rejected("promotion_artifact_mismatch");
  if (prior.releaseOutcome !== "succeeded" || prior.health !== "succeeded") return rejected("promotion_unproven");
  return { kind: "promotion_match" };
}

export interface ExecutionReceipt {
  operationId: string; manifestDigest: string; organizationId: string; environmentId: string;
  repositoryId: string; repositoryFullName: string; sourceSha: string;
  workflowPath: string; workflowSha: string; runId: string; runAttempt: number;
  phase: "rollout" | "recovery"; outcome: "succeeded" | "failed" | "unknown";
  target: ReleaseManifest["target"]; taskDefinition: TaskDefinitionPin | null; ecsDeploymentId: string | null;
  stabilization: "succeeded" | "failed" | "unknown";
  health: { policyDigest: string; outcome: "succeeded" | "failed" | "unknown" };
}
export interface TrustedReceiptEvidence {
  source: "trusted_receipt_boundary";
  claim: { operationId: string; manifestDigest: string; runId: string; runAttempt: number };
  run: { repositoryId: string; repositoryFullName: string; sourceSha: string; workflowPath: string; workflowSha: string; runId: string; runAttempt: number; conclusion: "success" | "failure" | "cancelled" | "unknown" };
  aws: { target: ReleaseManifest["target"]; taskDefinition: TaskDefinitionPin; ecsDeploymentId: string; stabilization: ExecutionReceipt["stabilization"]; health: ExecutionReceipt["health"] } | null;
}
function receiptShape(value: unknown): value is ExecutionReceipt {
  return fields(value, ["operationId", "manifestDigest", "organizationId", "environmentId", "repositoryId", "repositoryFullName", "sourceSha", "workflowPath", "workflowSha", "runId", "runAttempt", "phase", "outcome", "target", "taskDefinition", "ecsDeploymentId", "stabilization", "health"])
    && [value.operationId, value.organizationId, value.environmentId, value.repositoryId, value.repositoryFullName].every(item => text(item))
    && typeof value.manifestDigest === "string" && DIGEST.test(value.manifestDigest)
    && typeof value.sourceSha === "string" && SHA.test(value.sourceSha) && typeof value.workflowSha === "string" && SHA.test(value.workflowSha)
    && text(value.workflowPath) && text(value.runId, 32) && /^[1-9]\d*$/.test(value.runId) && integer(value.runAttempt)
    && typeof value.phase === "string" && ["rollout", "recovery"].includes(value.phase) && typeof value.outcome === "string" && ["succeeded", "failed", "unknown"].includes(value.outcome)
    && typeof value.stabilization === "string" && ["succeeded", "failed", "unknown"].includes(value.stabilization)
    && (value.taskDefinition === null || taskPin(value.taskDefinition)) && (value.ecsDeploymentId === null || text(value.ecsDeploymentId))
    && fields(value.health, ["policyDigest", "outcome"]) && typeof value.health.policyDigest === "string" && DIGEST.test(value.health.policyDigest)
    && typeof value.health.outcome === "string" && ["succeeded", "failed", "unknown"].includes(value.health.outcome);
}

/** Receipt claims alone never prove release or recovery. Unknown/failure stays
 * unproven; recovery success never changes the original release to success. */
export function matchExecutionReceipt(candidate: ManifestCandidate, receipt: unknown, trusted: TrustedReceiptEvidence): { kind: "matched_receipt"; releaseSucceeded: boolean; recoverySucceeded: boolean } | { kind: "unproven" } | ContractFailure {
  if (!receiptShape(receipt)) return rejected("receipt_invalid");
  const checked = parseManifestCandidate(candidate.manifest, new Date(candidate.manifest.createdAt));
  if (checked.kind !== "structural_candidate" || checked.digest !== candidate.digest) return rejected("candidate_changed");
  const m = checked.manifest;
  if (evidenceDigest(m) !== candidate.digest || receipt.manifestDigest !== candidate.digest || receipt.operationId !== m.operationId || receipt.organizationId !== m.organizationId || receipt.environmentId !== m.environmentId) return rejected("receipt_manifest_mismatch");
  if (trusted.source !== "trusted_receipt_boundary" || receipt.repositoryId !== m.repository.id || receipt.repositoryFullName !== m.repository.fullName || receipt.sourceSha !== m.repository.sourceSha) return rejected("receipt_source_mismatch");
  if (trusted.claim.operationId !== m.operationId || trusted.claim.manifestDigest !== checked.digest || receipt.runId !== trusted.claim.runId || receipt.runAttempt !== trusted.claim.runAttempt) return rejected("receipt_claim_mismatch");
  if (receipt.workflowPath !== m.executor.workflowPath || receipt.workflowSha !== m.executor.workflowSha) return rejected("receipt_executor_mismatch");
  const run = trusted.run;
  if (receipt.repositoryId !== run.repositoryId || receipt.repositoryFullName !== run.repositoryFullName || receipt.sourceSha !== run.sourceSha || receipt.workflowPath !== run.workflowPath || receipt.workflowSha !== run.workflowSha || receipt.runId !== run.runId || receipt.runAttempt !== run.runAttempt || !integer(receipt.runAttempt) || !/^[1-9]\d*$/.test(receipt.runId) || !SHA.test(receipt.workflowSha) || !/^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/.test(receipt.workflowPath)) return rejected("receipt_run_mismatch");
  if (!["rollout", "recovery"].includes(receipt.phase) || !["succeeded", "failed", "unknown"].includes(receipt.outcome)) return rejected("receipt_invalid");
  const expected = receipt.phase === "rollout" ? m.proposed : m.baseline;
  if (canonical(receipt.target) !== canonical(m.target) || (receipt.taskDefinition !== null && (!taskPin(receipt.taskDefinition) || canonical({ ...receipt.taskDefinition, images: sortedImages(receipt.taskDefinition.images) }) !== canonical(expected)))) return rejected("receipt_artifact_or_target_mismatch");
  const aws = trusted.aws;
  if (!aws || !receipt.taskDefinition || !text(receipt.ecsDeploymentId)) return { kind: "unproven" };
  if (canonical(aws.target) !== canonical(receipt.target) || canonical({ ...aws.taskDefinition, images: sortedImages(aws.taskDefinition.images) }) !== canonical(expected) || !text(receipt.ecsDeploymentId) || receipt.ecsDeploymentId !== aws.ecsDeploymentId || receipt.stabilization !== aws.stabilization || canonical(receipt.health) !== canonical(aws.health) || receipt.health.policyDigest !== checked.healthPolicyDigest) return rejected("receipt_observation_mismatch");
  if (receipt.outcome !== "succeeded" || receipt.stabilization !== "succeeded" || receipt.health.outcome !== "succeeded") return { kind: "unproven" };
  if (receipt.phase === "rollout" && run.conclusion !== "success") return { kind: "unproven" };
  if (receipt.phase === "recovery" && run.conclusion !== "failure") return { kind: "unproven" };
  return { kind: "matched_receipt", releaseSucceeded: receipt.phase === "rollout", recoverySucceeded: receipt.phase === "recovery" };
}
