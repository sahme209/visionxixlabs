import { describe, expect, it } from "vitest";
import { evidenceDigest, imageSetDigest, matchExecutionReceipt, matchPromotion, matchTrustedReleaseEvidence, parseManifestCandidate,
  type ReleaseManifestV2, type ReleaseManifest, type ManifestCandidate, type TrustedReleaseEvidence, type ExecutionReceipt, type TrustedReceiptEvidence, type TrustedPriorRelease } from "../contract";
const now = new Date("2026-10-16T12:00:00Z");
const hash = (digit: string) => `sha256:${digit.repeat(64)}`;
const sourceSha = "a".repeat(40);
const image = (name: string, digit: string) => ({ container: name, image: `123456789012.dkr.ecr.us-east-1.amazonaws.com/${name}@${hash(digit)}` });
function manifest(): ReleaseManifestV2 {
  return { protocol: "axiom.ecs.release.v2", operationId: "op-1", organizationId: "org-1", environmentId: "stage",
    repository: { id: "123", fullName: "owner/repo", sourceSha },
    build: { runId: "31", attempt: 1, workflowPath: ".github/workflows/build.yml", workflowSha: "b".repeat(40), attestationDigest: hash("c") },
    executor: { workflowPath: ".github/workflows/axiom-release-aws-ecs-v2.yml", workflowSha: "d".repeat(40) },
    target: { partition: "aws", accountId: "123456789012", region: "us-east-1", roleArn: "arn:aws:iam::123456789012:role/Deploy", clusterArn: "arn:aws:ecs:us-east-1:123456789012:cluster/app", serviceArn: "arn:aws:ecs:us-east-1:123456789012:service/app/web", revision: 4 },
    proposed: { arn: "arn:aws:ecs:us-east-1:123456789012:task-definition/web:12", contentDigest: hash("e"), images: [image("app", "1"), image("proxy", "2")] },
    baseline: { arn: "arn:aws:ecs:us-east-1:123456789012:task-definition/web:11", contentDigest: hash("f"), images: [image("app", "3"), image("proxy", "2")] },
    health: { kind: "alb_target_health", targetGroupArn: "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/web/abcdef0123456789", minimumHealthyTargets: 1, timeoutSeconds: 60, stabilizationSeconds: 300 },
    promotion: null, policyDigest: hash("4"), createdAt: "2026-10-16T11:00:00Z", expiresAt: "2026-10-16T13:00:00Z" };
}
function candidate(m = manifest()): ManifestCandidate { const parsed = parseManifestCandidate(m, now); if (parsed.kind !== "structural_candidate") throw new Error(parsed.reason); return parsed; }
function trusted(c: ManifestCandidate): TrustedReleaseEvidence {
  const m = structuredClone(c.manifest);
  return { source: "trusted_application_boundary", organizationId: m.organizationId, environmentId: m.environmentId, repository: m.repository, build: m.build, executor: m.executor,
    attestedImageSetDigest: c.imageSetDigest, target: m.target, proposed: m.proposed, baseline: m.baseline, associatedTargetGroups: [m.health.targetGroupArn],
    approval: { receiptId: "durable-approval-1", manifestDigest: c.digest, policyDigest: m.policyDigest, expiresAt: "2026-10-16T12:30:00Z" } };
}
function receipt(c: ManifestCandidate): ExecutionReceipt {
  const m = structuredClone(c.manifest);
  return { operationId: m.operationId, manifestDigest: c.digest, organizationId: m.organizationId, environmentId: m.environmentId,
    repositoryId: m.repository.id, repositoryFullName: m.repository.fullName, sourceSha: m.repository.sourceSha, workflowPath: m.executor.workflowPath, workflowSha: m.executor.workflowSha,
    runId: "91", runAttempt: 2, phase: "rollout", outcome: "succeeded", target: m.target, taskDefinition: m.proposed, ecsDeploymentId: "ecs-svc/123", stabilization: "succeeded", health: { policyDigest: c.healthPolicyDigest, outcome: "succeeded" } };
}
function receiptEvidence(r: ExecutionReceipt): TrustedReceiptEvidence {
  return { source: "trusted_receipt_boundary", claim: { operationId: r.operationId, manifestDigest: r.manifestDigest, runId: r.runId, runAttempt: r.runAttempt },
    run: { repositoryId: r.repositoryId, repositoryFullName: r.repositoryFullName, sourceSha: r.sourceSha, workflowPath: r.workflowPath, workflowSha: r.workflowSha, runId: r.runId, runAttempt: r.runAttempt, conclusion: "success" },
    aws: { target: structuredClone(r.target), taskDefinition: structuredClone(r.taskDefinition!), ecsDeploymentId: r.ecsDeploymentId!, stabilization: r.stabilization, health: { ...r.health } } };
}

