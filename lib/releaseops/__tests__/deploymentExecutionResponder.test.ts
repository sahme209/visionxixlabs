import { describe, expect, it } from "vitest";
import { serializeDeploymentExecution, type DeploymentExecutionRow } from "../deploymentExecutionResponder";

describe("serializeDeploymentExecution", () => {
  it("preserves the exact governed source and review evidence", () => {
    const row: DeploymentExecutionRow = {
      id: "exec_1",
      organizationId: "org_1",
      environmentId: "env_prod",
      repositoryFullName: "acme/widgets",
      sourceRef: "release/2026-10-07",
      sourceKind: "branch",
      sourceCommitSha: "0123456789abcdef",
      branchPolicyId: "policy_1",
      promotedFromExecutionId: null,
      pullRequestUrl: "https://github.com/acme/widgets/pull/42",
      workflowRunId: "run_1",
      workflowUrl: "https://github.com/acme/widgets/actions/runs/1",
      source: "desktop",
      triggeredByUserId: "user_1",
      status: "queued",
      conclusion: null,
      rollbackStatus: "not_started",
      lastObservedAt: null,
      completedAt: null,
      createdAt: new Date("2026-10-07T20:00:00.000Z"),
      updatedAt: new Date("2026-10-07T20:01:00.000Z"),
    };

    expect(serializeDeploymentExecution(row)).toMatchObject({
      sourceRef: "release/2026-10-07",
      sourceKind: "branch",
      sourceCommitSha: "0123456789abcdef",
      branchPolicyId: "policy_1",
      pullRequestUrl: "https://github.com/acme/widgets/pull/42",
      createdAt: "2026-10-07T20:00:00.000Z",
      updatedAt: "2026-10-07T20:01:00.000Z",
    });
  });
});
