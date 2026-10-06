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

      - name: Force a new ECS deployment
        run: |
          aws ecs update-service \\
            --cluster "\${{ inputs.cluster }}" \\
            --service "\${{ inputs.service }}" \\
            --force-new-deployment
`;
