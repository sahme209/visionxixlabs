/**
 * The GitHub Actions workflow a tenant adds to their own repository so
 * Axiom can trigger a real ECS deploy via workflow_dispatch. Pure string
 * template — no I/O, no secrets embedded. The role ARN, region, cluster,
 * and service are passed as workflow_dispatch inputs at dispatch time
 * (see lib/connectors/github/githubWriteClient.ts's dispatchWorkflow),
 * not baked into the file, so one workflow file works for every
 * environment.
 *
 * OIDC role assumption — no AWS access key or secret is ever stored in
 * this repo's secrets. `permissions: id-token: write` is what lets
 * aws-actions/configure-aws-credentials exchange GitHub's OIDC token for
 * short-lived AWS credentials, scoped to whatever the role's own trust
 * policy allows.
 *
 * Automatic validation + rollback: the workflow captures the task
 * definition the service was running *before* the deploy, forces the
 * new deployment, then waits on ECS's own steady-state check
 * (`aws ecs wait services-stable`) as the health signal. If that wait
 * fails — the new tasks never reach a stable running state — it
 * redeploys the previous task definition and waits for that to
 * stabilize too, so a bad deploy self-heals without a human needing to
 * notice and intervene. This all runs inside the same OIDC-authenticated
 * job; no AWS credential is ever held outside GitHub Actions, including
 * for the rollback path.
 */

export const AWS_ECS_DEPLOY_WORKFLOW_FILENAME = "axiom-deploy-aws-ecs.yml";

export const AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE = `name: Axiom AWS ECS Deploy

on:
  workflow_dispatch:
    inputs:
      role_arn:
        required: true
        type: string
      region:
        required: true
        type: string
      cluster:
        required: true
        type: string
      service:
        required: true
        type: string

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS credentials (OIDC — no stored keys)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: \${{ inputs.role_arn }}
          aws-region: \${{ inputs.region }}

      - name: Capture current task definition (rollback target)
        id: capture
        run: |
          PREVIOUS_TASK_DEF=$(aws ecs describe-services \\
            --cluster "\${{ inputs.cluster }}" \\
            --services "\${{ inputs.service }}" \\
            --query 'services[0].taskDefinition' --output text)
          echo "previous_task_def=$PREVIOUS_TASK_DEF" >> "$GITHUB_OUTPUT"

      - name: Force a new ECS deployment
        run: |
          aws ecs update-service \\
            --cluster "\${{ inputs.cluster }}" \\
            --service "\${{ inputs.service }}" \\
            --force-new-deployment

      - name: Wait for the new deployment to stabilize
        id: wait
        continue-on-error: true
        run: |
          aws ecs wait services-stable \\
            --cluster "\${{ inputs.cluster }}" \\
            --services "\${{ inputs.service }}"

      - name: Roll back — deployment did not stabilize
        if: steps.wait.outcome == 'failure'
        run: |
          echo "::error::Deployment did not stabilize. Rolling back to \${{ steps.capture.outputs.previous_task_def }}"
          aws ecs update-service \\
            --cluster "\${{ inputs.cluster }}" \\
            --service "\${{ inputs.service }}" \\
            --task-definition "\${{ steps.capture.outputs.previous_task_def }}"
          aws ecs wait services-stable \\
            --cluster "\${{ inputs.cluster }}" \\
            --services "\${{ inputs.service }}"
          exit 1

      - name: Deployment stabilized
        if: steps.wait.outcome == 'success'
        run: echo "Deployment stabilized successfully."
`;
