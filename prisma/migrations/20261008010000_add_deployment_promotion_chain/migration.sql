-- Real dev -> test -> prod promotion chain: a deploy can now link back to
-- the exact prior-environment DeploymentExecution it promotes, and a
-- BranchEnvironmentPolicy can require that link. See
-- lib/releaseops/deploymentPolicyGuard.ts for enforcement.

-- AlterTable
ALTER TABLE "DeploymentExecution"
    ADD COLUMN "promotedFromExecutionId" TEXT;

-- AlterTable
ALTER TABLE "BranchEnvironmentPolicy"
    ADD COLUMN "requirePromotionFromEnvironmentId" TEXT;
