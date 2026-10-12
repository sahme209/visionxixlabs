ALTER TABLE "DeploymentExecution"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "DeploymentExecution_organizationId_idempotencyKey_key"
ON "DeploymentExecution"("organizationId", "idempotencyKey");
