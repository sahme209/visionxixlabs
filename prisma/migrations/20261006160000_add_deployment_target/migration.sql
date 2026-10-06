-- DeploymentTarget — one real AWS deploy target per Environment. Stores
-- only a role ARN, region, ECS cluster, and ECS service — never a
-- credential. The OIDC trust (identity provider + the role's own trust
-- policy, scoped to the tenant's GitHub repo) lives entirely on the
-- tenant's AWS account; Axiom only remembers which role/cluster/service
-- a deploy for this environment should target when it triggers the
-- tenant's own GitHub Actions workflow via workflow_dispatch.

-- CreateTable
CREATE TABLE "DeploymentTarget" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'aws',
    "roleArn" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "ecsCluster" TEXT NOT NULL,
    "ecsService" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentTarget_environmentId_key" ON "DeploymentTarget"("environmentId");

-- CreateIndex
CREATE INDEX "DeploymentTarget_organizationId_idx" ON "DeploymentTarget"("organizationId");

-- AddForeignKey
ALTER TABLE "DeploymentTarget" ADD CONSTRAINT "DeploymentTarget_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
