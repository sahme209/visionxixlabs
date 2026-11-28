-- Cost estimate checks: reported monthly cost and the reason V19 changed a status. Additive only.
ALTER TABLE "DeploymentCheckResult" ADD COLUMN "monthlyCostCents" INTEGER;
ALTER TABLE "DeploymentCheckResult" ADD COLUMN "statusReason" TEXT;
