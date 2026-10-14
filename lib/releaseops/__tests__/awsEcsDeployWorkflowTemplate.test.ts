import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE } from "../awsEcsDeployWorkflowTemplate";

describe("AWS ECS deployment workflow template", () => {
  it("serializes each ECS target without cancelling an active rollback-capable run", () => {
    expect(AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE).toContain(`concurrency:
  group: axiom-ecs-\${{ inputs.role_arn }}-\${{ inputs.region }}-\${{ inputs.cluster }}-\${{ inputs.service }}
  cancel-in-progress: false`);
  });

  it("minimizes mutable deployment output in workflow logs", () => {
    expect(AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE).toContain("--output text >/dev/null");
    expect(AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE).toContain("Deployment did not stabilize. Starting rollback.");
    expect(AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE).not.toContain("Rolling back to \${{ steps.capture.outputs.previous_task_def }}");
  });

  it("matches the checked-in tenant workflow", () => {
    const checkedInWorkflow = readFileSync(resolve(process.cwd(), ".github/workflows/axiom-deploy-aws-ecs.yml"), "utf8");
    expect(checkedInWorkflow.trim()).toBe(AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE.trim());
  });
});
