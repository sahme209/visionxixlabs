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

  it("keeps the tenant template separate from the retired Axiom platform entrypoint", () => {
    const checkedInWorkflow = readFileSync(resolve(process.cwd(), ".github/workflows/axiom-deploy-aws-ecs.yml"), "utf8");
    expect(checkedInWorkflow).toContain("permissions: {}");
    expect(checkedInWorkflow).toContain("Require managed platform deployment");
    expect(checkedInWorkflow).not.toContain("configure-aws-credentials@");
    expect(AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE).toContain("id-token: write");
  });
  it("pins the reviewed AWS credential action to the verified full vendor commit",()=>{expect(AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE).toContain('aws-actions/configure-aws-credentials@e1253824e5c10ff9df46874f81ed3ec929e19cfd');expect(AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE).not.toMatch(/uses:.*@v[0-9]/);});

  it("does not silently retry role assumption or translate ambient credential inputs",()=>{expect(AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE).toContain('disable-retry: true');expect(AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE).toContain('translate-env-variables: false');expect(AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE).toContain('AWS_MAX_ATTEMPTS: "1"');});

});
