import { describe, expect, it } from "vitest";
import { buildRestartReview, checkRestartReview, restartRuleDigest } from "../restartReview";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
const target = { kind: "ecs_restart_target" as const, organizationId: "org", environmentId: "env", environmentTier: "dev", targetId: "target-A", provider: "aws" as const, targetUpdatedAt: new Date(1).toISOString(), roleArn: "arn:aws:iam::123456789012:role/restart", region: "us-east-1", ecsCluster: "cluster-A", ecsService: "service-A" };
const rule = { id: "rule", organizationId: "org", connectionId: "connection", name: "Fixture", dagId: "dag", actionType: "deploy", environmentId: "env", repositoryFullName: "fixture/repo", sourceRef: "main", sourceKind: "branch", requiredDagState: "success", dependencyDagIds: ["upstream"], approvalRequired: true, enabled: true, createdAt: new Date(0), updatedAt: new Date(1), maxRetries: 3, retryDelaySeconds: 60 };
const execution = { id: "execution", organizationId: "org", automationId: "rule", sourceDagId: "dag", sourceDagRunId: "run", sourceDagState: "success" };
const connection = { id: "connection", baseUrl: "https://airflow.fixture.invalid", updatedAt: new Date(1).toISOString() };
describe("Airflow frozen restart review", () => {
  it.each(["environmentTier", "targetId", "provider", "targetUpdatedAt", "roleArn", "region", "ecsCluster", "ecsService"] as const)("refuses a changed %s without replacing the frozen review", field => {
    const row = buildRestartReview(execution, rule, connection, target);
    expect(checkRestartReview(row, execution, rule, connection, { ...target, [field]: "changed" })).toBe(false);
    expect(row.payload.target).toEqual(target);
  });
  it("binds exact source, rule, connection and the existing server target snapshot", () => {
    const row = buildRestartReview(execution, rule, connection, target);
    expect(row.digest).toBe(sha256ContentHash(row.payload));
    expect(checkRestartReview(row, execution, rule, connection, target)).toBe(true);
    expect(checkRestartReview(row, execution, rule, connection, { ...target, ecsService: "service-B" })).toBe(false);
    expect(checkRestartReview(row, { ...execution, sourceDagRunId: "other" }, rule, connection, target)).toBe(false);
  });
  it("does not treat scheduler cursor bookkeeping as a reviewed configuration edit", () => {
    expect(restartRuleDigest(rule)).toBe(restartRuleDigest({ ...rule, updatedAt: new Date(2), lastEvaluatedAt: new Date(), nextScheduledAt: new Date() }));
    expect(restartRuleDigest(rule)).not.toBe(restartRuleDigest({ ...rule, sourceRef: "changed" }));
  });
  it("rejects changed payload/digest/connection identity instead of recapturing", () => {
    const row = buildRestartReview(execution, rule, connection, target);
    expect(checkRestartReview({ ...row, payload: { ...row.payload, target: { ...target, ecsService: "forged" } } }, execution, rule, connection, target)).toBe(false);
    expect(checkRestartReview(row, execution, rule, { ...connection, updatedAt: new Date(2).toISOString() }, target)).toBe(false);
    expect(checkRestartReview(null, execution, rule, connection, target)).toBe(false);
  });
});
