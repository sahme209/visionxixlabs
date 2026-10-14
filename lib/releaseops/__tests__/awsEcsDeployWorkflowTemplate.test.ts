import { describe, expect, it } from "vitest";

import { AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE } from "../awsEcsDeployWorkflowTemplate";

describe("AWS ECS deployment workflow template", () => {
  it("serializes each ECS target without cancelling an active rollback-capable run", () => {
    expect(AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE).toContain(`concurrency:
  group: axiom-ecs-\${{ inputs.role_arn }}-\${{ inputs.region }}-\${{ inputs.cluster }}-\${{ inputs.service }}
  cancel-in-progress: false`);
  });
});