describe("ECS v2 structural candidates", () => {
  it("returns candidate identity only, not attestation/approval/execution authority", () => {
    const c = candidate(); expect(c.kind).toBe("structural_candidate"); expect(c.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(c).not.toHaveProperty("authorized"); expect(c).not.toHaveProperty("approved");
  });
  it("canonicalizes object and container ordering and detaches caller data", () => {
    const m = manifest(); const c = candidate(m); m.proposed.images.reverse();
    expect(candidate(m).digest).toBe(c.digest);
    m.proposed.images[0].image = "mutable:latest";
    expect(c.manifest.proposed.images.every(pin => pin.image.includes("@sha256:"))).toBe(true);
    expect(evidenceDigest({ z: 1, a: 2 })).toBe(evidenceDigest({ a: 2, z: 1 }));
  });
  it.each([
    ["protocol", (m: ReleaseManifest) => { m.protocol = "v1" as never; }],
    ["mutable sidecar", (m: ReleaseManifest) => { m.proposed.images[1].image = "registry.test/proxy:latest"; }],
    ["mutable baseline", (m: ReleaseManifest) => { m.baseline.images[0].image = "registry.test/app:old"; }],
    ["duplicate container", (m: ReleaseManifest) => { m.proposed.images[1].container = "app"; }],
    ["wrong target account", (m: ReleaseManifest) => { m.target.accountId = "999999999999"; }],
    ["wrong task region", (m: ReleaseManifest) => { m.proposed.arn = m.proposed.arn.replace("us-east-1", "us-west-2"); }],
    ["same task definition", (m: ReleaseManifest) => { m.proposed.arn = m.baseline.arn; }],
    ["wrong partition", (m: ReleaseManifest) => { m.target.partition = "aws-cn"; }],
    ["wrong service cluster", (m: ReleaseManifest) => { m.target.serviceArn = m.target.serviceArn.replace("service/app/", "service/other/"); }],
    ["arbitrary health URL", (m: ReleaseManifest) => { m.health.targetGroupArn = "http://169.254.169.254/"; }],
    ["unbounded waiter", (m: ReleaseManifest) => { m.health.timeoutSeconds = 100000; }],
    ["missing source", (m: ReleaseManifest) => { m.repository.sourceSha = "main"; }],
    ["expired", (m: ReleaseManifest) => { m.expiresAt = now.toISOString(); }],
    ["future creation", (m: ReleaseManifest) => { m.createdAt = "2026-10-16T12:01:00Z"; }],
    ["invalid calendar", (m: ReleaseManifest) => { m.createdAt = "2026-02-31T11:00:00Z"; }],
  ] as const)("rejects %s before any authority comparison", (_label, mutate) => { const m = manifest(); mutate(m); expect(parseManifestCandidate(m, now).kind).toBe("rejected"); });
  it("rejects unknown fields rather than dropping unreviewed mutation inputs", () => { expect(parseManifestCandidate({ ...manifest(), desiredCount: 100 }, now).kind).toBe("rejected"); });
});

describe("independently obtained trusted release evidence", () => {
  it("matches source/build/executor/target/tasks/approval without authorizing dispatch", () => {
    const c = candidate(); expect(matchTrustedReleaseEvidence(c, trusted(c), now)).toEqual({ kind: "evidence_match", manifestDigest: c.digest });
  });
  it.each([
    ["tenant", (t: TrustedReleaseEvidence) => { t.organizationId = "other"; }],
    ["environment", (t: TrustedReleaseEvidence) => { t.environmentId = "prod"; }],
    ["source", (t: TrustedReleaseEvidence) => { t.repository.sourceSha = "1".repeat(40); }],
    ["attestation", (t: TrustedReleaseEvidence) => { t.build.attestationDigest = hash("1"); }],
    ["image subject", (t: TrustedReleaseEvidence) => { t.attestedImageSetDigest = hash("1"); }],
    ["workflow revision", (t: TrustedReleaseEvidence) => { t.executor.workflowSha = "1".repeat(40); }],
    ["target revision", (t: TrustedReleaseEvidence) => { if ("revision" in t.target) t.target.revision++; }],
    ["artifact", (t: TrustedReleaseEvidence) => { t.proposed.contentDigest = hash("1"); }],
    ["baseline", (t: TrustedReleaseEvidence) => { t.baseline.images[0] = image("app", "9"); }],
    ["health binding", (t: TrustedReleaseEvidence) => { t.associatedTargetGroups = []; }],
    ["approval digest", (t: TrustedReleaseEvidence) => { t.approval.manifestDigest = hash("1"); }],
    ["approval policy", (t: TrustedReleaseEvidence) => { t.approval.policyDigest = hash("1"); }],
    ["expired approval", (t: TrustedReleaseEvidence) => { t.approval.expiresAt = now.toISOString(); }],
  ] as const)("rejects changed %s", (_label, mutate) => { const c = candidate(); const t = trusted(c); mutate(t); expect(matchTrustedReleaseEvidence(c, t, now).kind).toBe("rejected"); });
  it("rechecks expiry and post-review candidate mutation", () => {
    const c = candidate(); expect(matchTrustedReleaseEvidence(c, trusted(c), new Date(c.manifest.expiresAt)).kind).toBe("rejected");
    const t = trusted(c); if ("revision" in c.manifest.target) c.manifest.target.revision++; expect(matchTrustedReleaseEvidence(c, t, now).kind).toBe("rejected");
  });
});

describe("promotion preserves source and image set, not environment-specific task ARN", () => {
  function prior(c: ManifestCandidate): TrustedPriorRelease { return { executionId: "prior-exec", source: "trusted_receipt_boundary", organizationId: c.manifest.organizationId, environmentId: "dev", repositoryId: c.manifest.repository.id, repositoryFullName: c.manifest.repository.fullName, sourceSha, imageSetDigest: c.imageSetDigest, releaseOutcome: "succeeded", health: "succeeded" }; }
  function promoted() { const m = manifest(); m.promotion = { priorExecutionId: "prior-exec", priorEnvironmentId: "dev" }; return candidate(m); }
  it("permits independently verified prior-environment health and identical images", () => { const c = promoted(); expect(matchPromotion(c, prior(c), "dev", now).kind).toBe("promotion_match"); });
  it.each(["wrong_execution", "wrong_env", "wrong_tenant", "different_repository_id", "fork_repository_name", "different_image", "different_source", "failed", "unknown_health"])("rejects %s", mode => {
    const c = promoted(); const p = prior(c);
    if (mode === "different_repository_id") p.repositoryId = "999";
    if (mode === "fork_repository_name") p.repositoryFullName = "fork/repo";
    if (mode === "wrong_execution") p.executionId = "other";
    if (mode === "wrong_env") p.environmentId = "test"; if (mode === "wrong_tenant") p.organizationId = "other";
    if (mode === "different_image") p.imageSetDigest = imageSetDigest([image("app", "9")]); if (mode === "different_source") p.sourceSha = "1".repeat(40);
    if (mode === "failed") p.releaseOutcome = "failed"; if (mode === "unknown_health") p.health = "unknown";
    expect(matchPromotion(c, p, "dev", now).kind).toBe("rejected");
  });
});

describe("exact claimed workflow and independently observed AWS receipts", () => {
  it("matches actual release receipt identities and health", () => { const c = candidate(); const r = receipt(c); expect(matchExecutionReceipt(c, r, receiptEvidence(r))).toEqual({ kind: "matched_receipt", releaseSucceeded: true, recoverySucceeded: false }); });
  it.each(["run", "attempt", "source", "executor", "manifest", "target", "artifact", "deployment", "health"])("rejects wrong %s receipt", mode => {
    const c = candidate(); const r = receipt(c); const t = receiptEvidence(r);
    if (mode === "run") r.runId = "92"; if (mode === "attempt") r.runAttempt++; if (mode === "source") r.sourceSha = "1".repeat(40);
    if (mode === "executor") { r.workflowSha = "1".repeat(40); t.run.workflowSha = r.workflowSha; }
    if (mode === "manifest") r.manifestDigest = hash("1"); if (mode === "target" && "revision" in r.target) r.target.revision++;
    if (mode === "artifact") r.taskDefinition!.images[0] = image("app", "9"); if (mode === "deployment") r.ecsDeploymentId = "other";
    if (mode === "health") r.health.outcome = "failed";
    expect(matchExecutionReceipt(c, r, t).kind).toBe("rejected");
  });
  it("never turns successful rollback into successful original release", () => {
    const c = candidate(); const r = receipt(c); r.phase = "recovery"; r.taskDefinition = structuredClone(c.manifest.baseline);
    const t = receiptEvidence(r); t.run.conclusion = "failure";
    expect(matchExecutionReceipt(c, r, t)).toEqual({ kind: "matched_receipt", releaseSucceeded: false, recoverySucceeded: true });
  });
  it.each(["unknown", "failed"] as const)("does not turn %s evidence into success", state => {
    const c = candidate(); const r = receipt(c); r.outcome = state; r.stabilization = state; r.health.outcome = state;
    expect(matchExecutionReceipt(c, r, receiptEvidence(r))).toEqual({ kind: "unproven" });
  });
  it("does not accept a successful Actions conclusion as application health", () => {
    const c = candidate(); const r = receipt(c); r.health.outcome = "unknown";
    expect(matchExecutionReceipt(c, r, receiptEvidence(r))).toEqual({ kind: "unproven" });
  });
  it("does not trust decorated candidate health digests", () => {
    const c = candidate(); const r = receipt(c); c.healthPolicyDigest = hash("9"); r.health.policyDigest = c.healthPolicyDigest;
    expect(matchExecutionReceipt(c, r, receiptEvidence(r)).kind).toBe("rejected");
  });
  it("retains unknown provider outcomes without fabricating task or deployment observations", () => {
    const c = candidate(); const r = receipt(c); const t = receiptEvidence(r);
    r.outcome = "unknown"; r.taskDefinition = null; r.ecsDeploymentId = null; t.aws = null;
    expect(matchExecutionReceipt(c, r, t)).toEqual({ kind: "unproven" });
  });

  it.each([null, {}, { health: null }, { phase: "rollout", outcome: "succeeded" }])("rejects malformed untrusted receipt data without throwing", value => {
    const c = candidate(); const t = receiptEvidence(receipt(c));
    expect(matchExecutionReceipt(c, value, t)).toEqual({ kind: "rejected", reason: "receipt_invalid" });
  });

});

describe('versioned target snapshot compatibility', () => {
  function v3() {
    const { revision: _revision, ...coordinates } = manifest().target;
    return { ...manifest(), protocol: 'axiom.ecs.release.v3', target: { ...coordinates, snapshot: {
      schema: 'axiom.ecs.target-snapshot.v1', id: 'target-1', digest: hash('6'), connection: { id: 'connection-1', version: 2 },
    } } };
  }
  it('preserves the exact old v2 canonical manifest digest', () => {
    expect(candidate().digest).toBe('sha256:17fe497995214c06d9880357886826c66f894a699bd420a5a2cf3f05e0a6e43a');
  });
  it('uses the same evidence, promotion and receipt kernel for v3 snapshots', () => {
    const parsed = parseManifestCandidate(v3(), now);
    expect(parsed.kind).toBe('structural_candidate');
    if (parsed.kind !== 'structural_candidate') throw new Error(parsed.reason);
    expect(matchTrustedReleaseEvidence(parsed, trusted(parsed), now).kind).toBe('evidence_match');
    const r = receipt(parsed);
    expect(matchExecutionReceipt(parsed, r, receiptEvidence(r))).toEqual({ kind: 'matched_receipt', releaseSucceeded: true, recoverySucceeded: false });
    expect(parsed.digest).not.toBe(candidate().digest);
    const moved = v3(); moved.target.snapshot.connection.version++;
    const next = parseManifestCandidate(moved, now);
    expect(next.kind).toBe('structural_candidate');
    if (next.kind !== 'structural_candidate') throw new Error(next.reason);
    expect(next.digest).not.toBe(parsed.digest);
    expect(matchTrustedReleaseEvidence(next, trusted(parsed), now)).toMatchObject({ reason: 'target_changed' });
    expect(matchExecutionReceipt(next, r, receiptEvidence(r))).toMatchObject({ kind: 'rejected' });
  });
  it.each(['old_protocol', 'new_revision', 'missing', 'unknown_schema', 'empty_id', 'malformed_digest', 'zero_version', 'fractional_version', 'unknown_snapshot', 'unknown_connection'])(
    'rejects mixed or incomplete snapshot variant: %s', mode => {
      const m = v3();
      if (mode === 'old_protocol') m.protocol = 'axiom.ecs.release.v2';
      if (mode === 'new_revision') Object.assign(m.target, { revision: 1 });
      if (mode === 'missing') delete (m.target as Partial<typeof m.target>).snapshot;
      if (mode === 'unknown_schema') m.target.snapshot.schema = 'v0';
      if (mode === 'empty_id') m.target.snapshot.id = '';
      if (mode === 'malformed_digest') m.target.snapshot.digest = 'sha256:123';
      if (mode === 'zero_version') m.target.snapshot.connection.version = 0;
      if (mode === 'fractional_version') m.target.snapshot.connection.version = 1.5;
      if (mode === 'unknown_snapshot') Object.assign(m.target.snapshot, { revision: 1 });
      if (mode === 'unknown_connection') Object.assign(m.target.snapshot.connection, { encryptedConfiguration: 'never' });
      expect(parseManifestCandidate(m, now).kind).toBe('rejected');
    });
  it('rejects old revision targets labeled as v3', () => {
    expect(parseManifestCandidate({ ...manifest(), protocol: 'axiom.ecs.release.v3' }, now)).toMatchObject({ kind: 'rejected' });
  });
});
