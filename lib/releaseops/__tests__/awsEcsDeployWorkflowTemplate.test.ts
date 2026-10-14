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

  it("matches the checked-in tenant workflow exactly", () => {
    const checkedInWorkflow = readFileSync(resolve(process.cwd(), ".github/workflows/axiom-deploy-aws-ecs.yml"), "utf8");
    expect(checkedInWorkflow.trim()).toBe(AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE.trim());
  });
});
